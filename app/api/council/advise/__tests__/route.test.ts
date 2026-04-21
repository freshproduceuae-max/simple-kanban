import { describe, it, expect, beforeEach, vi } from 'vitest';

const getAuthedUserId = vi.fn();
const runCouncilTurnMock = vi.fn();
const listForUserMock = vi.fn();

vi.mock('@/lib/auth/current-user', () => ({
  getAuthedUserId: () => getAuthedUserId(),
}));
vi.mock('@/lib/council/server/dispatch', () => ({
  runCouncilTurn: (...a: unknown[]) => runCouncilTurnMock(...a),
}));
vi.mock('@/lib/persistence/server', () => ({
  getTaskRepository: () => ({
    listForUser: (...a: unknown[]) => listForUserMock(...a),
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

function fakeTurn(text = 'advise reply') {
  return {
    stream: (async function* () {
      yield text;
    })(),
    done: Promise.resolve({
      text,
      mode: 'advise',
      researcher: { ok: true, text: '', toolCalls: [], tokensIn: 0, tokensOut: 0 },
      critic: { ran: false, risk: 'low', review: null, tokensIn: 0, tokensOut: 0 },
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
    __resetSessionCacheForTests();
    getAuthedUserId.mockResolvedValue('u1');
    runCouncilTurnMock.mockResolvedValue(fakeTurn());
    listForUserMock.mockResolvedValue([]);
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

  it('enables web only when confirmWebFetch === true', async () => {
    await adviseRoute(
      req({ userInput: 'look at my board', confirmWebFetch: true }),
    );
    expect(runCouncilTurnMock.mock.calls[0][0].webEnabled).toBe(true);
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

  it('honors a client-provided sessionId', async () => {
    await adviseRoute(
      req({ sessionId: 'client-advise-xyz', userInput: 'advise' }),
    );
    expect(runCouncilTurnMock.mock.calls[0][0].sessionId).toBe(
      'client-advise-xyz',
    );
    // And puts it on the response header.
    const res = await adviseRoute(
      req({ sessionId: 'client-advise-xyz', userInput: 'advise again' }),
    );
    expect(res.headers.get('x-council-session-id')).toBe('client-advise-xyz');
  });
});
