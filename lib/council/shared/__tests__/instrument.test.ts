import { describe, it, expect, vi } from 'vitest';
import type { MetricsRepository } from '@/lib/persistence/metrics-repository';
import { classifyOutcome, recordMetric } from '../instrument';

function makeRepo(): MetricsRepository & { record: ReturnType<typeof vi.fn> } {
  return {
    record: vi.fn(async () => {}),
    listForUser: vi.fn(async () => []),
    dailyTokenTotalForUser: vi.fn(async () => 0),
  } as unknown as MetricsRepository & { record: ReturnType<typeof vi.fn> };
}

describe('recordMetric', () => {
  it('maps args into the repository record payload', async () => {
    const repo = makeRepo();
    await recordMetric(
      {
        userId: 'u',
        sessionId: 's',
        agent: 'consolidator',
        callStartedAt: '2026-04-22T00:00:00Z',
        firstTokenMs: 120,
        fullReplyMs: 400,
        tokensIn: 10,
        tokensOut: 20,
        outcome: 'ok',
      },
      { metricsRepo: repo },
    );
    expect(repo.record).toHaveBeenCalledWith({
      user_id: 'u',
      session_id: 's',
      agent: 'consolidator',
      call_started_at: '2026-04-22T00:00:00Z',
      first_token_ms: 120,
      full_reply_ms: 400,
      tokens_in: 10,
      tokens_out: 20,
      outcome: 'ok',
    });
  });

  it('swallows and logs repo errors (fire-and-forget)', async () => {
    const log = vi.fn();
    const repo = makeRepo();
    repo.record.mockRejectedValueOnce(new Error('db down'));
    await expect(
      recordMetric(
        {
          userId: 'u',
          sessionId: null,
          agent: 'researcher',
          callStartedAt: '2026-04-22T00:00:00Z',
          firstTokenMs: null,
          fullReplyMs: 200,
          tokensIn: 0,
          tokensOut: 0,
          outcome: 'error',
        },
        { metricsRepo: repo, log },
      ),
    ).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith(
      'instrument: metrics write failed (swallowed)',
      expect.any(Error),
    );
  });
});

describe('classifyOutcome', () => {
  it('detects rate-limited via 429 or "rate limit"', () => {
    expect(classifyOutcome(new Error('429 Too Many Requests'))).toBe('rate_limited');
    expect(classifyOutcome(new Error('hit the rate-limit'))).toBe('rate_limited');
  });

  it('falls through to error', () => {
    expect(classifyOutcome(new Error('boom'))).toBe('error');
    expect(classifyOutcome('weird string')).toBe('error');
  });
});
