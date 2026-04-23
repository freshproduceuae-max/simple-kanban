import { describe, it, expect, beforeEach, vi } from 'vitest';

const getAuthedUserId = vi.fn();
const runCouncilTurnMock = vi.fn();
const startSession = vi.fn();
const writeSummary = vi.fn();
const endSession = vi.fn();
const findResumableSession = vi.fn();
const getForUserPref = vi.fn();
const upsertPref = vi.fn();
const REAL_UUID = 'aaaaaaaa-1111-4222-8333-444444444444';

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
  getUserPreferencesRepository: () => ({
    getForUser: (...a: unknown[]) => getForUserPref(...a),
    upsert: (...a: unknown[]) => upsertPref(...a),
  }),
}));

import { POST as chatRoute } from '../route';
import { __resetSessionCacheForTests } from '@/lib/council/server/session';

function req(body: unknown): Request {
  return new Request('https://plan.example.com/api/council/chat', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

function fakeTurn(
  text = 'hello back',
  critic?: {
    ran: boolean;
    risk?: 'low' | 'medium' | 'high';
    review?: string | null;
  },
  recalledSummaries?: Array<{
    id: string;
    content: string;
    sessionId: string;
    createdAt: string;
  }>,
) {
  return {
    stream: (async function* () {
      yield text;
    })(),
    done: Promise.resolve({
      text,
      preCriticText: text,
      mode: 'chat',
      researcher: {
        ok: true,
        text: '',
        toolCalls: [],
        tokensIn: 0,
        tokensOut: 0,
        recalledSummaries: recalledSummaries ?? [],
      },
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

describe('POST /api/council/chat', () => {
  beforeEach(() => {
    getAuthedUserId.mockReset();
    runCouncilTurnMock.mockReset();
    startSession.mockReset();
    writeSummary.mockReset();
    endSession.mockReset();
    findResumableSession.mockReset();
    getForUserPref.mockReset();
    upsertPref.mockReset();
    // Default: no preference row (new user path) → resolver returns 'B'.
    getForUserPref.mockResolvedValue(null);
    __resetSessionCacheForTests();
    getAuthedUserId.mockResolvedValue('u1');
    runCouncilTurnMock.mockResolvedValue(fakeTurn());
    startSession.mockResolvedValue({
      id: REAL_UUID,
      user_id: 'u1',
      mode: 'chat',
      auth_session_id: 'auth-1',
      started_at: new Date().toISOString(),
      ended_at: null,
      summary_written_at: null,
    });
    // Default: any well-formed client-provided UUID validates as live
    // (simulating the common shelf-echo case). Tests that want to
    // simulate a stale id override with mockResolvedValueOnce(null).
    findResumableSession.mockImplementation(
      async ({ sessionId }: { sessionId: string }) => ({
        id: sessionId,
        user_id: 'u1',
        mode: 'chat',
        auth_session_id: 'auth-1',
        started_at: new Date().toISOString(),
        ended_at: null,
        summary_written_at: null,
      }),
    );
    writeSummary.mockResolvedValue({});
    endSession.mockResolvedValue(undefined);
  });

  it('401 when unauthenticated', async () => {
    getAuthedUserId.mockRejectedValueOnce(new Error('nope'));
    const res = await chatRoute(req({ userInput: 'hi' }));
    expect(res.status).toBe(401);
  });

  it('400 when userInput is missing or blank', async () => {
    const a = await chatRoute(req({}));
    const b = await chatRoute(req({ userInput: '   ' }));
    expect(a.status).toBe(400);
    expect(b.status).toBe(400);
    expect(runCouncilTurnMock).not.toHaveBeenCalled();
  });

  it('400 when body is not valid JSON', async () => {
    const raw = new Request('https://plan.example.com/api/council/chat', {
      method: 'POST',
      body: 'not json',
      headers: { 'content-type': 'application/json' },
    });
    const res = await chatRoute(raw);
    expect(res.status).toBe(400);
  });

  it('200 streams chat reply with x-council-mode header and session id', async () => {
    const res = await chatRoute(req({ userInput: 'hello' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('x-council-mode')).toBe('chat');
    expect(res.headers.get('x-council-session-id')).toBeTruthy();
    const body = await res.text();
    expect(body).toBe('hello back');
  });

  it('defaults webEnabled=false in Chat mode', async () => {
    await chatRoute(req({ userInput: 'tell me a story' }));
    const input = runCouncilTurnMock.mock.calls[0][0];
    expect(input.webEnabled).toBe(false);
    expect(input.mode).toBe('chat');
    expect(input.forceCritic).toBe(false);
  });

  it('sets webEnabled=true when the user says "look this up"', async () => {
    await chatRoute(req({ userInput: 'please look this up for me' }));
    const input = runCouncilTurnMock.mock.calls[0][0];
    expect(input.webEnabled).toBe(true);
  });

  it('honors a client-provided UUID sessionId across turns without re-hitting startSession', async () => {
    const clientId = 'bbbbbbbb-1111-4222-8333-444444444444';
    await chatRoute(req({ sessionId: clientId, userInput: 'first' }));
    await chatRoute(req({ sessionId: clientId, userInput: 'second' }));
    const s1 = runCouncilTurnMock.mock.calls[0][0].sessionId;
    const s2 = runCouncilTurnMock.mock.calls[1][0].sessionId;
    expect(s1).toBe(clientId);
    expect(s2).toBe(clientId);
    expect(startSession).not.toHaveBeenCalled();
  });

  it('ignores a malformed client-provided id and starts a real session instead', async () => {
    await chatRoute(req({ sessionId: 'not-a-uuid', userInput: 'hi' }));
    const s1 = runCouncilTurnMock.mock.calls[0][0].sessionId;
    expect(s1).toBe(REAL_UUID);
    expect(startSession).toHaveBeenCalledTimes(1);
  });

  it('F23: emits a criticAudit trailer when the Critic fires on a chat draft', async () => {
    runCouncilTurnMock.mockResolvedValueOnce(
      fakeTurn('sure, take Tuesday off.', {
        ran: true,
        risk: 'medium',
        review: 'The draft treats the time-off as already approved.',
      }),
    );
    const res = await chatRoute(req({ userInput: 'can I take tuesday off?' }));
    const body = await res.text();
    const lines = body.split('\n');
    // Human-visible text is the first line; JSON trailer is the last.
    expect(lines[0]).toBe('sure, take Tuesday off.');
    const trailer = JSON.parse(lines.at(-1) as string);
    expect(trailer.criticAudit).toEqual({
      risk: 'medium',
      review: 'The draft treats the time-off as already approved.',
      preDraft: 'sure, take Tuesday off.',
    });
  });

  it('F23: emits NO trailer on chat turns where the Critic did not run', async () => {
    // Most Chat turns are low risk — the body should be exactly the
    // streamed text, no stray JSON line.
    const res = await chatRoute(req({ userInput: 'morning' }));
    const body = await res.text();
    expect(body).toBe('hello back');
  });

  // -------- F24: memoryRecall trailer fragment --------

  it('F24: emits a memoryRecall-only trailer when Researcher surfaced summaries and Critic stayed quiet', async () => {
    runCouncilTurnMock.mockResolvedValueOnce(
      fakeTurn('sure, morning.', undefined, [
        {
          id: 'sum-1',
          content: 'You were stuck on the SLA draft yesterday.',
          sessionId: 'sess-older',
          createdAt: '2026-04-21T10:00:00Z',
        },
      ]),
    );
    const res = await chatRoute(req({ userInput: 'morning' }));
    const body = await res.text();
    const lines = body.split('\n');
    expect(lines[0]).toBe('sure, morning.');
    const trailer = JSON.parse(lines.at(-1) as string);
    expect(trailer.criticAudit).toBeUndefined();
    expect(trailer.memoryRecall).toEqual({
      recalls: [
        {
          id: 'sum-1',
          sessionId: 'sess-older',
          createdAt: '2026-04-21T10:00:00Z',
          snippet: 'You were stuck on the SLA draft yesterday.',
        },
      ],
    });
  });

  it('F24: merges memoryRecall AND criticAudit in the same trailer when both apply', async () => {
    runCouncilTurnMock.mockResolvedValueOnce(
      fakeTurn(
        'take tuesday off, sure.',
        {
          ran: true,
          risk: 'medium',
          review: 'The draft treats approval as given.',
        },
        [
          {
            id: 'sum-xx',
            content: 'You mentioned a quarterly review on Tuesday.',
            sessionId: 'sess-prev',
            createdAt: '2026-04-20T12:00:00Z',
          },
        ],
      ),
    );
    const res = await chatRoute(req({ userInput: 'can I take tuesday off?' }));
    const body = await res.text();
    const trailer = JSON.parse(body.split('\n').at(-1) as string);
    expect(trailer.criticAudit.risk).toBe('medium');
    expect(trailer.memoryRecall.recalls).toHaveLength(1);
    expect(trailer.memoryRecall.recalls[0].id).toBe('sum-xx');
  });

  it('F24: emits NO trailer when Researcher returned empty recalledSummaries AND Critic stayed quiet', async () => {
    // Explicit pass — pinning the no-trailer zero-state.
    runCouncilTurnMock.mockResolvedValueOnce(fakeTurn('ok', undefined, []));
    const res = await chatRoute(req({ userInput: 'morning' }));
    const body = await res.text();
    expect(body).toBe('ok');
  });

  // -------- F25: transparency-mode trailer + server-side mode-A suppression --------

  it('F25: attaches transparencyMode=B (default) alongside criticAudit when no pref row exists', async () => {
    getForUserPref.mockResolvedValueOnce(null);
    runCouncilTurnMock.mockResolvedValueOnce(
      fakeTurn('sure.', { ran: true, risk: 'medium', review: 'flagged.' }),
    );
    const res = await chatRoute(req({ userInput: 'hi' }));
    const body = await res.text();
    const trailer = JSON.parse(body.split('\n').at(-1) as string);
    expect(trailer.criticAudit).toBeDefined();
    expect(trailer.transparencyMode).toBe('B');
  });

  it('F25: passes transparencyMode=C through to the trailer when the user pref is C', async () => {
    getForUserPref.mockResolvedValueOnce({
      user_id: 'u1',
      transparency_mode: 'C',
      created_at: '2026-04-22T00:00:00Z',
      updated_at: '2026-04-22T00:00:00Z',
    });
    runCouncilTurnMock.mockResolvedValueOnce(
      fakeTurn('sure.', { ran: true, risk: 'medium', review: 'flagged.' }),
    );
    const res = await chatRoute(req({ userInput: 'hi' }));
    const trailer = JSON.parse((await res.text()).split('\n').at(-1) as string);
    expect(trailer.transparencyMode).toBe('C');
  });

  it('F25: passes transparencyMode=D through to the trailer when the user pref is D', async () => {
    getForUserPref.mockResolvedValueOnce({
      user_id: 'u1',
      transparency_mode: 'D',
      created_at: '2026-04-22T00:00:00Z',
      updated_at: '2026-04-22T00:00:00Z',
    });
    runCouncilTurnMock.mockResolvedValueOnce(
      fakeTurn(
        'sure.',
        { ran: true, risk: 'high', review: 'risky.' },
        [
          {
            id: 'sum-1',
            content: 'prior context',
            sessionId: 'sess-old',
            createdAt: '2026-04-20T00:00:00Z',
          },
        ],
      ),
    );
    const res = await chatRoute(req({ userInput: 'hi' }));
    const trailer = JSON.parse((await res.text()).split('\n').at(-1) as string);
    expect(trailer.transparencyMode).toBe('D');
    expect(trailer.criticAudit).toBeDefined();
    expect(trailer.memoryRecall).toBeDefined();
  });

  it('F25: suppresses reveal artifacts server-side under mode A (no criticAudit, no memoryRecall, no trailer at all)', async () => {
    getForUserPref.mockResolvedValueOnce({
      user_id: 'u1',
      transparency_mode: 'A',
      created_at: '2026-04-22T00:00:00Z',
      updated_at: '2026-04-22T00:00:00Z',
    });
    // Would-normally-trailer path: Critic ran AND memory fired.
    runCouncilTurnMock.mockResolvedValueOnce(
      fakeTurn(
        'sure.',
        { ran: true, risk: 'high', review: 'risky.' },
        [
          {
            id: 'sum-1',
            content: 'prior context',
            sessionId: 'sess-old',
            createdAt: '2026-04-20T00:00:00Z',
          },
        ],
      ),
    );
    const res = await chatRoute(req({ userInput: 'hi' }));
    const body = await res.text();
    // Mode A strips both reveal artifacts; Chat has no other trailer
    // fragments, so the body is exactly the streamed text.
    expect(body).toBe('sure.');
  });

  it('F25: fail-quiets to B on a preferences repo outage (Supabase wobble does not block the stream)', async () => {
    getForUserPref.mockRejectedValueOnce(new Error('connection reset'));
    runCouncilTurnMock.mockResolvedValueOnce(
      fakeTurn('sure.', { ran: true, risk: 'medium', review: 'flagged.' }),
    );
    const res = await chatRoute(req({ userInput: 'hi' }));
    expect(res.status).toBe(200);
    const trailer = JSON.parse((await res.text()).split('\n').at(-1) as string);
    // Default ships: reveals render as normal (the user can still fix
    // their pref next time they load the settings page).
    expect(trailer.transparencyMode).toBe('B');
    expect(trailer.criticAudit).toBeDefined();
  });

  it('F25: omits transparencyMode when there is no reveal artifact to render (keeps the wire clean)', async () => {
    // Default preference row, no critic, no memory. Chat has no other
    // trailer fragments, so the body should carry no trailer line at all
    // — including no transparencyMode-only line.
    runCouncilTurnMock.mockResolvedValueOnce(fakeTurn('ok', undefined, []));
    const res = await chatRoute(req({ userInput: 'morning' }));
    expect(await res.text()).toBe('ok');
  });
});
