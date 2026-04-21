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

import { runCouncilTurn } from '../dispatch';

function makeStream(chunks: string[]): AsyncIterable<string> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const c of chunks) yield c;
    },
  };
}

function defaultConsolidatorReturn(text = 'council reply') {
  return {
    stream: makeStream([text]),
    done: Promise.resolve({ text, mode: 'chat', tokensIn: 0, tokensOut: 0 }),
  };
}

const deps = {
  sessionRepo: { appendTurn: vi.fn() } as unknown as Parameters<typeof runCouncilTurn>[1]['sessionRepo'],
  memoryRepo: {
    listSummariesForUser: vi.fn().mockResolvedValue([]),
    writeSummary: vi.fn(),
  } as unknown as Parameters<typeof runCouncilTurn>[1]['memoryRepo'],
};

describe('runCouncilTurn', () => {
  beforeEach(() => {
    researchMock.mockReset();
    consolidateMock.mockReset();
    critiqueMock.mockReset();
    researchMock.mockResolvedValue({
      ok: true,
      text: 'found: the docs say X',
      toolCalls: [],
      tokensIn: 5,
      tokensOut: 10,
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
});
