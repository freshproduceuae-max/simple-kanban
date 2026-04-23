import { describe, it, expect } from 'vitest';
import type { CouncilMetricRow } from '@/lib/persistence/types';
import {
  AGENTS,
  WINDOW_OPTIONS,
  parseWindowHours,
  percentile,
  summarize,
} from '../metrics-view-model';

const WINDOW_START = '2026-04-23T00:00:00Z';

function row(overrides: Partial<CouncilMetricRow>): CouncilMetricRow {
  return {
    id: overrides.id ?? `m-${Math.random().toString(36).slice(2, 8)}`,
    user_id: overrides.user_id ?? 'u1',
    session_id: overrides.session_id ?? null,
    agent: overrides.agent ?? 'consolidator',
    call_started_at: overrides.call_started_at ?? '2026-04-23T12:00:00Z',
    first_token_ms: overrides.first_token_ms ?? null,
    full_reply_ms: overrides.full_reply_ms ?? null,
    tokens_in: overrides.tokens_in ?? 0,
    tokens_out: overrides.tokens_out ?? 0,
    outcome: overrides.outcome ?? 'ok',
  };
}

describe('percentile', () => {
  it('returns null on an empty array', () => {
    expect(percentile([], 0.5)).toBeNull();
  });

  it('returns the only value for a one-element array', () => {
    expect(percentile([42], 0.5)).toBe(42);
    expect(percentile([42], 0.95)).toBe(42);
  });

  it('nearest-rank selects the median correctly', () => {
    expect(percentile([1, 2, 3, 4, 5], 0.5)).toBe(3);
  });

  it('p95 selects near the top', () => {
    // idx = floor(0.95 * (10-1)) = floor(8.55) = 8 → sorted[8] = 9
    expect(
      percentile([10, 3, 1, 7, 5, 2, 8, 4, 6, 9], 0.95),
    ).toBe(9);
  });

  it('clamps p ≤ 0 to min and p ≥ 1 to max', () => {
    expect(percentile([3, 1, 2], 0)).toBe(1);
    expect(percentile([3, 1, 2], -5)).toBe(1);
    expect(percentile([3, 1, 2], 1)).toBe(3);
    expect(percentile([3, 1, 2], 2)).toBe(3);
  });

  it('does not mutate the input', () => {
    const input = [5, 3, 1, 4, 2];
    percentile(input, 0.5);
    expect(input).toEqual([5, 3, 1, 4, 2]);
  });
});

describe('summarize', () => {
  const opts = { windowHours: 24, windowStartIso: WINDOW_START };

  it('returns zero totals and null latencies on an empty input', () => {
    const s = summarize([], opts);
    expect(s.totalRequests).toBe(0);
    expect(s.totalOk).toBe(0);
    expect(s.totalErrors).toBe(0);
    expect(s.totalRateLimited).toBe(0);
    expect(s.errorRate).toBe(0);
    expect(s.rateLimitedRate).toBe(0);
    expect(s.byAgent).toHaveLength(3);
    for (const a of s.byAgent) {
      expect(a.requests).toBe(0);
      expect(a.p50FullReplyMs).toBeNull();
      expect(a.p95FullReplyMs).toBeNull();
      expect(a.p50FirstTokenMs).toBeNull();
      expect(a.p95FirstTokenMs).toBeNull();
    }
  });

  it('always renders all three agent rows even if one never appears', () => {
    const s = summarize(
      [row({ agent: 'consolidator', outcome: 'ok' })],
      opts,
    );
    const agents = s.byAgent.map((a) => a.agent);
    expect(agents).toEqual(['researcher', 'consolidator', 'critic']);
    const researcher = s.byAgent.find((a) => a.agent === 'researcher')!;
    expect(researcher.requests).toBe(0);
  });

  it('partitions outcomes across ok / error / rate_limited', () => {
    const rows: CouncilMetricRow[] = [
      row({ agent: 'consolidator', outcome: 'ok' }),
      row({ agent: 'consolidator', outcome: 'ok' }),
      row({ agent: 'consolidator', outcome: 'error' }),
      row({ agent: 'researcher', outcome: 'rate_limited' }),
    ];
    const s = summarize(rows, opts);
    expect(s.totalRequests).toBe(4);
    expect(s.totalOk).toBe(2);
    expect(s.totalErrors).toBe(1);
    expect(s.totalRateLimited).toBe(1);
    expect(s.errorRate).toBeCloseTo(0.25);
    expect(s.rateLimitedRate).toBeCloseTo(0.25);
    const consolidator = s.byAgent.find((a) => a.agent === 'consolidator')!;
    expect(consolidator.ok).toBe(2);
    expect(consolidator.errors).toBe(1);
    expect(consolidator.rateLimited).toBe(0);
  });

  it('sums token totals per agent', () => {
    const rows: CouncilMetricRow[] = [
      row({ agent: 'consolidator', tokens_in: 100, tokens_out: 400 }),
      row({ agent: 'consolidator', tokens_in: 50, tokens_out: 200 }),
      row({ agent: 'critic', tokens_in: 30, tokens_out: 10 }),
    ];
    const s = summarize(rows, opts);
    const consolidator = s.byAgent.find((a) => a.agent === 'consolidator')!;
    const critic = s.byAgent.find((a) => a.agent === 'critic')!;
    expect(consolidator.tokensIn).toBe(150);
    expect(consolidator.tokensOut).toBe(600);
    expect(critic.tokensIn).toBe(30);
    expect(critic.tokensOut).toBe(10);
    expect(s.totalTokensIn).toBe(180);
    expect(s.totalTokensOut).toBe(610);
  });

  it('computes p50 / p95 latencies only from non-null samples', () => {
    const rows: CouncilMetricRow[] = [
      row({ agent: 'consolidator', full_reply_ms: 100 }),
      row({ agent: 'consolidator', full_reply_ms: 200 }),
      row({ agent: 'consolidator', full_reply_ms: 300 }),
      row({ agent: 'consolidator', full_reply_ms: null }), // aborted mid-call
    ];
    const s = summarize(rows, opts);
    const consolidator = s.byAgent.find((a) => a.agent === 'consolidator')!;
    // Three samples: [100, 200, 300]. p50 = floor(0.5*2) = 1 → 200.
    // p95 = floor(0.95*2) = 1 → 200. Nearest-rank.
    expect(consolidator.p50FullReplyMs).toBe(200);
    expect(consolidator.p95FullReplyMs).toBe(200);
  });

  it('computes first-token latencies independently of full-reply latencies', () => {
    const rows: CouncilMetricRow[] = [
      row({ agent: 'consolidator', first_token_ms: 10, full_reply_ms: 100 }),
      row({ agent: 'consolidator', first_token_ms: 20, full_reply_ms: null }),
      row({ agent: 'consolidator', first_token_ms: null, full_reply_ms: 200 }),
    ];
    const s = summarize(rows, opts);
    const consolidator = s.byAgent.find((a) => a.agent === 'consolidator')!;
    // first_token samples: [10, 20]; p50 = floor(0.5*1)=0 → 10.
    expect(consolidator.p50FirstTokenMs).toBe(10);
    // full_reply samples: [100, 200]; p50 = floor(0.5*1)=0 → 100.
    expect(consolidator.p50FullReplyMs).toBe(100);
  });

  it('passes the window metadata through unchanged', () => {
    const s = summarize([], { windowHours: 168, windowStartIso: WINDOW_START });
    expect(s.windowHours).toBe(168);
    expect(s.windowStartIso).toBe(WINDOW_START);
  });

  it('exposes agents in the canonical order', () => {
    expect(AGENTS).toEqual(['researcher', 'consolidator', 'critic']);
  });
});

describe('parseWindowHours', () => {
  it('defaults to 24h when the param is missing or garbage', () => {
    expect(parseWindowHours(undefined)).toBe(24);
    expect(parseWindowHours('')).toBe(24);
    expect(parseWindowHours('abc')).toBe(24);
    expect(parseWindowHours('NaN')).toBe(24);
  });

  it('accepts an exact match from WINDOW_OPTIONS', () => {
    expect(parseWindowHours('1')).toBe(1);
    expect(parseWindowHours('24')).toBe(24);
    expect(parseWindowHours('168')).toBe(168);
  });

  it('falls back to 24h for any unknown numeric value', () => {
    expect(parseWindowHours('3')).toBe(24);
    expect(parseWindowHours('9999')).toBe(24);
    expect(parseWindowHours('-1')).toBe(24);
  });

  it('exposes the three sanctioned buckets', () => {
    expect(WINDOW_OPTIONS.map((w) => w.hours)).toEqual([1, 24, 168]);
  });
});
