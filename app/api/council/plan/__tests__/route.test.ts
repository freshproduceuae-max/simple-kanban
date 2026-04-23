import { describe, it, expect, beforeEach, vi } from 'vitest';

const getAuthedUserId = vi.fn();
const runCouncilTurnMock = vi.fn();
const proposalCreateMock = vi.fn();
const startSession = vi.fn();
const writeSummary = vi.fn();
const endSession = vi.fn();
const findResumableSession = vi.fn();
const getForUserPref = vi.fn();
const upsertPref = vi.fn();
const REAL_UUID = 'cccccccc-1111-4222-8333-444444444444';

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
  getProposalRepository: () => ({
    create: (...a: unknown[]) => proposalCreateMock(...a),
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
  getUserPreferencesRepository: () => ({
    getForUser: (...a: unknown[]) => getForUserPref(...a),
    upsert: (...a: unknown[]) => upsertPref(...a),
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
function fakeTurn(opts?: {
  streamText?: string;
  finalText?: string;
  critic?: {
    ran: boolean;
    risk?: 'low' | 'medium' | 'high';
    review?: string | null;
  };
  recalledSummaries?: Array<{
    id: string;
    content: string;
    sessionId: string;
    createdAt: string;
  }>;
}) {
  const streamText = opts?.streamText ?? 'here is the plan…';
  const finalText = opts?.finalText ?? streamText;
  const critic = opts?.critic
    ? {
        ran: opts.critic.ran,
        risk: opts.critic.risk ?? 'low',
        review: opts.critic.review ?? null,
        tokensIn: 0,
        tokensOut: 0,
      }
    : { ran: false, risk: 'low', review: null, tokensIn: 0, tokensOut: 0 };
  return {
    stream: (async function* () {
      yield streamText;
    })(),
    done: Promise.resolve({
      text: finalText,
      preCriticText: finalText,
      mode: 'plan',
      researcher: {
        ok: true,
        text: '',
        toolCalls: [],
        tokensIn: 0,
        tokensOut: 0,
        recalledSummaries: opts?.recalledSummaries ?? [],
      },
      critic,
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
    findResumableSession.mockReset();
    getForUserPref.mockReset();
    upsertPref.mockReset();
    getForUserPref.mockResolvedValue(null);
    findResumableSession.mockImplementation(
      async ({ sessionId }: { sessionId: string }) => ({
        id: sessionId,
        user_id: 'u1',
        mode: 'plan',
        auth_session_id: 'auth-1',
        started_at: new Date().toISOString(),
        ended_at: null,
        summary_written_at: null,
      }),
    );
    __resetSessionCacheForTests();
    getAuthedUserId.mockResolvedValue('u1');
    runCouncilTurnMock.mockResolvedValue(fakeTurn());
    startSession.mockResolvedValue({
      id: REAL_UUID,
      user_id: 'u1',
      mode: 'plan',
      auth_session_id: 'auth-1',
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
    // F22a: trailer proposals carry both id + draft title so the
    // shelf composer can render <ProposalCard> without a second
    // fence-parse on the client.
    expect(trailer.proposals[0]).toMatchObject({ id: expect.any(String), title: 'task a' });
    expect(trailer.proposals[1]).toMatchObject({ id: expect.any(String), title: 'task b' });
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
    expect(trailer.proposals).toEqual([
      { id: 'p1', title: 'a' },
      { id: 'p3', title: 'c' },
    ]);
  });

  it('honors a client-provided UUID sessionId', async () => {
    const clientId = 'eeeeeeee-1111-4222-8333-444444444444';
    await planRoute(req({ sessionId: clientId, userInput: 'plan' }));
    expect(runCouncilTurnMock.mock.calls[0][0].sessionId).toBe(clientId);
    expect(startSession).not.toHaveBeenCalled();
  });

  it('F23: includes a criticAudit fragment when the Critic ran', async () => {
    runCouncilTurnMock.mockResolvedValueOnce(
      fakeTurn({
        finalText: '```json-plan\n{"tasks":["t1"]}\n```',
        critic: {
          ran: true,
          risk: 'medium',
          review: 'I would soften the Thursday commitment.',
        },
      }),
    );
    const res = await planRoute(req({ userInput: 'plan' }));
    const body = await res.text();
    const trailer = JSON.parse(body.split('\n').at(-1) as string);
    expect(trailer.criticAudit).toEqual({
      risk: 'medium',
      review: 'I would soften the Thursday commitment.',
      preDraft: '```json-plan\n{"tasks":["t1"]}\n```',
    });
  });

  it('F23: omits criticAudit when the Critic did not run (below-threshold fast path)', async () => {
    runCouncilTurnMock.mockResolvedValueOnce(
      fakeTurn({
        finalText: '```json-plan\n{"tasks":["t1"]}\n```',
        // default critic.ran === false
      }),
    );
    const res = await planRoute(req({ userInput: 'plan' }));
    const body = await res.text();
    const trailer = JSON.parse(body.split('\n').at(-1) as string);
    expect(trailer.criticAudit).toBeUndefined();
    // The proposals fragment still ships.
    expect(trailer.proposals).toHaveLength(1);
  });

  it('F23: emits a criticAudit-only trailer on turns with no proposals and no chips', async () => {
    // Conversational Plan replies (e.g., "yes I can draft that, what's
    // the scope?") produce no tasks/chips but should still reveal the
    // Critic audit when forceCritic fires.
    runCouncilTurnMock.mockResolvedValueOnce(
      fakeTurn({
        finalText: 'I can draft this — tell me the scope.',
        critic: {
          ran: true,
          risk: 'low',
          review: 'Nothing to flag.',
        },
      }),
    );
    const res = await planRoute(req({ userInput: 'plan?' }));
    const body = await res.text();
    const lines = body.split('\n');
    const trailer = JSON.parse(lines.at(-1) as string);
    expect(trailer.criticAudit.review).toBe('Nothing to flag.');
    expect(trailer.proposals).toBeUndefined();
    expect(trailer.chips).toBeUndefined();
  });

  // -------- F24: memoryRecall trailer fragment --------

  it('F24: emits a memoryRecall fragment alongside proposals when Researcher surfaced summaries', async () => {
    runCouncilTurnMock.mockResolvedValueOnce(
      fakeTurn({
        finalText: '```json-plan\n{"tasks":["t1"]}\n```',
        recalledSummaries: [
          {
            id: 'sum-plan',
            content: 'You told me last week to keep Q3 tasks small.',
            sessionId: 'sess-plan',
            createdAt: '2026-04-17T09:00:00Z',
          },
        ],
      }),
    );
    const res = await planRoute(req({ userInput: 'plan' }));
    const body = await res.text();
    const trailer = JSON.parse(body.split('\n').at(-1) as string);
    expect(trailer.proposals).toHaveLength(1);
    expect(trailer.memoryRecall.recalls).toHaveLength(1);
    expect(trailer.memoryRecall.recalls[0].id).toBe('sum-plan');
  });

  it('F24: emits a memoryRecall-only trailer on a conversational Plan reply (no tasks/chips/critic)', async () => {
    runCouncilTurnMock.mockResolvedValueOnce(
      fakeTurn({
        finalText: 'tell me the scope first.',
        recalledSummaries: [
          {
            id: 'sum-only',
            content: 'Prior scope was web-only.',
            sessionId: 'sess-ext',
            createdAt: '2026-04-16T09:00:00Z',
          },
        ],
      }),
    );
    const res = await planRoute(req({ userInput: 'what should I build?' }));
    const body = await res.text();
    const trailer = JSON.parse(body.split('\n').at(-1) as string);
    expect(trailer.memoryRecall.recalls).toHaveLength(1);
    expect(trailer.proposals).toBeUndefined();
    expect(trailer.criticAudit).toBeUndefined();
  });

  it('F24: omits memoryRecall and the trailer entirely when Researcher returned empty AND the reply has no proposals/chips/critic', async () => {
    runCouncilTurnMock.mockResolvedValueOnce(
      fakeTurn({
        finalText: 'tell me the scope first.',
        recalledSummaries: [],
      }),
    );
    const res = await planRoute(req({ userInput: 'what should I build?' }));
    const body = await res.text();
    // Body is exactly the streamed text — no trailer line.
    expect(body).toBe('here is the plan…');
  });

  it('F24: merges memoryRecall + criticAudit + proposals + chips in one trailer', async () => {
    runCouncilTurnMock.mockResolvedValueOnce(
      fakeTurn({
        finalText:
          'drafting now — \n```json-plan\n{"tasks":["t1"],"chips":["deadline?"]}\n```',
        critic: {
          ran: true,
          risk: 'low',
          review: 'Looks honest.',
        },
        recalledSummaries: [
          {
            id: 'sum-all',
            content: 'You said to keep plans to three tasks.',
            sessionId: 'sess-all',
            createdAt: '2026-04-18T09:00:00Z',
          },
        ],
      }),
    );
    const res = await planRoute(req({ userInput: 'plan' }));
    const body = await res.text();
    const trailer = JSON.parse(body.split('\n').at(-1) as string);
    expect(trailer.proposals).toHaveLength(1);
    expect(trailer.chips).toEqual(['deadline?']);
    expect(trailer.criticAudit.review).toBe('Looks honest.');
    expect(trailer.memoryRecall.recalls[0].id).toBe('sum-all');
  });

  // -------- F25: transparency-mode trailer + server-side mode-A suppression --------

  it('F25: attaches transparencyMode=B alongside reveals by default', async () => {
    runCouncilTurnMock.mockResolvedValueOnce(
      fakeTurn({
        finalText: '```json-plan\n{"tasks":["t1"]}\n```',
        critic: {
          ran: true,
          risk: 'medium',
          review: 'flagged.',
        },
      }),
    );
    const res = await planRoute(req({ userInput: 'plan' }));
    const trailer = JSON.parse((await res.text()).split('\n').at(-1) as string);
    expect(trailer.transparencyMode).toBe('B');
    expect(trailer.criticAudit).toBeDefined();
  });

  it('F25: passes transparencyMode=D through when the user pref is D', async () => {
    getForUserPref.mockResolvedValueOnce({
      user_id: 'u1',
      transparency_mode: 'D',
      created_at: '2026-04-22T00:00:00Z',
      updated_at: '2026-04-22T00:00:00Z',
    });
    runCouncilTurnMock.mockResolvedValueOnce(
      fakeTurn({
        finalText: '```json-plan\n{"tasks":["t1"]}\n```',
        critic: { ran: true, risk: 'high', review: 'watch out.' },
      }),
    );
    const res = await planRoute(req({ userInput: 'plan' }));
    const trailer = JSON.parse((await res.text()).split('\n').at(-1) as string);
    expect(trailer.transparencyMode).toBe('D');
  });

  it('F25: suppresses reveal artifacts server-side under mode A but still ships proposals', async () => {
    // Mode A is "clean voice only" for reveals, but proposals are user-
    // action affordances (not a reveal) — the board needs them to let
    // the user tap Accept. The trailer drops criticAudit/memoryRecall
    // and omits transparencyMode (attached only when reveals present).
    getForUserPref.mockResolvedValueOnce({
      user_id: 'u1',
      transparency_mode: 'A',
      created_at: '2026-04-22T00:00:00Z',
      updated_at: '2026-04-22T00:00:00Z',
    });
    runCouncilTurnMock.mockResolvedValueOnce(
      fakeTurn({
        finalText:
          '```json-plan\n{"tasks":["t1"],"chips":["scope?"]}\n```',
        critic: { ran: true, risk: 'high', review: 'would normally flag.' },
        recalledSummaries: [
          {
            id: 'sum-drop',
            content: 'would normally surface.',
            sessionId: 'sess-drop',
            createdAt: '2026-04-10T00:00:00Z',
          },
        ],
      }),
    );
    const res = await planRoute(req({ userInput: 'plan' }));
    const trailer = JSON.parse((await res.text()).split('\n').at(-1) as string);
    // Proposals survive (they're an affordance, not a reveal).
    expect(trailer.proposals).toHaveLength(1);
    expect(trailer.chips).toEqual(['scope?']);
    // Reveal artifacts were dropped server-side.
    expect(trailer.criticAudit).toBeUndefined();
    expect(trailer.memoryRecall).toBeUndefined();
    // No reveals → no transparencyMode attached (keeps wire clean).
    expect(trailer.transparencyMode).toBeUndefined();
  });

  it('F25: under mode A with no proposals + no chips, emits no trailer at all', async () => {
    // Same server-side suppression as the chat route: when only reveal
    // artifacts would have applied, mode A strips the whole trailer.
    getForUserPref.mockResolvedValueOnce({
      user_id: 'u1',
      transparency_mode: 'A',
      created_at: '2026-04-22T00:00:00Z',
      updated_at: '2026-04-22T00:00:00Z',
    });
    runCouncilTurnMock.mockResolvedValueOnce(
      fakeTurn({
        finalText: 'I can draft this — tell me the scope.',
        critic: { ran: true, risk: 'low', review: 'ok.' },
      }),
    );
    const res = await planRoute(req({ userInput: 'plan?' }));
    expect(await res.text()).toBe('here is the plan…');
  });
});
