import { describe, it, expect, beforeEach, vi } from 'vitest';

const getAuthedUserId = vi.fn();
const runCouncilTurnMock = vi.fn();
const listForUserMock = vi.fn();
const startSession = vi.fn();
const writeSummary = vi.fn();
const endSession = vi.fn();
const findResumableSession = vi.fn();
const REAL_UUID = 'ffffffff-1111-4222-8333-444444444444';

vi.mock('@/lib/auth/current-user', () => ({
  getAuthedUserId: () => getAuthedUserId(),
  getAuthedIdentity: async () => ({
    userId: await getAuthedUserId(),
    authSessionId: 'auth-1',
  }),
}));
vi.mock('@/lib/council/server/dispatch', () => ({
  runCouncilTurn: (...a: unknown[]) => runCouncilTurnMock(...a),
}));
vi.mock('@/lib/persistence/server', () => ({
  getTaskRepository: () => ({
    listForUser: (...a: unknown[]) => listForUserMock(...a),
  }),
  getSessionRepository: () => ({
    startSession: (...a: unknown[]) => startSession(...a),
    endSession: (...a: unknown[]) => endSession(...a),
    appendTurn: vi.fn(),
    listSessionsForUser: vi.fn(),
    listTurns: vi.fn(),
    findResumableSession: (...a: unknown[]) => findResumableSession(...a),
    finalizeStaleSessionsForUser: vi.fn(async () => []),
  }),
  getCouncilMemoryRepository: () => ({
    writeSummary: (...a: unknown[]) => writeSummary(...a),
    listSummariesForUser: vi.fn(async () => []),
    writeRecall: vi.fn(),
    listRecallsForTurn: vi.fn(),
  }),
  getMetricsRepository: () => ({
    record: vi.fn(async () => {}),
    listForUser: vi.fn(async () => []),
    dailyTokenTotalForUser: vi.fn(async () => 0),
  }),
}));

import { POST as adviseRoute } from '../route';
import { __resetSessionCacheForTests } from '@/lib/council/server/session';

function req(body: unknown): Request {
  return new Request('https://plan.example.com/api/council/advise', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

function fakeTurn(
  text = 'advise reply',
  critic?: {
    ran: boolean;
    risk?: 'low' | 'medium' | 'high';
    review?: string | null;
  },
) {
  return {
    stream: (async function* () {
      yield text;
    })(),
    done: Promise.resolve({
      text,
      preCriticText: text,
      mode: 'advise',
      researcher: { ok: true, text: '', toolCalls: [], tokensIn: 0, tokensOut: 0 },
      critic: critic
        ? {
            ran: critic.ran,
            risk: critic.risk ?? 'low',
            review: critic.review ?? null,
            tokensIn: 0,
            tokensOut: 0,
          }
        : { ran: false, risk: 'low', review: null, tokensIn: 0, tokensOut: 0 },
    }),
  };
}

function task(id: string, title: string) {
  return {
    id,
    user_id: 'u1',
    title,
    description: 'ignored',
    board_column: 'todo' as const,
    position: 0,
    overdue_at: null,
    created_at: '2026-04-01T00:00:00Z',
    updated_at: '2026-04-01T00:00:00Z',
  };
}

describe('POST /api/council/advise', () => {
  beforeEach(() => {
    getAuthedUserId.mockReset();
    runCouncilTurnMock.mockReset();
    listForUserMock.mockReset();
    startSession.mockReset();
    writeSummary.mockReset();
    endSession.mockReset();
    findResumableSession.mockReset();
    findResumableSession.mockImplementation(
      async ({ sessionId }: { sessionId: string }) => ({
        id: sessionId,
        user_id: 'u1',
        mode: 'advise',
        auth_session_id: 'auth-1',
        started_at: new Date().toISOString(),
        ended_at: null,
        summary_written_at: null,
      }),
    );
    __resetSessionCacheForTests();
    getAuthedUserId.mockResolvedValue('u1');
    runCouncilTurnMock.mockResolvedValue(fakeTurn());
    listForUserMock.mockResolvedValue([]);
    startSession.mockResolvedValue({
      id: REAL_UUID,
      user_id: 'u1',
      mode: 'advise',
      auth_session_id: 'auth-1',
      started_at: new Date().toISOString(),
      ended_at: null,
      summary_written_at: null,
    });
    writeSummary.mockResolvedValue({});
    endSession.mockResolvedValue(undefined);
  });

  it('401 when unauthenticated', async () => {
    getAuthedUserId.mockRejectedValueOnce(new Error('nope'));
    const res = await adviseRoute(req({ userInput: 'hi' }));
    expect(res.status).toBe(401);
  });

  it('400 when userInput is missing or blank', async () => {
    const a = await adviseRoute(req({}));
    const b = await adviseRoute(req({ userInput: '  ' }));
    expect(a.status).toBe(400);
    expect(b.status).toBe(400);
    expect(runCouncilTurnMock).not.toHaveBeenCalled();
  });

  it('400 when body is not valid JSON', async () => {
    const raw = new Request('https://plan.example.com/api/council/advise', {
      method: 'POST',
      body: 'nope',
      headers: { 'content-type': 'application/json' },
    });
    const res = await adviseRoute(raw);
    expect(res.status).toBe(400);
  });

  it('defaults webEnabled=false in Advise mode (two-step confirm)', async () => {
    await adviseRoute(req({ userInput: 'what do you think?' }));
    const input = runCouncilTurnMock.mock.calls[0][0];
    expect(input.webEnabled).toBe(false);
    expect(input.mode).toBe('advise');
    expect(input.forceCritic).toBe(false);
  });

  it('requires BOTH confirmWebFetch AND an explicit user web request (PRD §6.3/§7)', async () => {
    // confirmWebFetch alone — not enough. The user's turn must ask for it too.
    await adviseRoute(
      req({ userInput: 'what do you think of my board?', confirmWebFetch: true }),
    );
    expect(runCouncilTurnMock.mock.calls[0][0].webEnabled).toBe(false);
    runCouncilTurnMock.mockClear();

    // Both present → web on.
    await adviseRoute(
      req({
        userInput: 'please look this up before you answer',
        confirmWebFetch: true,
      }),
    );
    expect(runCouncilTurnMock.mock.calls[0][0].webEnabled).toBe(true);
    runCouncilTurnMock.mockClear();

    // Request without confirmation → web off even if the user asked.
    await adviseRoute(
      req({ userInput: 'please look this up', confirmWebFetch: false }),
    );
    expect(runCouncilTurnMock.mock.calls[0][0].webEnabled).toBe(false);
  });

  it('projects the board snapshot down to {id, title, board_column, overdue_at}', async () => {
    listForUserMock.mockResolvedValueOnce([
      task('t1', 'first'),
      task('t2', 'second'),
    ]);
    await adviseRoute(req({ userInput: 'advise me' }));
    const snapshot = runCouncilTurnMock.mock.calls[0][0].boardSnapshot;
    expect(snapshot).toHaveLength(2);
    // No extra keys leaked.
    expect(Object.keys(snapshot[0]).sort()).toEqual(
      ['board_column', 'id', 'overdue_at', 'title'].sort(),
    );
  });

  it('survives a board-snapshot failure and still calls the dispatcher', async () => {
    listForUserMock.mockRejectedValueOnce(new Error('db down'));
    await adviseRoute(req({ userInput: 'advise me' }));
    const input = runCouncilTurnMock.mock.calls[0][0];
    expect(input.boardSnapshot).toBeUndefined();
  });

  it('emits {handoff: "plan"} trailer when user asks to draft', async () => {
    const res = await adviseRoute(
      req({ userInput: 'draft this for me please' }),
    );
    expect(res.headers.get('x-council-mode')).toBe('advise');
    expect(res.headers.get('x-council-has-proposals')).toBe('true');
    const body = await res.text();
    const trailer = JSON.parse(body.split('\n').at(-1) as string);
    expect(trailer).toEqual({ handoff: 'plan' });
  });

  it('omits the trailer when no handoff phrase is present', async () => {
    const res = await adviseRoute(
      req({ userInput: 'what do you think of this board?' }),
    );
    expect(res.headers.get('x-council-has-proposals')).toBeNull();
    const body = await res.text();
    // Body is exactly the streamed text — no trailer.
    expect(body).toBe('advise reply');
  });

  it('honors a client-provided UUID sessionId', async () => {
    const clientId = '12345678-1111-4222-8333-444444444444';
    await adviseRoute(req({ sessionId: clientId, userInput: 'advise' }));
    expect(runCouncilTurnMock.mock.calls[0][0].sessionId).toBe(clientId);
    // And puts it on the response header.
    const res = await adviseRoute(
      req({ sessionId: clientId, userInput: 'advise again' }),
    );
    expect(res.headers.get('x-council-session-id')).toBe(clientId);
    expect(startSession).not.toHaveBeenCalled();
  });

  it('F23: merges criticAudit into the handoff trailer when both apply', async () => {
    runCouncilTurnMock.mockResolvedValueOnce(
      fakeTurn('let me draft that for you.', {
        ran: true,
        risk: 'high',
        review: 'The draft glosses over the dependency on the vendor SLA.',
      }),
    );
    const res = await adviseRoute(
      req({ userInput: 'please draft this for me' }),
    );
    const body = await res.text();
    const trailer = JSON.parse(body.split('\n').at(-1) as string);
    expect(trailer.handoff).toBe('plan');
    expect(trailer.criticAudit).toEqual({
      risk: 'high',
      review: 'The draft glosses over the dependency on the vendor SLA.',
      preDraft: 'let me draft that for you.',
    });
  });

  it('F23: emits a criticAudit-only trailer when the Critic runs without a handoff', async () => {
    runCouncilTurnMock.mockResolvedValueOnce(
      fakeTurn('here is how I see the board.', {
        ran: true,
        risk: 'low',
        review: 'Nothing to tone down.',
      }),
    );
    const res = await adviseRoute(
      req({ userInput: 'how does this board look?' }),
    );
    // No handoff phrase → no x-council-has-proposals header.
    expect(res.headers.get('x-council-has-proposals')).toBeNull();
    const body = await res.text();
    const trailer = JSON.parse(body.split('\n').at(-1) as string);
    expect(trailer).toEqual({
      criticAudit: {
        risk: 'low',
        review: 'Nothing to tone down.',
        preDraft: 'here is how I see the board.',
      },
    });
  });
});
