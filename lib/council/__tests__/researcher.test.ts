import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  research,
  RESEARCHER_FAIL_SENTENCE,
  __resetWebRateLimitForTests,
} from '../researcher';
import type { CouncilMemoryRepository } from '@/lib/persistence/council-memory-repository';
import type { SessionRepository } from '@/lib/persistence/session-repository';
import type { AnthropicLike } from '../shared/client';

/**
 * F09 Researcher contract tests. The SDK is mocked — every test runs
 * locally and never calls Anthropic.
 */

function makeMemoryRepo(summaries: { content: string }[] = []): CouncilMemoryRepository {
  return {
    listSummariesForUser: vi.fn().mockResolvedValue(summaries),
    writeSummary: vi.fn(),
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

function makeClient(response: unknown): AnthropicLike {
  return {
    messages: {
      create: vi.fn().mockResolvedValue(response),
    },
  } as unknown as AnthropicLike;
}

const textResponse = {
  content: [{ type: 'text', text: 'The board shows three lingering tasks.' }],
  usage: { input_tokens: 42, output_tokens: 13 },
};

beforeEach(() => {
  __resetWebRateLimitForTests();
});

describe('Researcher (F09)', () => {
  it('returns an ok finding with text, token counts and an empty tool-call list (memory-only)', async () => {
    const memoryRepo = makeMemoryRepo([{ content: 'Yesterday felt heavy.' }]);
    const sessionRepo = makeSessionRepo();
    const client = makeClient(textResponse);

    const finding = await research(
      {
        userId: 'u1',
        sessionId: 's1',
        mode: 'chat',
        query: 'How am I doing?',
        boardSnapshot: [
          {
            id: 't1',
            title: 'Ship v0.4 alpha',
            board_column: 'in_progress',
            overdue_at: null,
          },
        ],
        webEnabled: false,
      },
      { client, sessionRepo, memoryRepo }
    );

    expect(finding.ok).toBe(true);
    expect(finding.text).toContain('lingering');
    expect(finding.toolCalls).toEqual([]);
    expect(finding.tokensIn).toBe(42);
    expect(finding.tokensOut).toBe(13);

    // Memory-only path: no `tools` key in the Anthropic call.
    const callArg = (client.messages.create as unknown as { mock: { calls: unknown[][] } })
      .mock.calls[0][0] as Record<string, unknown>;
    expect(callArg.tools).toBeUndefined();
  });

  it('attaches the web_search tool in Plan mode when web is enabled', async () => {
    const client = makeClient(textResponse);
    await research(
      {
        userId: 'u1',
        sessionId: 's1',
        mode: 'plan',
        query: 'Compare two frameworks',
        webEnabled: true,
      },
      { client, sessionRepo: makeSessionRepo(), memoryRepo: makeMemoryRepo() }
    );
    const callArg = (client.messages.create as unknown as { mock: { calls: unknown[][] } })
      .mock.calls[0][0] as Record<string, unknown>;
    expect(callArg.tools).toEqual([
      { type: 'web_search_20250305', name: 'web_search' },
    ]);
  });

  it('persists the researcher turn via SessionRepository.appendTurn', async () => {
    const sessionRepo = makeSessionRepo();
    const client = makeClient(textResponse);
    await research(
      {
        userId: 'u1',
        sessionId: 's1',
        mode: 'chat',
        query: 'Hello',
        webEnabled: false,
      },
      { client, sessionRepo, memoryRepo: makeMemoryRepo() }
    );
    const append = sessionRepo.appendTurn as unknown as {
      mock: { calls: unknown[][] };
    } & ((...args: unknown[]) => unknown);
    expect(append).toHaveBeenCalledTimes(1);
    const row = append.mock.calls[0][0] as Record<string, unknown>;
    expect(row.session_id).toBe('s1');
    expect(row.user_id).toBe('u1');
    expect(row.agent).toBe('researcher');
    expect(row.tokens_in).toBe(42);
    expect(row.tokens_out).toBe(13);
  });

  it('captures tool_use blocks into tool_calls when the model uses the web tool', async () => {
    const client = makeClient({
      content: [
        {
          type: 'tool_use',
          id: 'tu_1',
          name: 'web_search',
          input: { query: 'nextjs 14 streaming' },
        },
        { type: 'text', text: 'Nothing decisive found.' },
      ],
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    const sessionRepo = makeSessionRepo();
    const finding = await research(
      {
        userId: 'u1',
        sessionId: 's1',
        mode: 'plan',
        query: 'q',
        webEnabled: true,
      },
      { client, sessionRepo, memoryRepo: makeMemoryRepo() }
    );
    expect(finding.toolCalls).toEqual([
      { id: 'tu_1', name: 'web_search', input: { query: 'nextjs 14 streaming' } },
    ]);
    const row = (sessionRepo.appendTurn as unknown as { mock: { calls: unknown[][] } })
      .mock.calls[0][0] as Record<string, unknown>;
    expect(row.role).toBe('tool');
  });

  it('fails visible on SDK error — returns the honest sentence, not throw', async () => {
    const log = vi.fn();
    const client: AnthropicLike = {
      messages: { create: vi.fn().mockRejectedValue(new Error('429 rate limit')) },
    } as unknown as AnthropicLike;
    const finding = await research(
      {
        userId: 'u1',
        sessionId: 's1',
        mode: 'chat',
        query: 'q',
        webEnabled: false,
      },
      { client, sessionRepo: makeSessionRepo(), memoryRepo: makeMemoryRepo(), log }
    );
    expect(finding.ok).toBe(false);
    expect(finding.text).toBe(RESEARCHER_FAIL_SENTENCE);
    expect(log).toHaveBeenCalled();
  });

  it('enforces the 10-calls-per-session web rate limit with a calm one-liner', async () => {
    const client = makeClient(textResponse);
    const deps = {
      client,
      sessionRepo: makeSessionRepo(),
      memoryRepo: makeMemoryRepo(),
    };
    for (let i = 0; i < 10; i++) {
      const f = await research(
        { userId: 'u', sessionId: 'S', mode: 'plan', query: 'q', webEnabled: true },
        deps
      );
      expect(f.ok).toBe(true);
    }
    // 11th call: still ok (fail-visible means nothing throws) but
    // text is the rate-limit sentence and no Anthropic call is made.
    const before = (client.messages.create as unknown as { mock: { calls: unknown[][] } }).mock.calls.length;
    const capped = await research(
      { userId: 'u', sessionId: 'S', mode: 'plan', query: 'q', webEnabled: true },
      deps
    );
    expect(capped.ok).toBe(true);
    expect(capped.text).toMatch(/web-research limit/);
    expect((client.messages.create as unknown as { mock: { calls: unknown[][] } }).mock.calls.length).toBe(before);
  });

  it('swallows session-write failures (fail-visible turns on the user-facing path only)', async () => {
    const log = vi.fn();
    const sessionRepo = makeSessionRepo({
      appendTurn: vi.fn().mockRejectedValue(new Error('db down')),
    });
    const client = makeClient(textResponse);
    const finding = await research(
      {
        userId: 'u1',
        sessionId: 's1',
        mode: 'chat',
        query: 'q',
        webEnabled: false,
      },
      { client, sessionRepo, memoryRepo: makeMemoryRepo(), log }
    );
    expect(finding.ok).toBe(true);
    expect(finding.text).toContain('lingering');
    expect(log).toHaveBeenCalledWith(
      expect.stringMatching(/turn write failed/),
      expect.any(Error)
    );
  });
});
