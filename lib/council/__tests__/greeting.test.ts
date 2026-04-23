import { describe, it, expect, vi } from 'vitest';
import {
  deriveGreetingSignals,
  capGreeting,
  composeFullGreeting,
  shortReentryLine,
  GREETING_FAIL_SENTENCE,
  GREETING_MAX_CHARS,
  GREETING_STALENESS_HORIZON_DAYS,
} from '../greeting';
import type { CouncilMemoryRepository } from '@/lib/persistence/council-memory-repository';
import type { AnthropicLike } from '../shared/client';

/**
 * F14 greeting contract tests. The module is pure except for the
 * stream call, which we mock — no network.
 */

function memoryRepo(summaries: { content: string }[] = []): CouncilMemoryRepository {
  return {
    listSummariesForUser: vi.fn().mockResolvedValue(summaries),
    writeSummary: vi.fn(),
    writeRecall: vi.fn(),
    listRecallsForTurn: vi.fn(),
  } as unknown as CouncilMemoryRepository;
}

function makeStreamClient(chunks: string[]): AnthropicLike {
  async function* gen() {
    yield { type: 'message_start', message: { usage: { input_tokens: 10 } } };
    for (const c of chunks) {
      yield {
        type: 'content_block_delta',
        delta: { type: 'text_delta', text: c },
      };
    }
    yield { type: 'message_delta', usage: { output_tokens: 5 } };
  }
  return {
    messages: {
      create: vi.fn(async () => gen() as unknown as AsyncIterable<unknown>),
    },
  } as unknown as AnthropicLike;
}

describe('deriveGreetingSignals (F14)', () => {
  const now = new Date('2026-04-21T12:00:00Z');
  const fresh = '2026-04-20T00:00:00Z';
  const ancient = '2025-01-01T00:00:00Z';

  it('counts columns and overdue, returns top-1 overdue title', () => {
    const signals = deriveGreetingSignals(
      {
        tasks: [
          { id: '1', title: 'A', board_column: 'todo', overdue_at: null, created_at: fresh },
          { id: '2', title: 'B', board_column: 'in_progress', overdue_at: '2026-04-19T00:00:00Z', created_at: fresh },
          { id: '3', title: 'C', board_column: 'done', overdue_at: null, created_at: fresh },
          { id: '4', title: 'D', board_column: 'todo', overdue_at: '2026-04-18T00:00:00Z', created_at: fresh },
        ],
        daysSinceLastSession: 2,
      },
      now,
    );
    expect(signals.todo).toBe(2);
    expect(signals.inProgress).toBe(1);
    expect(signals.done).toBe(1);
    expect(signals.overdue).toBe(2);
    // Top-1 overdue = the one with the earliest overdue_at → 'D'.
    expect(signals.topOverdueTitle).toBe('D');
    expect(signals.daysSinceLastSession).toBe(2);
  });

  it(`never cites cards older than ${GREETING_STALENESS_HORIZON_DAYS} days (staleness horizon)`, () => {
    const signals = deriveGreetingSignals(
      {
        tasks: [
          { id: '1', title: 'Stale', board_column: 'todo', overdue_at: '2024-01-01T00:00:00Z', created_at: ancient },
          { id: '2', title: 'Fresh', board_column: 'todo', overdue_at: null, created_at: fresh },
        ],
        daysSinceLastSession: 1,
      },
      now,
    );
    expect(signals.todo).toBe(1);
    expect(signals.overdue).toBe(0);
    expect(signals.topOverdueTitle).toBeNull();
  });

  it('genericizes top-1 overdue title when it exceeds 40 characters', () => {
    const longTitle =
      'a very long title that should not be quoted directly in the greeting for privacy';
    const signals = deriveGreetingSignals(
      {
        tasks: [
          {
            id: '1',
            title: longTitle,
            board_column: 'todo',
            overdue_at: '2026-04-19T00:00:00Z',
            created_at: fresh,
          },
        ],
        daysSinceLastSession: 1,
      },
      now,
    );
    expect(signals.topOverdueTitle).toBe('a long-running card');
  });
});

describe('capGreeting (F14)', () => {
  it(`trims to <= ${GREETING_MAX_CHARS} characters`, () => {
    const long = 'Good morning. '.repeat(50);
    const out = capGreeting(long);
    expect(out.length).toBeLessThanOrEqual(GREETING_MAX_CHARS);
  });

  it('keeps at most two sentences', () => {
    const three = 'First. Second. Third.';
    const out = capGreeting(three);
    expect(out).toBe('First. Second.');
  });

  it('returns the fail sentence on empty input', () => {
    expect(capGreeting('   ')).toBe(GREETING_FAIL_SENTENCE);
  });

  it('backs off to the last word boundary when truncating', () => {
    const long = 'a'.repeat(210) + ' tail';
    const out = capGreeting(long);
    expect(out.length).toBeLessThanOrEqual(GREETING_MAX_CHARS);
    expect(out.endsWith('…')).toBe(true);
  });
});

describe('composeFullGreeting (F14)', () => {
  const signals = {
    todo: 2,
    inProgress: 1,
    done: 3,
    overdue: 1,
    topOverdueTitle: 'Ship v0.4',
    daysSinceLastSession: 1,
  };

  it('streams chunks under the cap verbatim and exposes token totals', async () => {
    const chunks = ['Good morning. ', 'Three things still to pick up.'];
    const client = makeStreamClient(chunks);
    const { stream, done } = await composeFullGreeting(
      { userId: 'u1', signals },
      { client, memoryRepo: memoryRepo([{ content: 'yesterday felt busy' }]) },
    );
    const received: string[] = [];
    for await (const c of stream) received.push(c);
    const result = await done;
    expect(received.join('')).toBe(chunks.join(''));
    expect(result.text.length).toBeLessThanOrEqual(GREETING_MAX_CHARS);
    expect(result.tokensIn).toBe(10);
    expect(result.tokensOut).toBe(5);
  });

  it('caps the STREAMED output at 2 sentences — extra sentences never reach the client', async () => {
    const chunks = ['Good morning. ', 'Three things still to pick up. ', 'Start with Ship v0.4.'];
    const client = makeStreamClient(chunks);
    const { stream, done } = await composeFullGreeting(
      { userId: 'u1', signals },
      { client, memoryRepo: memoryRepo() },
    );
    const received: string[] = [];
    for await (const c of stream) received.push(c);
    const joined = received.join('');
    expect(joined).not.toContain('Ship v0.4');
    // Only two sentence terminators should have reached the client.
    expect(joined.match(/[.!?]/g)?.length ?? 0).toBeLessThanOrEqual(2);
    const out = await done;
    expect(out.text.length).toBeLessThanOrEqual(GREETING_MAX_CHARS);
  });

  it('caps the STREAMED output at 200 chars with a graceful ellipsis', async () => {
    const long = 'a'.repeat(250);
    const client = makeStreamClient([long]);
    const { stream } = await composeFullGreeting(
      { userId: 'u1', signals },
      { client, memoryRepo: memoryRepo() },
    );
    const received: string[] = [];
    for await (const c of stream) received.push(c);
    const joined = received.join('');
    expect(joined.length).toBeLessThanOrEqual(GREETING_MAX_CHARS);
    expect(joined.endsWith('…')).toBe(true);
  });

  it('never attaches a web tool on the greeting call (memory-only hot path)', async () => {
    const client = makeStreamClient(['ok.']);
    await composeFullGreeting(
      { userId: 'u1', signals },
      { client, memoryRepo: memoryRepo() },
    );
    const callArg = (client.messages.create as unknown as { mock: { calls: unknown[][] } })
      .mock.calls[0][0] as Record<string, unknown>;
    expect(callArg.tools).toBeUndefined();
    // Streaming greeting is always streamed (thinking-stream consumes it).
    expect(callArg.stream).toBe(true);
  });

  it('degrades gracefully when the memory repo throws (unimplemented stub)', async () => {
    const log = vi.fn();
    const thrower = {
      listSummariesForUser: vi.fn().mockRejectedValue(new Error('stub: F18')),
      writeSummary: vi.fn(),
      writeRecall: vi.fn(),
      listRecallsForTurn: vi.fn(),
    } as unknown as CouncilMemoryRepository;
    const client = makeStreamClient(['Good morning.']);
    const { stream, done } = await composeFullGreeting(
      { userId: 'u1', signals },
      { client, memoryRepo: thrower, log },
    );
    for await (const _ of stream) void _;
    const out = await done;
    expect(out.text.length).toBeGreaterThan(0);
    expect(log).toHaveBeenCalledWith(
      expect.stringMatching(/memory read unavailable/),
      expect.any(Error),
    );
  });

  it('falls back to the fail sentence when the SDK throws', async () => {
    // F30: a 429 retries through the backoff schedule before
    // surfacing. Inject a zero-sleep so the test doesn't wait real
    // wall-clock for the ~30s budget to exhaust.
    const client = {
      messages: {
        create: vi.fn().mockRejectedValue(new Error('429 rate limit')),
      },
    } as unknown as AnthropicLike;
    const { stream, done } = await composeFullGreeting(
      { userId: 'u1', signals },
      { client, memoryRepo: memoryRepo(), retrySleep: async () => {} },
    );
    const received: string[] = [];
    for await (const c of stream) received.push(c);
    expect(received.join('')).toBe(GREETING_FAIL_SENTENCE);
    const out = await done;
    expect(out.text).toBe(GREETING_FAIL_SENTENCE);
  });
});

describe('shortReentryLine (F14)', () => {
  it('returns a calm welcome-back line by default', () => {
    expect(
      shortReentryLine({
        todo: 0,
        inProgress: 0,
        done: 0,
        overdue: 0,
        topOverdueTitle: null,
        daysSinceLastSession: 0,
      }),
    ).toBe('Welcome back.');
  });

  it('flags overdue when there is nothing in progress', () => {
    const line = shortReentryLine({
      todo: 1,
      inProgress: 0,
      done: 0,
      overdue: 2,
      topOverdueTitle: 'X',
      daysSinceLastSession: 0,
    });
    expect(line).toMatch(/past due/i);
  });
});
