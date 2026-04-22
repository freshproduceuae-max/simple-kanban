import { describe, it, expect, beforeEach, vi } from 'vitest';

const getAuthedUserId = vi.fn();
const runCouncilTurnMock = vi.fn();
const startSession = vi.fn();
const writeSummary = vi.fn();
const endSession = vi.fn();
const findResumableSession = vi.fn();
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

function fakeTurn(text = 'hello back') {
  return {
    stream: (async function* () {
      yield text;
    })(),
    done: Promise.resolve({
      text,
      mode: 'chat',
      researcher: {
        ok: true,
        text: '',
        toolCalls: [],
        tokensIn: 0,
        tokensOut: 0,
      },
      critic: { ran: false, risk: 'low', review: null, tokensIn: 0, tokensOut: 0 },
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
});
