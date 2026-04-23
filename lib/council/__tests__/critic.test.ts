import { describe, it, expect, vi } from 'vitest';
import { critique } from '../critic';
import {
  classifyDraftRisk,
  shouldDispatchCritic,
  readConfiguredThreshold,
  estimateTokenCount,
  LONG_DRAFT_TOKEN_THRESHOLD,
} from '../shared/risk';
import type { SessionRepository } from '@/lib/persistence/session-repository';
import type { AnthropicLike } from '../shared/client';

/**
 * F11 Critic contract tests. Fully local — Anthropic is mocked and the
 * risk heuristic is deterministic.
 */

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

const reviewResponse = {
  content: [{ type: 'text', text: 'Draft looks measured; no concerns.' }],
  usage: { input_tokens: 30, output_tokens: 7 },
};

describe('classifyDraftRisk', () => {
  it('returns low for ordinary chat text', () => {
    expect(classifyDraftRisk('Sure, that sounds good.')).toBe('low');
    expect(classifyDraftRisk('How are you feeling today?')).toBe('low');
  });

  it('returns medium for commitment or fact-heavy drafts', () => {
    expect(classifyDraftRisk('You should ship this week.')).toBe('medium');
    expect(classifyDraftRisk('I recommend the second option.')).toBe('medium');
    expect(classifyDraftRisk('Launch is on 12/05.')).toBe('medium');
  });

  it('returns high for destructive or strongly committed language', () => {
    expect(classifyDraftRisk('I will delete the old branch.')).toBe('high');
    expect(classifyDraftRisk('Let me wipe the current board.')).toBe('high');
    expect(classifyDraftRisk('I guarantee it will ship tonight.')).toBe('high');
  });

  it('handles empty or whitespace input gracefully', () => {
    expect(classifyDraftRisk('')).toBe('low');
    expect(classifyDraftRisk('   ')).toBe('low');
  });

  it('escalates drafts longer than ~200 tokens to medium (PRD §9.2)', () => {
    // Build a draft with no magic words that comfortably clears the
    // 200-token estimate. 'xyzzy ' is six safe chars, so 250 repeats
    // is ~1500 chars ≈ 375 tokens — well past LONG_DRAFT_TOKEN_THRESHOLD.
    const longSafeDraft = 'xyzzy '.repeat(250);
    expect(estimateTokenCount(longSafeDraft)).toBeGreaterThan(
      LONG_DRAFT_TOKEN_THRESHOLD
    );
    expect(classifyDraftRisk(longSafeDraft)).toBe('medium');
  });

  it('keeps a short word-word draft at low', () => {
    // Just under the threshold, no magic words.
    const shortDraft = 'ok, that works for me.';
    expect(estimateTokenCount(shortDraft)).toBeLessThan(
      LONG_DRAFT_TOKEN_THRESHOLD
    );
    expect(classifyDraftRisk(shortDraft)).toBe('low');
  });

  it('keeps high when a long draft also contains destructive language', () => {
    const longHighDraft =
      'I will delete the old branch. ' + 'padding text '.repeat(80);
    expect(estimateTokenCount(longHighDraft)).toBeGreaterThan(
      LONG_DRAFT_TOKEN_THRESHOLD
    );
    expect(classifyDraftRisk(longHighDraft)).toBe('high');
  });
});

describe('shouldDispatchCritic', () => {
  it('dispatches when risk meets threshold', () => {
    expect(shouldDispatchCritic('medium', 'medium')).toBe(true);
    expect(shouldDispatchCritic('high', 'medium')).toBe(true);
    expect(shouldDispatchCritic('high', 'high')).toBe(true);
  });

  it('does not dispatch when risk is below threshold', () => {
    expect(shouldDispatchCritic('low', 'medium')).toBe(false);
    expect(shouldDispatchCritic('medium', 'high')).toBe(false);
    expect(shouldDispatchCritic('low', 'high')).toBe(false);
  });
});

describe('readConfiguredThreshold', () => {
  it('defaults to medium when env is unset or invalid', () => {
    const prev = process.env.COUNCIL_CRITIC_RISK_THRESHOLD;
    delete process.env.COUNCIL_CRITIC_RISK_THRESHOLD;
    expect(readConfiguredThreshold()).toBe('medium');
    process.env.COUNCIL_CRITIC_RISK_THRESHOLD = 'bogus';
    expect(readConfiguredThreshold()).toBe('medium');
    if (prev === undefined) delete process.env.COUNCIL_CRITIC_RISK_THRESHOLD;
    else process.env.COUNCIL_CRITIC_RISK_THRESHOLD = prev;
  });

  it('honours valid env values', () => {
    const prev = process.env.COUNCIL_CRITIC_RISK_THRESHOLD;
    process.env.COUNCIL_CRITIC_RISK_THRESHOLD = 'low';
    expect(readConfiguredThreshold()).toBe('low');
    process.env.COUNCIL_CRITIC_RISK_THRESHOLD = 'high';
    expect(readConfiguredThreshold()).toBe('high');
    if (prev === undefined) delete process.env.COUNCIL_CRITIC_RISK_THRESHOLD;
    else process.env.COUNCIL_CRITIC_RISK_THRESHOLD = prev;
  });
});

describe('critique (F11 dispatch)', () => {
  it('skips Anthropic when risk is below threshold', async () => {
    const client = makeClient(reviewResponse);
    const sessionRepo = makeSessionRepo();
    const result = await critique(
      {
        userId: 'u1',
        sessionId: 's1',
        draft: 'Sure, nice chat.',
        threshold: 'medium',
      },
      { client, sessionRepo }
    );
    expect(result.ran).toBe(false);
    expect(result.risk).toBe('low');
    expect(result.review).toBeNull();
    expect(client.messages.create).not.toHaveBeenCalled();
    expect(sessionRepo.appendTurn).not.toHaveBeenCalled();
  });

  it('dispatches and returns the review when risk meets threshold', async () => {
    const client = makeClient(reviewResponse);
    const sessionRepo = makeSessionRepo();
    const result = await critique(
      {
        userId: 'u1',
        sessionId: 's1',
        draft: 'You should ship this week.',
        threshold: 'medium',
      },
      { client, sessionRepo }
    );
    expect(result.ran).toBe(true);
    expect(result.risk).toBe('medium');
    expect(result.review).toContain('measured');
    expect(result.tokensIn).toBe(30);
    expect(result.tokensOut).toBe(7);
    expect(client.messages.create).toHaveBeenCalledTimes(1);
  });

  it('persists the critic turn via appendTurn when the review runs', async () => {
    const client = makeClient(reviewResponse);
    const sessionRepo = makeSessionRepo();
    await critique(
      {
        userId: 'u1',
        sessionId: 's1',
        draft: 'I will delete the old branch.',
        threshold: 'medium',
      },
      { client, sessionRepo }
    );
    const append = sessionRepo.appendTurn as unknown as {
      mock: { calls: unknown[][] };
    };
    expect(append.mock.calls.length).toBe(1);
    const row = append.mock.calls[0][0] as Record<string, unknown>;
    expect(row.agent).toBe('critic');
    expect(row.role).toBe('assistant');
    expect(row.tokens_in).toBe(30);
    expect(row.tokens_out).toBe(7);
  });

  it('fails quiet on Anthropic error: no throw, errorHook called, no review', async () => {
    const err = new Error('Anthropic 429 rate limited');
    const client: AnthropicLike = {
      messages: { create: vi.fn().mockRejectedValue(err) },
    } as unknown as AnthropicLike;
    const errorHook = vi.fn();
    const log = vi.fn();

    // F30: a 429 retries through the backoff schedule before surfacing.
    // Inject a zero-sleep so the test doesn't wait real wall-clock for
    // the ~30s budget to exhaust.
    const result = await critique(
      {
        userId: 'u1',
        sessionId: 's1',
        draft: 'You should ship this week.',
        threshold: 'medium',
      },
      {
        client,
        sessionRepo: makeSessionRepo(),
        errorHook,
        log,
        retrySleep: async () => {},
      }
    );

    expect(result.ran).toBe(false);
    expect(result.risk).toBe('medium'); // risk is still tagged
    expect(result.review).toBeNull();
    expect(errorHook).toHaveBeenCalledTimes(1);
    expect(errorHook).toHaveBeenCalledWith(
      expect.objectContaining({
        failureClass: 'anthropic_429',
        message: expect.stringMatching(/429/),
      })
    );
    expect(log).toHaveBeenCalledWith(
      expect.stringMatching(/fail-quiet/),
      expect.any(Error)
    );
  });

  it('maps unknown errors to the unknown failure class', async () => {
    const client: AnthropicLike = {
      messages: { create: vi.fn().mockRejectedValue(new Error('eacces')) },
    } as unknown as AnthropicLike;
    const errorHook = vi.fn();

    const result = await critique(
      {
        userId: 'u1',
        sessionId: 's1',
        draft: 'I will delete the whole queue.',
        threshold: 'medium',
      },
      { client, sessionRepo: makeSessionRepo(), errorHook }
    );

    expect(result.ran).toBe(false);
    expect(errorHook).toHaveBeenCalledWith(
      expect.objectContaining({ failureClass: 'unknown' })
    );
  });

  it('swallows session-write failures (fail-quiet on the persistence path too)', async () => {
    const sessionRepo = makeSessionRepo({
      appendTurn: vi.fn().mockRejectedValue(new Error('db down')),
    });
    const client = makeClient(reviewResponse);
    const log = vi.fn();

    const result = await critique(
      {
        userId: 'u1',
        sessionId: 's1',
        draft: 'You should ship this week.',
        threshold: 'medium',
      },
      { client, sessionRepo, log }
    );

    expect(result.ran).toBe(true);
    expect(result.review).toContain('measured');
    expect(log).toHaveBeenCalledWith(
      expect.stringMatching(/turn write failed/),
      expect.any(Error)
    );
  });

  it('honours an explicit threshold override over the env default', async () => {
    const client = makeClient(reviewResponse);
    const sessionRepo = makeSessionRepo();
    // 'low' draft with explicit threshold 'low' forces dispatch.
    const result = await critique(
      {
        userId: 'u1',
        sessionId: 's1',
        draft: 'Sure, nice chat.',
        threshold: 'low',
      },
      { client, sessionRepo }
    );
    expect(result.risk).toBe('low');
    expect(result.ran).toBe(true);
    expect(client.messages.create).toHaveBeenCalledTimes(1);
  });
});
