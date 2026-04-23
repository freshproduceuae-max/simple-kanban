import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Tests the F15/F16/F17 orchestrator. We mock the three agent modules
 * so we can assert the composition itself — researcher runs first and
 * its text flows into consolidator; critic runs after the consolidator
 * stream drains; forceCritic flag propagates; researcher fail-visible
 * sentences are forwarded instead of suppressed.
 */

const researchMock = vi.fn();
const consolidateMock = vi.fn();
const critiqueMock = vi.fn();
const reportAgentErrorMock = vi.fn(
  async (..._args: unknown[]) => ({ sent: true as const }),
);

vi.mock('@/lib/council/researcher', () => ({
  research: (...a: unknown[]) => researchMock(...a),
  RESEARCHER_FAIL_SENTENCE: "I couldn't check external sources this turn.",
}));
vi.mock('@/lib/council/consolidator', () => ({
  consolidate: (...a: unknown[]) => consolidateMock(...a),
  CONSOLIDATOR_FAIL_SENTENCE:
    "I'm not able to answer cleanly right now. Let's try again in a moment.",
}));
vi.mock('@/lib/council/critic', () => ({
  critique: (...a: unknown[]) => critiqueMock(...a),
}));
vi.mock('@/lib/council/errors/email', () => ({
  reportAgentError: (...a: unknown[]) => reportAgentErrorMock(...a),
}));

import { runCouncilTurn } from '../dispatch';
import {
  __resetSessionCacheForTests,
  invalidateSessionCacheBySessionId,
  resolveSessionId,
} from '../session';

function makeStream(chunks: string[]): AsyncIterable<string> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const c of chunks) yield c;
    },
  };
}

function defaultConsolidatorReturn(text = 'council reply', turnId: string | null = 'consolidator-turn-1') {
  return {
    stream: makeStream([text]),
    done: Promise.resolve({
      text,
      mode: 'chat',
      tokensIn: 0,
      tokensOut: 0,
      turnId,
    }),
  };
}

const writeRecallMock = vi.fn(async () => ({}));

const deps = {
  sessionRepo: { appendTurn: vi.fn() } as unknown as Parameters<typeof runCouncilTurn>[1]['sessionRepo'],
  memoryRepo: {
    listSummariesForUser: vi.fn().mockResolvedValue([]),
    writeSummary: vi.fn(),
    writeRecall: writeRecallMock,
  } as unknown as Parameters<typeof runCouncilTurn>[1]['memoryRepo'],
};

describe('runCouncilTurn', () => {
  beforeEach(() => {
    researchMock.mockReset();
    consolidateMock.mockReset();
    critiqueMock.mockReset();
    reportAgentErrorMock.mockClear();
    writeRecallMock.mockReset();
    __resetSessionCacheForTests();
    researchMock.mockResolvedValue({
      ok: true,
      text: 'found: the docs say X',
      toolCalls: [],
      tokensIn: 5,
      tokensOut: 10,
      recalledSummaries: [],
    });
    consolidateMock.mockResolvedValue(defaultConsolidatorReturn());
    critiqueMock.mockResolvedValue({
      ran: false,
      risk: 'low',
      review: null,
      tokensIn: 0,
      tokensOut: 0,
    });
  });

  it('runs researcher FIRST and passes its text into the consolidator', async () => {
    await runCouncilTurn(
      {
        userId: 'u1',
        sessionId: 's1',
        mode: 'chat',
        userInput: 'hi',
        webEnabled: false,
      },
      deps,
    );

    expect(researchMock).toHaveBeenCalledBefore(consolidateMock);
    const consolidatorInput = consolidateMock.mock.calls[0][0];
    expect(consolidatorInput.researcherFindings).toBe('found: the docs say X');
    expect(consolidatorInput.mode).toBe('chat');
  });

  it('propagates webEnabled + boardSnapshot into the researcher call', async () => {
    const board = [
      {
        id: 't1',
        title: 'task',
        board_column: 'todo' as const,
        overdue_at: null,
      },
    ];
    await runCouncilTurn(
      {
        userId: 'u1',
        sessionId: 's1',
        mode: 'advise',
        userInput: 'what should I do?',
        webEnabled: true,
        boardSnapshot: board,
      },
      deps,
    );
    const researcherInput = researchMock.mock.calls[0][0];
    expect(researcherInput.webEnabled).toBe(true);
    expect(researcherInput.mode).toBe('advise');
    expect(researcherInput.boardSnapshot).toBe(board);
  });

  it('forwards the researcher fail-visible sentence into the consolidator', async () => {
    researchMock.mockResolvedValueOnce({
      ok: false,
      text: "I couldn't check external sources this turn.",
      toolCalls: [],
      tokensIn: 0,
      tokensOut: 0,
      recalledSummaries: [],
    });
    await runCouncilTurn(
      {
        userId: 'u1',
        sessionId: 's1',
        mode: 'chat',
        userInput: 'hi',
        webEnabled: false,
      },
      deps,
    );
    const consolidatorInput = consolidateMock.mock.calls[0][0];
    expect(consolidatorInput.researcherFindings).toBe(
      "I couldn't check external sources this turn.",
    );
  });

  it('survives a researcher THROW (not just fail-visible return)', async () => {
    researchMock.mockRejectedValueOnce(new Error('boom'));
    const { done } = await runCouncilTurn(
      {
        userId: 'u1',
        sessionId: 's1',
        mode: 'chat',
        userInput: 'hi',
        webEnabled: false,
      },
      deps,
    );
    const result = await done;
    expect(result.researcher.ok).toBe(false);
    expect(consolidateMock).toHaveBeenCalled();
  });

  it('dispatches critic AFTER the consolidator stream ends', async () => {
    const ordering: string[] = [];
    let resolveDone!: (v: { text: string; mode: string; tokensIn: number; tokensOut: number }) => void;
    const donePromise = new Promise<{
      text: string; mode: string; tokensIn: number; tokensOut: number;
    }>((r) => { resolveDone = r; });
    consolidateMock.mockResolvedValueOnce({
      stream: makeStream(['hello']),
      done: donePromise,
    });
    critiqueMock.mockImplementationOnce(async () => {
      ordering.push('critic');
      return { ran: false, risk: 'low', review: null, tokensIn: 0, tokensOut: 0 };
    });

    const { stream, done } = await runCouncilTurn(
      {
        userId: 'u1',
        sessionId: 's1',
        mode: 'chat',
        userInput: 'hi',
        webEnabled: false,
      },
      deps,
    );

    // Consume stream first.
    for await (const _ of stream) { void _; }
    // Now resolve consolidator.done — critic should fire after this.
    ordering.push('before-done');
    resolveDone({ text: 'hello', mode: 'chat', tokensIn: 0, tokensOut: 0 });
    await done;
    expect(ordering).toEqual(['before-done', 'critic']);
  });

  it('propagates forceCritic: true into the critic input', async () => {
    const { done } = await runCouncilTurn(
      {
        userId: 'u1',
        sessionId: 's1',
        mode: 'plan',
        userInput: 'plan a trip',
        webEnabled: true,
        forceCritic: true,
      },
      deps,
    );
    await done;
    const criticInput = critiqueMock.mock.calls[0][0];
    expect(criticInput.force).toBe(true);
  });

  it('defaults forceCritic to false when unset', async () => {
    const { done } = await runCouncilTurn(
      {
        userId: 'u1',
        sessionId: 's1',
        mode: 'chat',
        userInput: 'hi',
        webEnabled: false,
      },
      deps,
    );
    await done;
    const criticInput = critiqueMock.mock.calls[0][0];
    expect(criticInput.force).toBe(false);
  });

  it('swallows a critic throw (fail-quiet) and still resolves done', async () => {
    critiqueMock.mockRejectedValueOnce(new Error('critic went boom'));
    const { done } = await runCouncilTurn(
      {
        userId: 'u1',
        sessionId: 's1',
        mode: 'chat',
        userInput: 'hi',
        webEnabled: false,
      },
      deps,
    );
    const result = await done;
    expect(result.critic.ran).toBe(false);
    expect(result.critic.review).toBeNull();
  });

  it('re-throws a consolidator acquisition error (fail-hard)', async () => {
    consolidateMock.mockRejectedValueOnce(new Error('sdk down'));
    await expect(
      runCouncilTurn(
        {
          userId: 'u1',
          sessionId: 's1',
          mode: 'chat',
          userInput: 'hi',
          webEnabled: false,
        },
        deps,
      ),
    ).rejects.toThrow('sdk down');
  });

  it('on budget cut: ends the session and skips Researcher/Consolidator/Critic', async () => {
    const endSession = vi.fn(async () => {});
    const metricsRepo = {
      record: vi.fn(async () => {}),
      listForUser: vi.fn(async () => []),
      // 500k tokens already used today → daily cap hit.
      dailyTokenTotalForUser: vi.fn(async () => 500_000),
    };
    const sessionRepo = {
      appendTurn: vi.fn(),
      sumSessionTokens: vi.fn(async () => 0),
      endSession,
    } as unknown as Parameters<typeof runCouncilTurn>[1]['sessionRepo'];

    const result = await runCouncilTurn(
      {
        userId: 'u-cut',
        sessionId: 's-cut',
        mode: 'chat',
        userInput: 'hi',
        webEnabled: false,
      },
      {
        sessionRepo,
        memoryRepo: deps.memoryRepo,
        metricsRepo: metricsRepo as unknown as Parameters<
          typeof runCouncilTurn
        >[1]['metricsRepo'],
      },
    );

    // Stream yields only the calm cap sentence.
    const chunks: string[] = [];
    for await (const c of result.stream) chunks.push(c);
    expect(chunks.join('')).toMatch(/budget/i);

    // Agents were short-circuited.
    expect(researchMock).not.toHaveBeenCalled();
    expect(consolidateMock).not.toHaveBeenCalled();
    expect(critiqueMock).not.toHaveBeenCalled();

    // Session was ended so the next turn doesn't reuse the over-budget row.
    expect(endSession).toHaveBeenCalledWith({
      sessionId: 's-cut',
      userId: 'u-cut',
    });
  });

  it('on budget cut: writes a `session-end` memory summary (mirrors idle rollover / sign-out)', async () => {
    const writeSummary = vi.fn(async () => undefined);
    const memoryRepo = {
      listSummariesForUser: vi.fn(async () => []),
      writeSummary,
    } as unknown as Parameters<typeof runCouncilTurn>[1]['memoryRepo'];
    const sessionRepo = {
      appendTurn: vi.fn(),
      sumSessionTokens: vi.fn(async () => 0),
      endSession: vi.fn(async () => {}),
    } as unknown as Parameters<typeof runCouncilTurn>[1]['sessionRepo'];
    const metricsRepo = {
      record: vi.fn(async () => {}),
      listForUser: vi.fn(async () => []),
      dailyTokenTotalForUser: vi.fn(async () => 500_000),
    };

    const result = await runCouncilTurn(
      {
        userId: 'u-sum',
        sessionId: 's-sum',
        mode: 'chat',
        userInput: 'hi',
        webEnabled: false,
      },
      {
        sessionRepo,
        memoryRepo,
        metricsRepo: metricsRepo as unknown as Parameters<
          typeof runCouncilTurn
        >[1]['metricsRepo'],
      },
    );
    // Drain the stream so the fire-and-forget summary write has a
    // chance to resolve before we assert.
    for await (const _ of result.stream) void _;
    await result.done;
    // Allow the void-awaited writeSummary IIFE to flush.
    await new Promise((r) => setTimeout(r, 0));

    expect(writeSummary).toHaveBeenCalledTimes(1);
    const payload = (writeSummary.mock.calls[0] as unknown[])[0] as {
      user_id: string;
      session_id: string;
      kind: string;
      content: string;
    };
    expect(payload.user_id).toBe('u-sum');
    expect(payload.session_id).toBe('s-sum');
    expect(payload.kind).toBe('session-end');
    expect(payload.content).toMatch(/budget cut/i);
    expect(payload.content).toMatch(/daily token cap/i);
  });

  it('on budget cut: invalidates the resolver cache entry for the over-budget session', async () => {
    // Seed the resolver cache so we can prove dispatch clears the slot.
    // Without the clear, the next turn's resolveSessionId would reuse
    // the dead over-budget id and trap the user on the same cut.
    const sessionId = '11111111-2222-3333-4444-555555555555';
    const sessionRepoForSeed = {
      findResumableSession: vi.fn(async () => ({
        id: sessionId,
        mode: 'chat' as const,
      })),
      startSession: vi.fn(),
    } as unknown as Parameters<typeof resolveSessionId>[0]['sessionRepo'];
    const memoryRepoForSeed = {
      listSummariesForUser: vi.fn(async () => []),
      writeSummary: vi.fn(),
    } as unknown as Parameters<typeof resolveSessionId>[0]['memoryRepo'];
    const resolved = await resolveSessionId({
      userId: 'u-cache',
      authSessionId: 'auth-1',
      mode: 'chat',
      clientProvided: sessionId,
      sessionRepo: sessionRepoForSeed,
      memoryRepo: memoryRepoForSeed,
    });
    expect(resolved).toBe(sessionId);
    // Sanity: cache now has the entry.
    expect(invalidateSessionCacheBySessionId(sessionId)).toBe(true);
    // Re-seed (the sanity probe just removed it).
    await resolveSessionId({
      userId: 'u-cache',
      authSessionId: 'auth-1',
      mode: 'chat',
      clientProvided: sessionId,
      sessionRepo: sessionRepoForSeed,
      memoryRepo: memoryRepoForSeed,
    });

    const sessionRepo = {
      appendTurn: vi.fn(),
      sumSessionTokens: vi.fn(async () => 0),
      endSession: vi.fn(async () => {}),
    } as unknown as Parameters<typeof runCouncilTurn>[1]['sessionRepo'];
    const metricsRepo = {
      record: vi.fn(async () => {}),
      listForUser: vi.fn(async () => []),
      dailyTokenTotalForUser: vi.fn(async () => 500_000),
    };

    await runCouncilTurn(
      {
        userId: 'u-cache',
        sessionId,
        mode: 'chat',
        userInput: 'hi',
        webEnabled: false,
      },
      {
        sessionRepo,
        memoryRepo: deps.memoryRepo,
        metricsRepo: metricsRepo as unknown as Parameters<
          typeof runCouncilTurn
        >[1]['metricsRepo'],
      },
    );

    // Dispatch should have already removed the cache slot — a second
    // invalidate call returns false because nothing is left to clear.
    expect(invalidateSessionCacheBySessionId(sessionId)).toBe(false);
  });

  it('on daily-cap cut: reportAgentError fires with failureClass "daily_cap_hit"', async () => {
    const sessionRepo = {
      appendTurn: vi.fn(),
      sumSessionTokens: vi.fn(async () => 0),
      endSession: vi.fn(async () => {}),
    } as unknown as Parameters<typeof runCouncilTurn>[1]['sessionRepo'];
    const metricsRepo = {
      record: vi.fn(async () => {}),
      listForUser: vi.fn(async () => []),
      // Daily cap hit (>= 500k) — triggers the daily_cap_hit branch.
      dailyTokenTotalForUser: vi.fn(async () => 500_000),
    };

    await runCouncilTurn(
      {
        userId: 'u-daily',
        sessionId: 's-daily',
        mode: 'chat',
        userInput: 'hi',
        webEnabled: false,
      },
      {
        sessionRepo,
        memoryRepo: deps.memoryRepo,
        metricsRepo: metricsRepo as unknown as Parameters<
          typeof runCouncilTurn
        >[1]['metricsRepo'],
      },
    );

    expect(reportAgentErrorMock).toHaveBeenCalledTimes(1);
    const payload = reportAgentErrorMock.mock.calls[0][0] as {
      failureClass: string;
      agent: string;
    };
    expect(payload.failureClass).toBe('daily_cap_hit');
    expect(payload.agent).toBe('consolidator');
  });

  // -------- F24: writeRecall integration --------

  it('F24: writes one memory_recalls row per surfaced summary when turnId is present', async () => {
    researchMock.mockResolvedValueOnce({
      ok: true,
      text: 'found X',
      toolCalls: [],
      tokensIn: 0,
      tokensOut: 0,
      recalledSummaries: [
        {
          id: 'sum-1',
          content: 'prior summary A',
          sessionId: 'sess-A',
          createdAt: '2026-04-20T00:00:00Z',
        },
        {
          id: 'sum-2',
          content: 'prior summary B',
          sessionId: 'sess-B',
          createdAt: '2026-04-19T00:00:00Z',
        },
      ],
    });
    consolidateMock.mockResolvedValueOnce(
      defaultConsolidatorReturn('reply', 'turn-happy-123'),
    );

    const { stream, done } = await runCouncilTurn(
      {
        userId: 'u-rec',
        sessionId: 's-rec',
        mode: 'chat',
        userInput: 'hi',
        webEnabled: false,
      },
      deps,
    );
    for await (const _ of stream) void _;
    await done;

    expect(writeRecallMock).toHaveBeenCalledTimes(2);
    const first = writeRecallMock.mock.calls[0][0] as Record<string, unknown>;
    expect(first.turn_id).toBe('turn-happy-123');
    expect(first.user_id).toBe('u-rec');
    // v0.4: summaries, not turns → explicit null on source_turn_id.
    expect(first.source_turn_id).toBeNull();
    expect(first.snippet).toBe('prior summary A');
    const second = writeRecallMock.mock.calls[1][0] as Record<string, unknown>;
    expect(second.snippet).toBe('prior summary B');
  });

  it('F24: skips writeRecall entirely when the Consolidator persistence failed (turnId=null)', async () => {
    // Missing turnId means persistTurn inside the Consolidator threw or
    // returned no row — a null FK would orphan the recall, so dispatch
    // refuses to write instead of inserting with a bogus parent.
    researchMock.mockResolvedValueOnce({
      ok: true,
      text: 'x',
      toolCalls: [],
      tokensIn: 0,
      tokensOut: 0,
      recalledSummaries: [
        {
          id: 'sum-1',
          content: 'prior summary',
          sessionId: 'sess-A',
          createdAt: '2026-04-20T00:00:00Z',
        },
      ],
    });
    consolidateMock.mockResolvedValueOnce(
      defaultConsolidatorReturn('reply', null),
    );

    const { stream, done } = await runCouncilTurn(
      {
        userId: 'u-null',
        sessionId: 's-null',
        mode: 'chat',
        userInput: 'hi',
        webEnabled: false,
      },
      deps,
    );
    for await (const _ of stream) void _;
    await done;

    expect(writeRecallMock).not.toHaveBeenCalled();
  });

  it('F24: skips writeRecall when the Researcher surfaced no summaries', async () => {
    // Default researchMock returns empty recalledSummaries; the happy
    // path turnId is present. Even so, no writes fire.
    consolidateMock.mockResolvedValueOnce(
      defaultConsolidatorReturn('reply', 'turn-abc'),
    );
    const { stream, done } = await runCouncilTurn(
      {
        userId: 'u-empty',
        sessionId: 's-empty',
        mode: 'chat',
        userInput: 'hi',
        webEnabled: false,
      },
      deps,
    );
    for await (const _ of stream) void _;
    await done;
    expect(writeRecallMock).not.toHaveBeenCalled();
  });

  it('F24: swallows writeRecall errors — done still resolves with the turn result', async () => {
    // A recall-write bug must NOT take down the user-facing reply. The
    // critic also runs even when recall writes fail, so this test pins
    // both: dispatch returns the full result, and nothing throws.
    researchMock.mockResolvedValueOnce({
      ok: true,
      text: 'x',
      toolCalls: [],
      tokensIn: 0,
      tokensOut: 0,
      recalledSummaries: [
        {
          id: 'sum-1',
          content: 'prior summary',
          sessionId: 'sess-A',
          createdAt: '2026-04-20T00:00:00Z',
        },
      ],
    });
    consolidateMock.mockResolvedValueOnce(
      defaultConsolidatorReturn('reply', 'turn-writefail'),
    );
    writeRecallMock.mockRejectedValueOnce(new Error('recall insert exploded'));
    const log = vi.fn();

    const { stream, done } = await runCouncilTurn(
      {
        userId: 'u-writefail',
        sessionId: 's-writefail',
        mode: 'chat',
        userInput: 'hi',
        webEnabled: false,
      },
      { ...deps, log },
    );
    for await (const _ of stream) void _;
    const result = await done;

    expect(writeRecallMock).toHaveBeenCalledTimes(1);
    expect(result.text).toBe('reply');
    expect(log).toHaveBeenCalledWith(
      expect.stringMatching(/writeRecall failed/),
      expect.any(Error),
    );
  });

  it('F24: writes complete before `done` resolves (callers observe a consistent DB state)', async () => {
    // F28 history + the client's own renderer read from DB right after
    // the turn ends. Awaiting recallWritesPromise inside `done` avoids
    // a race where those consumers see the reply but not yet the
    // recall rows.
    let writeResolved = false;
    let resolveWrite!: () => void;
    const writePromise = new Promise<unknown>((r) => {
      resolveWrite = () => {
        writeResolved = true;
        r({});
      };
    });
    writeRecallMock.mockImplementationOnce(() => writePromise);

    researchMock.mockResolvedValueOnce({
      ok: true,
      text: 'x',
      toolCalls: [],
      tokensIn: 0,
      tokensOut: 0,
      recalledSummaries: [
        {
          id: 'sum-1',
          content: 's',
          sessionId: 'sess-A',
          createdAt: '2026-04-20T00:00:00Z',
        },
      ],
    });
    consolidateMock.mockResolvedValueOnce(
      defaultConsolidatorReturn('reply', 'turn-race'),
    );

    const { stream, done } = await runCouncilTurn(
      {
        userId: 'u-race',
        sessionId: 's-race',
        mode: 'chat',
        userInput: 'hi',
        webEnabled: false,
      },
      deps,
    );
    for await (const _ of stream) void _;

    // Race `done` against a microtask-flush — if recallWritesPromise is
    // NOT awaited, `done` resolves first and we'd see writeResolved=false.
    let doneResolved = false;
    void done.then(() => {
      doneResolved = true;
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(doneResolved).toBe(false);
    expect(writeResolved).toBe(false);
    resolveWrite();
    await done;
    expect(writeResolved).toBe(true);
  });

  it('F24: surfaces recalledSummaries on done.researcher so the route can build a trailer fragment', async () => {
    researchMock.mockResolvedValueOnce({
      ok: true,
      text: 'ok',
      toolCalls: [],
      tokensIn: 0,
      tokensOut: 0,
      recalledSummaries: [
        {
          id: 'sum-99',
          content: 'remembered thing',
          sessionId: 'sess-99',
          createdAt: '2026-04-20T00:00:00Z',
        },
      ],
    });
    const { stream, done } = await runCouncilTurn(
      {
        userId: 'u-ret',
        sessionId: 's-ret',
        mode: 'chat',
        userInput: 'hi',
        webEnabled: false,
      },
      deps,
    );
    for await (const _ of stream) void _;
    const result = await done;
    expect(result.researcher.recalledSummaries).toHaveLength(1);
    expect(result.researcher.recalledSummaries[0].id).toBe('sum-99');
  });

  it('on session-cap cut (daily not hit): reportAgentError fires with failureClass "session_cap_hit"', async () => {
    const sessionRepo = {
      appendTurn: vi.fn(),
      // Session at/over its chat ceiling (10k) but daily well under cap.
      sumSessionTokens: vi.fn(async () => 10_500),
      endSession: vi.fn(async () => {}),
    } as unknown as Parameters<typeof runCouncilTurn>[1]['sessionRepo'];
    const metricsRepo = {
      record: vi.fn(async () => {}),
      listForUser: vi.fn(async () => []),
      dailyTokenTotalForUser: vi.fn(async () => 1_000),
    };

    await runCouncilTurn(
      {
        userId: 'u-sess',
        sessionId: 's-sess',
        mode: 'chat',
        userInput: 'hi',
        webEnabled: false,
      },
      {
        sessionRepo,
        memoryRepo: deps.memoryRepo,
        metricsRepo: metricsRepo as unknown as Parameters<
          typeof runCouncilTurn
        >[1]['metricsRepo'],
      },
    );

    expect(reportAgentErrorMock).toHaveBeenCalledTimes(1);
    const payload = reportAgentErrorMock.mock.calls[0][0] as {
      failureClass: string;
    };
    expect(payload.failureClass).toBe('session_cap_hit');
  });
});
