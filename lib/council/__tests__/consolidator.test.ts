import { describe, it, expect, vi } from 'vitest';
import {
  consolidate,
  classifyMode,
  CONSOLIDATOR_FAIL_SENTENCE,
} from '../consolidator';
import type { CouncilMemoryRepository } from '@/lib/persistence/council-memory-repository';
import type { SessionRepository } from '@/lib/persistence/session-repository';
import type { AnthropicLike } from '../shared/client';

/**
 * F10 Consolidator contract tests. The SDK is mocked — every test runs
 * locally and never calls Anthropic. We build small synthetic stream
 * event sources that mirror the subset of the real event shape the
 * consolidator reads.
 */

function makeMemoryRepo(): CouncilMemoryRepository {
  return {
    listSummariesForUser: vi.fn().mockResolvedValue([]),
    writeSummary: vi.fn().mockResolvedValue({}),
    writeRecall: vi.fn(),
    listRecallsForTurn: vi.fn(),
  } as unknown as CouncilMemoryRepository;
}

function makeSessionRepo(overrides: Partial<SessionRepository> = {}): SessionRepository {
  return {
    startSession: vi.fn(),
    endSession: vi.fn(),
    appendTurn: vi.fn().mockResolvedValue({}),
    listSessionsForUser: vi.fn(),
    listTurns: vi.fn(),
    ...overrides,
  } as unknown as SessionRepository;
}

type StreamEvent =
  | { type: 'content_block_delta'; delta: { type: string; text?: string } }
  | { type: 'message_delta'; usage?: { output_tokens?: number } }
  | { type: 'message_start'; message?: { usage?: { input_tokens?: number } } }
  | { type: string };

/** Build a stream that yields the given events in order and then closes. */
function makeStream(events: StreamEvent[]): AsyncIterable<StreamEvent> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const event of events) yield event;
    },
  };
}

/** Build a stream that yields a few events and then throws mid-iteration. */
function makeFailingStream(
  events: StreamEvent[],
  err: Error
): AsyncIterable<StreamEvent> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const event of events) yield event;
      throw err;
    },
  };
}

function makeClientReturning(stream: AsyncIterable<StreamEvent>): AnthropicLike {
  return {
    messages: {
      create: vi.fn().mockResolvedValue(stream),
    },
  } as unknown as AnthropicLike;
}

async function drain(stream: AsyncIterable<string>): Promise<string> {
  let out = '';
  for await (const chunk of stream) out += chunk;
  return out;
}

describe('classifyMode', () => {
  it('classifies plan-intent phrases as plan', () => {
    expect(classifyMode('Let me plan the next release')).toBe('plan');
    expect(classifyMode('help me break down this project')).toBe('plan');
    expect(classifyMode('start a new project roadmap')).toBe('plan');
  });

  it('classifies advise-intent phrases as advise', () => {
    expect(classifyMode('what do you think of this?')).toBe('advise');
    expect(classifyMode('should I ship tonight?')).toBe('advise');
    expect(classifyMode('take a look at the board')).toBe('advise');
  });

  it('falls back to chat for anything else', () => {
    expect(classifyMode('hey')).toBe('chat');
    expect(classifyMode('how are you today')).toBe('chat');
    expect(classifyMode('')).toBe('chat');
  });
});

describe('Consolidator (F10)', () => {
  it('writes the user turn before the stream is acquired', async () => {
    const order: string[] = [];
    const sessionRepo = makeSessionRepo({
      appendTurn: vi.fn().mockImplementation(async (row: { agent: string }) => {
        order.push(`append:${row.agent}`);
        return {};
      }),
    });
    const client: AnthropicLike = {
      messages: {
        create: vi.fn().mockImplementation(async () => {
          order.push('create');
          return makeStream([
            { type: 'content_block_delta', delta: { type: 'text_delta', text: 'hi' } },
          ]);
        }),
      },
    } as unknown as AnthropicLike;

    const result = await consolidate(
      { userId: 'u1', sessionId: 's1', userInput: 'hey there' },
      { client, sessionRepo, memoryRepo: makeMemoryRepo() }
    );
    await drain(result.stream);
    await result.done;

    // The user-turn append must happen before the client.messages.create call.
    expect(order[0]).toBe('append:user');
    expect(order).toContain('create');
    expect(order.indexOf('append:user')).toBeLessThan(order.indexOf('create'));
  });

  it('yields text_delta chunks in order and resolves done with joined text and usage', async () => {
    const client = makeClientReturning(
      makeStream([
        { type: 'message_start', message: { usage: { input_tokens: 7 } } },
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } },
        { type: 'content_block_delta', delta: { type: 'text_delta', text: ', ' } },
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'world.' } },
        { type: 'message_delta', usage: { output_tokens: 4 } },
      ])
    );
    const sessionRepo = makeSessionRepo();

    const result = await consolidate(
      { userId: 'u1', sessionId: 's1', userInput: 'hey' },
      { client, sessionRepo, memoryRepo: makeMemoryRepo() }
    );
    const text = await drain(result.stream);
    const outcome = await result.done;

    expect(text).toBe('Hello, world.');
    expect(outcome.text).toBe('Hello, world.');
    expect(outcome.tokensIn).toBe(7);
    expect(outcome.tokensOut).toBe(4);
    expect(outcome.mode).toBe('chat');
  });

  it('persists the assistant turn with tokens after the stream ends', async () => {
    const client = makeClientReturning(
      makeStream([
        { type: 'message_start', message: { usage: { input_tokens: 3 } } },
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'ok' } },
        { type: 'message_delta', usage: { output_tokens: 1 } },
      ])
    );
    const sessionRepo = makeSessionRepo();

    const result = await consolidate(
      { userId: 'u1', sessionId: 's1', userInput: 'hi' },
      { client, sessionRepo, memoryRepo: makeMemoryRepo() }
    );
    await drain(result.stream);
    await result.done;

    const append = sessionRepo.appendTurn as unknown as {
      mock: { calls: unknown[][] };
    };
    expect(append.mock.calls.length).toBe(2); // user + assistant
    const assistantRow = append.mock.calls[1][0] as Record<string, unknown>;
    expect(assistantRow.agent).toBe('consolidator');
    expect(assistantRow.role).toBe('assistant');
    expect(assistantRow.content).toBe('ok');
    expect(assistantRow.tokens_in).toBe(3);
    expect(assistantRow.tokens_out).toBe(1);
  });

  it('weaves researcher findings into the system prompt when provided', async () => {
    const create = vi.fn().mockResolvedValue(
      makeStream([
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'x' } },
      ])
    );
    const client = { messages: { create } } as unknown as AnthropicLike;

    const result = await consolidate(
      {
        userId: 'u1',
        sessionId: 's1',
        userInput: 'hi',
        researcherFindings: 'The board shows three lingering tasks.',
      },
      { client, sessionRepo: makeSessionRepo(), memoryRepo: makeMemoryRepo() }
    );
    await drain(result.stream);
    await result.done;

    const callArg = create.mock.calls[0][0] as { system: string };
    expect(callArg.system).toContain('Researcher finding');
    expect(callArg.system).toContain('lingering tasks');
  });

  it('retries once on acquisition failure and succeeds on the second attempt', async () => {
    const good = makeStream([
      { type: 'content_block_delta', delta: { type: 'text_delta', text: 'later' } },
    ]);
    const create = vi
      .fn()
      .mockRejectedValueOnce(new Error('transient 500'))
      .mockResolvedValueOnce(good);
    const client = { messages: { create } } as unknown as AnthropicLike;

    const log = vi.fn();
    const result = await consolidate(
      { userId: 'u1', sessionId: 's1', userInput: 'hi' },
      { client, sessionRepo: makeSessionRepo(), memoryRepo: makeMemoryRepo(), log }
    );
    const text = await drain(result.stream);
    await result.done;

    expect(text).toBe('later');
    expect(create).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledWith(
      expect.stringMatching(/attempt 1 failed/),
      expect.any(Error)
    );
  });

  it('surfaces the fail sentence after two acquisition failures', async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'));
    const client = { messages: { create } } as unknown as AnthropicLike;

    const log = vi.fn();
    const sessionRepo = makeSessionRepo();
    const result = await consolidate(
      { userId: 'u1', sessionId: 's1', userInput: 'hi' },
      { client, sessionRepo, memoryRepo: makeMemoryRepo(), log }
    );
    const text = await drain(result.stream);
    const outcome = await result.done;

    expect(text).toBe(CONSOLIDATOR_FAIL_SENTENCE);
    expect(outcome.text).toBe(CONSOLIDATOR_FAIL_SENTENCE);
    expect(outcome.tokensIn).toBe(0);
    expect(outcome.tokensOut).toBe(0);

    // Both user turn and fail-sentence assistant turn are persisted.
    const append = sessionRepo.appendTurn as unknown as {
      mock: { calls: unknown[][] };
    };
    expect(append.mock.calls.length).toBe(2);
    const assistantRow = append.mock.calls[1][0] as Record<string, unknown>;
    expect(assistantRow.content).toBe(CONSOLIDATOR_FAIL_SENTENCE);
  });

  it('recovers mid-stream errors by appending the fail sentence to the reply', async () => {
    const client = makeClientReturning(
      makeFailingStream(
        [
          { type: 'content_block_delta', delta: { type: 'text_delta', text: 'partial' } },
        ],
        new Error('mid-stream boom')
      )
    );
    const log = vi.fn();

    const result = await consolidate(
      { userId: 'u1', sessionId: 's1', userInput: 'hi' },
      { client, sessionRepo: makeSessionRepo(), memoryRepo: makeMemoryRepo(), log }
    );
    const text = await drain(result.stream);
    await result.done;

    expect(text.startsWith('partial')).toBe(true);
    expect(text).toContain(CONSOLIDATOR_FAIL_SENTENCE);
    expect(log).toHaveBeenCalledWith(
      expect.stringMatching(/mid-stream error/),
      expect.any(Error)
    );
  });

  it('schedules a session-pending summary via memoryRepo (cold path, best effort)', async () => {
    const client = makeClientReturning(
      makeStream([
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'k' } },
      ])
    );
    const memoryRepo = makeMemoryRepo();

    const result = await consolidate(
      { userId: 'u1', sessionId: 's1', userInput: 'hi' },
      { client, sessionRepo: makeSessionRepo(), memoryRepo }
    );
    await drain(result.stream);
    await result.done;
    // Let the queued microtask settle.
    await new Promise((r) => setTimeout(r, 0));

    const writeSummary = memoryRepo.writeSummary as unknown as {
      mock: { calls: unknown[][] };
    };
    expect(writeSummary.mock.calls.length).toBe(1);
    const row = writeSummary.mock.calls[0][0] as Record<string, unknown>;
    expect(row.kind).toBe('session-pending');
    expect(row.user_id).toBe('u1');
    expect(row.session_id).toBe('s1');
  });

  it('does not throw when the memory-summary cold-path write fails', async () => {
    const client = makeClientReturning(
      makeStream([
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'ok' } },
      ])
    );
    const memoryRepo = {
      listSummariesForUser: vi.fn().mockResolvedValue([]),
      writeSummary: vi.fn().mockRejectedValue(new Error('db down')),
      writeRecall: vi.fn(),
      listRecallsForTurn: vi.fn(),
    } as unknown as CouncilMemoryRepository;
    const log = vi.fn();

    const result = await consolidate(
      { userId: 'u1', sessionId: 's1', userInput: 'hi' },
      { client, sessionRepo: makeSessionRepo(), memoryRepo, log }
    );
    const text = await drain(result.stream);
    await result.done;
    await new Promise((r) => setTimeout(r, 0));

    expect(text).toBe('ok');
    expect(log).toHaveBeenCalledWith(
      expect.stringMatching(/scheduleSummary best-effort failed/),
      expect.any(Error)
    );
  });

  it('swallows user-turn write failures so the user-facing reply still streams', async () => {
    const client = makeClientReturning(
      makeStream([
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'still here' } },
      ])
    );
    const log = vi.fn();
    const sessionRepo = makeSessionRepo({
      appendTurn: vi.fn().mockRejectedValue(new Error('db down')),
    });

    const result = await consolidate(
      { userId: 'u1', sessionId: 's1', userInput: 'hi' },
      { client, sessionRepo, memoryRepo: makeMemoryRepo(), log }
    );
    const text = await drain(result.stream);
    await result.done;

    expect(text).toBe('still here');
    expect(log).toHaveBeenCalledWith(
      expect.stringMatching(/turn write failed/),
      expect.any(Error)
    );
  });

  it('uses the explicit mode override when provided instead of classifying', async () => {
    const create = vi.fn().mockResolvedValue(
      makeStream([
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'k' } },
      ])
    );
    const client = { messages: { create } } as unknown as AnthropicLike;

    const result = await consolidate(
      {
        userId: 'u1',
        sessionId: 's1',
        userInput: 'random text with no plan words',
        mode: 'plan',
      },
      { client, sessionRepo: makeSessionRepo(), memoryRepo: makeMemoryRepo() }
    );
    await drain(result.stream);
    const outcome = await result.done;

    expect(outcome.mode).toBe('plan');
    const callArg = create.mock.calls[0][0] as { system: string };
    expect(callArg.system).toContain('Mode: Plan');
  });
});
