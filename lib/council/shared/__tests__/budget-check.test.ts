import { describe, it, expect, vi } from 'vitest';
import type { SessionRepository } from '@/lib/persistence/session-repository';
import type { MetricsRepository } from '@/lib/persistence/metrics-repository';
import { checkBudget, BUDGET_CUT_SENTENCE, BUDGET_CUT_SENTENCE_DAILY } from '../budget-check';

function makeSession(total: number): SessionRepository {
  return {
    sumSessionTokens: vi.fn(async () => total),
  } as unknown as SessionRepository;
}
function makeMetrics(total: number): MetricsRepository {
  return {
    dailyTokenTotalForUser: vi.fn(async () => total),
  } as unknown as MetricsRepository;
}

describe('checkBudget', () => {
  it('returns ok when both counters are well under', async () => {
    const r = await checkBudget(
      { userId: 'u', sessionId: 's', mode: 'chat' },
      {
        sessionRepo: makeSession(1_000),
        metricsRepo: makeMetrics(10_000),
        dailyCap: 500_000,
      },
    );
    expect(r.verdict).toBe('ok');
    expect(r.banner).toBeNull();
    expect(r.cutSentence).toBeNull();
  });

  it('returns warn at >= 80% of session ceiling', async () => {
    const r = await checkBudget(
      { userId: 'u', sessionId: 's', mode: 'chat' },
      {
        sessionRepo: makeSession(9_000), // 90% of 10k
        metricsRepo: makeMetrics(0),
        dailyCap: 500_000,
      },
    );
    expect(r.verdict).toBe('warn');
    expect(r.banner).toMatch(/session/i);
  });

  it('returns cut at >= session ceiling and uses the session sentence', async () => {
    const r = await checkBudget(
      { userId: 'u', sessionId: 's', mode: 'chat' },
      {
        sessionRepo: makeSession(10_000),
        metricsRepo: makeMetrics(100),
        dailyCap: 500_000,
      },
    );
    expect(r.verdict).toBe('cut');
    expect(r.cutSentence).toBe(BUDGET_CUT_SENTENCE);
  });

  it('returns cut at >= daily cap and uses the daily sentence', async () => {
    const r = await checkBudget(
      { userId: 'u', sessionId: 's', mode: 'chat' },
      {
        sessionRepo: makeSession(0),
        metricsRepo: makeMetrics(500_000),
        dailyCap: 500_000,
      },
    );
    expect(r.verdict).toBe('cut');
    expect(r.cutSentence).toBe(BUDGET_CUT_SENTENCE_DAILY);
  });

  it('skips session ceiling when sessionId is null (greeting)', async () => {
    const r = await checkBudget(
      { userId: 'u', sessionId: null, mode: 'greeting' },
      {
        sessionRepo: makeSession(999_999),
        metricsRepo: makeMetrics(100),
        dailyCap: 500_000,
      },
    );
    expect(r.verdict).toBe('ok');
    expect(r.sessionUsed).toBe(0);
  });

  it('degrades to ok when reads fail', async () => {
    const sessionRepo = {
      sumSessionTokens: vi.fn(async () => {
        throw new Error('db down');
      }),
    } as unknown as SessionRepository;
    const metricsRepo = {
      dailyTokenTotalForUser: vi.fn(async () => {
        throw new Error('db down');
      }),
    } as unknown as MetricsRepository;
    const log = vi.fn();
    const r = await checkBudget(
      { userId: 'u', sessionId: 's', mode: 'chat' },
      { sessionRepo, metricsRepo, dailyCap: 500_000, log },
    );
    expect(r.verdict).toBe('ok');
    expect(log).toHaveBeenCalledTimes(2);
  });
});
