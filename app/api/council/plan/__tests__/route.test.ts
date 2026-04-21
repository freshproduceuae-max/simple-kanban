import { describe, it, expect, beforeEach, vi } from 'vitest';

const getAuthedUserId = vi.fn();
const runCouncilTurnMock = vi.fn();
const proposalCreateMock = vi.fn();
const startSession = vi.fn();
const writeSummary = vi.fn();
const endSession = vi.fn();
const REAL_UUID = 'cccccccc-1111-4222-8333-444444444444';

vi.mock('@/lib/auth/current-user', () => ({
  getAuthedUserId: () => getAuthedUserId(),
}));
vi.mock('@/lib/council/server/dispatch', () => ({
  runCouncilTurn: (...a: unknown[]) => runCouncilTurnMock(...a),
}));
vi.mock('@/lib/persistence/server', () => ({
  getProposalRepository: () => ({
    create: (...a: unknown[]) => proposalCreateMock(...a),
  }),
  getSessionRepository: () => ({
    startSession: (...a: unknown[]) => startSession(...a),
    endSession: (...a: unknown[]) => endSession(...a),
    appendTurn: vi.fn(),
    listSessionsForUser: vi.fn(),
    listTurns: vi.fn(),
  }),
  getCouncilMemoryRepository: () => ({
    writeSummary: (...a: unknown[]) => writeSummary(...a),
    listSummariesForUser: vi.fn(async () => []),
    writeRecall: vi.fn(),
    listRecallsForTurn: vi.fn(),
  }),
}));

import { POST as planRoute } from '../route';
import { __resetSessionCacheForTests } from '@/lib/council/server/session';

function req(body: unknown): Request {
  return new Request('https://plan.example.com/api/council/plan', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * A fake consolidator turn. The final `done.text` can embed a json-plan
 * fence the route extracts. `streamText` is what the user sees.
 */
function fakeTurn(opts?: { streamText?: string; finalText?: string }) {
  const streamText = opts?.streamText ?? 'here is the plan…';
  const finalText = opts?.finalText ?? streamText;
  return {
    stream: (async function* () {
      yield streamText;
    })(),
    done: Promise.resolve({
      text: finalText,
      mode: 'plan',
      researcher: { ok: true, text: '', toolCalls: [], tokensIn: 0, tokensOut: 0 },
      critic: { ran: false, risk: 'low', review: null, tokensIn: 0, tokensOut: 0 },
    }),
  };
}

describe('POST /api/council/plan', () => {
  beforeEach(() => {
    getAuthedUserId.mockReset();
    runCouncilTurnMock.mockReset();
    proposalCreateMock.mockReset();
    startSession.mockReset();
    writeSummary.mockReset();
    endSession.mockReset();
    __resetSessionCacheForTests();
    getAuthedUserId.mockResolvedValue('u1');
    runCouncilTurnMock.mockResolvedValue(fakeTurn());
    startSession.mockResolvedValue({
      id: REAL_UUID,
      user_id: 'u1',
      mode: 'plan',
      started_at: new Date().toISOString(),
      ended_at: null,
      summary_written_at: null,
    });
    writeSummary.mockResolvedValue({});
    endSession.mockResolvedValue(undefined);
    proposalCreateMock.mockImplementation(async () => ({
      id: `p-${proposalCreateMock.mock.calls.length}`,
      user_id: 'u1',
      session_id: 's1',
      kind: 'task',
      payload: {},
      status: 'pending',
      created_at: new Date().toISOString(),
      expires_at: new Date().toISOString(),
      approved_at: null,
      approval_token_hash: null,
    }));
  });

  it('401 when unauthenticated', async () => {
    getAuthedUserId.mockRejectedValueOnce(new Error('nope'));
    const res = await planRoute(req({ userInput: 'hi' }));
    expect(res.status).toBe(401);
  });

  it('400 when userInput is missing or blank', async () => {
    const a = await planRoute(req({}));
    const b = await planRoute(req({ userInput: '   ' }));
    expect(a.status).toBe(400);
    expect(b.status).toBe(400);
    expect(runCouncilTurnMock).not.toHaveBeenCalled();
  });

  it('400 when body is not valid JSON', async () => {
    const raw = new Request('https://plan.example.com/api/council/plan', {
      method: 'POST',
      body: 'not json',
      headers: { 'content-type': 'application/json' },
    });
    const res = await planRoute(raw);
    expect(res.status).toBe(400);
  });

  it('forces webEnabled=true and forceCritic=true for Plan mode', async () => {
    await planRoute(req({ userInput: 'plan a trip' }));
    const input = runCouncilTurnMock.mock.calls[0][0];
    expect(input.mode).toBe('plan');
    expect(input.webEnabled).toBe(true);
    expect(input.forceCritic).toBe(true);
  });

  it('streams the reply with x-council-mode + session id (no has-proposals header — Plan cannot promise pre-stream)', async () => {
    runCouncilTurnMock.mockResolvedValueOnce(
      fakeTurn({
        streamText: 'sure, here is a draft plan…',
        finalText:
          'sure, here is a draft plan…\n\n' +
          '```json-plan\n{"tasks":["task a","task b"]}\n```',
      }),
    );
    const res = await planRoute(req({ userInput: 'plan my launch' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('x-council-mode')).toBe('plan');
    expect(res.headers.get('x-council-session-id')).toBeTruthy();
    expect(res.headers.get('x-council-has-proposals')).toBeNull();
    const body = await res.text();
    // First line is the streamed human reply; last line is the JSON trailer.
    const lines = body.split('\n');
    const trailer = JSON.parse(lines[lines.length - 1]);
    expect(trailer.proposals).toHaveLength(2);
    expect(Array.isArray(trailer.proposals)).toBe(true);
  });

  it('passes the real sessionId UUID to proposal.create now that F18 has landed', async () => {
    const clientId = 'dddddddd-1111-4222-8333-444444444444';
    runCouncilTurnMock.mockResolvedValueOnce(
      fakeTurn({
        finalText: '```json-plan\n{"tasks":["t"]}\n```',
      }),
    );
    await planRoute(req({ sessionId: clientId, userInput: 'plan' })).then(
      (r) => r.text(),
    );
    expect(proposalCreateMock).toHaveBeenCalledTimes(1);
    const arg = proposalCreateMock.mock.calls[0][0];
    expect(arg.session_id).toBe(clientId);
  });

  it('creates one proposal per drafted task via the proposal repo', async () => {
    runCouncilTurnMock.mockResolvedValueOnce(
      fakeTurn({
        finalText:
          'draft:\n```json-plan\n{"tasks":["write spec","pick colour","ship"]}\n```',
      }),
    );
    await planRoute(req({ userInput: 'help me plan' })).then((r) => r.text());
    expect(proposalCreateMock).toHaveBeenCalledTimes(3);
    const kinds = proposalCreateMock.mock.calls.map((c) => c[0].kind);
    expect(kinds).toEqual(['task', 'task', 'task']);
    const titles = proposalCreateMock.mock.calls.map(
      (c) => (c[0].payload as { title: string }).title,
    );
    expect(titles).toEqual(['write spec', 'pick colour', 'ship']);
  });

  it('passes Consolidator-requested chips through the trailer', async () => {
    runCouncilTurnMock.mockResolvedValueOnce(
      fakeTurn({
        finalText:
          'here is a draft…\n```json-plan\n' +
          '{"tasks":["t1"],"chips":["scope?","deadline?"]}\n```',
      }),
    );
    const res = await planRoute(req({ userInput: 'plan it' }));
    const body = await res.text();
    const trailer = JSON.parse(body.split('\n').at(-1) as string);
    expect(trailer.chips).toEqual(['scope?', 'deadline?']);
  });

  it('omits the trailer when there are no tasks and no chips', async () => {
    runCouncilTurnMock.mockResolvedValueOnce(
      fakeTurn({ finalText: 'just a conversational reply, no fence' }),
    );
    const res = await planRoute(req({ userInput: 'hi' }));
    const body = await res.text();
    // Body is exactly the streamed text — no trailer line.
    expect(body).toBe('here is the plan…');
    expect(proposalCreateMock).not.toHaveBeenCalled();
  });

  it('continues emitting siblings when one proposal create throws', async () => {
    proposalCreateMock.mockReset();
    proposalCreateMock
      .mockResolvedValueOnce({ id: 'p1' })
      .mockRejectedValueOnce(new Error('db-flake'))
      .mockResolvedValueOnce({ id: 'p3' });
    runCouncilTurnMock.mockResolvedValueOnce(
      fakeTurn({
        finalText:
          '```json-plan\n{"tasks":["a","b","c"]}\n```',
      }),
    );
    const res = await planRoute(req({ userInput: 'plan' }));
    const body = await res.text();
    const trailer = JSON.parse(body.split('\n').at(-1) as string);
    expect(trailer.proposals).toEqual(['p1', 'p3']);
  });

  it('honors a client-provided UUID sessionId', async () => {
    const clientId = 'eeeeeeee-1111-4222-8333-444444444444';
    await planRoute(req({ sessionId: clientId, userInput: 'plan' }));
    expect(runCouncilTurnMock.mock.calls[0][0].sessionId).toBe(clientId);
    expect(startSession).not.toHaveBeenCalled();
  });
});
