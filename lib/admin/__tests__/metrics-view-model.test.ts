import { describe, it, expect } from 'vitest';
import type { CouncilMetricRow, CouncilMode } from '@/lib/persistence/types';
import {
  AGENTS,
  FIRST_TOKEN_HISTOGRAM_BUCKETS_MS,
  FULL_REPLY_HISTOGRAM_BUCKETS_MS,
  SLO_TARGETS,
  WINDOW_OPTIONS,
  buildHistogram,
  computeSloStatus,
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

describe('summarize — F27 additions', () => {
  const opts = { windowHours: 24, windowStartIso: WINDOW_START };

  it('exposes the error-email failure count passed through SummarizeOptions', () => {
    const s = summarize([], { ...opts, errorEmailFailures: 3 });
    expect(s.errorEmailFailures).toBe(3);
  });

  it('defaults errorEmailFailures to 0 when omitted', () => {
    const s = summarize([], opts);
    expect(s.errorEmailFailures).toBe(0);
  });

  it('computes per-agent token share as a fraction of the grand total', () => {
    const rows: CouncilMetricRow[] = [
      row({ agent: 'researcher', tokens_in: 100, tokens_out: 200 }), // 300
      row({ agent: 'consolidator', tokens_in: 200, tokens_out: 400 }), // 600
      row({ agent: 'critic', tokens_in: 50, tokens_out: 50 }), // 100
    ];
    const s = summarize(rows, opts);
    // Grand total = 300 + 600 + 100 = 1000.
    const shares = Object.fromEntries(
      s.byAgent.map((a) => [a.agent, a.tokenShare]),
    );
    expect(shares.researcher).toBeCloseTo(0.3, 5);
    expect(shares.consolidator).toBeCloseTo(0.6, 5);
    expect(shares.critic).toBeCloseTo(0.1, 5);
    // Shares sum to 1.
    const sum = s.byAgent.reduce((acc, a) => acc + a.tokenShare, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it('returns token share = 0 for every agent when no tokens were used', () => {
    const rows: CouncilMetricRow[] = [
      row({ agent: 'consolidator', tokens_in: 0, tokens_out: 0, outcome: 'error' }),
    ];
    const s = summarize(rows, opts);
    for (const a of s.byAgent) expect(a.tokenShare).toBe(0);
  });

  it('builds a histogram per agent with fixed boundary layout', () => {
    const rows: CouncilMetricRow[] = [
      row({ agent: 'consolidator', full_reply_ms: 100 }),
      row({ agent: 'consolidator', full_reply_ms: 750 }),
      row({ agent: 'consolidator', full_reply_ms: 5000 }),
      row({ agent: 'consolidator', full_reply_ms: 30_000 }),
    ];
    const s = summarize(rows, opts);
    const consolidator = s.byAgent.find((a) => a.agent === 'consolidator')!;
    const hist = consolidator.fullReplyHistogram;
    // Full-reply boundaries: 500, 1000, 2000, 4000, 8000, 12000, +∞.
    expect(hist.samples).toBe(4);
    expect(hist.buckets).toHaveLength(FULL_REPLY_HISTOGRAM_BUCKETS_MS.length + 1);
    // 100 < 500 → bucket 0.
    expect(hist.buckets[0].count).toBe(1);
    // 750 ∈ [500, 1000) → bucket 1.
    expect(hist.buckets[1].count).toBe(1);
    // 5000 ∈ [4000, 8000) → bucket 4.
    expect(hist.buckets[4].count).toBe(1);
    // 30_000 ≥ 12_000 → tail.
    expect(hist.buckets[hist.buckets.length - 1].count).toBe(1);
    // Tail bucket has maxMs = null (open-ended).
    expect(hist.buckets[hist.buckets.length - 1].maxMs).toBeNull();
  });

  it('sloStatus is `no-data` when no session mode map is supplied', () => {
    const rows: CouncilMetricRow[] = [
      row({
        agent: 'consolidator',
        session_id: 'sess-a',
        first_token_ms: 500,
        full_reply_ms: 2000,
      }),
    ];
    const s = summarize(rows, opts);
    expect(s.sloStatus).toHaveLength(SLO_TARGETS.length);
    for (const r of s.sloStatus) {
      expect(r.overall).toBe('no-data');
      expect(r.samples).toBe(0);
      expect(r.p50Ms).toBeNull();
      expect(r.p95Ms).toBeNull();
    }
  });

  it('sloStatus evaluates pass for Consolidator chat first-token under target', () => {
    const sessionModeById = new Map<string, CouncilMode>([
      ['sess-chat', 'chat'],
    ]);
    // first_token SLO for chat: p50 ≤ 1200, p95 ≤ 2500.
    const rows: CouncilMetricRow[] = [
      row({ agent: 'consolidator', session_id: 'sess-chat', first_token_ms: 500 }),
      row({ agent: 'consolidator', session_id: 'sess-chat', first_token_ms: 800 }),
      row({ agent: 'consolidator', session_id: 'sess-chat', first_token_ms: 1200 }),
    ];
    const s = summarize(rows, { ...opts, sessionModeById });
    const chatFirst = s.sloStatus.find(
      (r) => r.target.surface === 'first-token:chat',
    )!;
    expect(chatFirst.overall).toBe('pass');
    expect(chatFirst.samples).toBe(3);
    expect(chatFirst.p50Verdict).toBe('pass');
    expect(chatFirst.p95Verdict).toBe('pass');
  });

  it('sloStatus marks fail when p95 exceeds target', () => {
    const sessionModeById = new Map<string, CouncilMode>([
      ['sess-chat', 'chat'],
    ]);
    // p95 target for full-reply chat is 8000ms. Nearest-rank on N=20
    // picks sorted[floor(0.95 * 19)] = sorted[18] — the 19th-smallest
    // value. Two outliers land in slots 18 and 19 so the 19th-smallest
    // is the outlier, tripping p95. (One outlier on N=20 would land
    // in slot 19 only, and p95 would still be 2000.)
    const rows: CouncilMetricRow[] = Array.from({ length: 20 }, (_, i) =>
      row({
        agent: 'consolidator',
        session_id: 'sess-chat',
        full_reply_ms: i < 18 ? 2000 : 30_000,
      }),
    );
    const s = summarize(rows, { ...opts, sessionModeById });
    const chatFull = s.sloStatus.find(
      (r) => r.target.surface === 'full-reply:chat',
    )!;
    expect(chatFull.overall).toBe('fail');
    expect(chatFull.p95Verdict).toBe('fail');
    expect(chatFull.p50Verdict).toBe('pass');
  });

  it('sloStatus ignores Researcher and Critic rows', () => {
    const sessionModeById = new Map<string, CouncilMode>([
      ['sess-chat', 'chat'],
    ]);
    const rows: CouncilMetricRow[] = [
      // Only non-consolidator rows present.
      row({ agent: 'researcher', session_id: 'sess-chat', first_token_ms: 100 }),
      row({ agent: 'critic', session_id: 'sess-chat', first_token_ms: 100 }),
    ];
    const s = summarize(rows, { ...opts, sessionModeById });
    const chatFirst = s.sloStatus.find(
      (r) => r.target.surface === 'first-token:chat',
    )!;
    expect(chatFirst.samples).toBe(0);
    expect(chatFirst.overall).toBe('no-data');
  });

  it('sloStatus filters by mode: plan rows do not contribute to chat SLO', () => {
    const sessionModeById = new Map<string, CouncilMode>([
      ['sess-plan', 'plan'],
    ]);
    const rows: CouncilMetricRow[] = [
      row({
        agent: 'consolidator',
        session_id: 'sess-plan',
        full_reply_ms: 500, // would pass chat
      }),
    ];
    const s = summarize(rows, { ...opts, sessionModeById });
    const chatFull = s.sloStatus.find(
      (r) => r.target.surface === 'full-reply:chat',
    )!;
    expect(chatFull.samples).toBe(0); // nothing routed to chat
    expect(chatFull.overall).toBe('no-data');
    const planFull = s.sloStatus.find(
      (r) => r.target.surface === 'full-reply:plan',
    )!;
    expect(planFull.samples).toBe(1);
    expect(planFull.overall).toBe('pass');
  });

  it('sloStatus ignores rows whose session_id is not in the mode map', () => {
    const sessionModeById = new Map<string, CouncilMode>([
      ['sess-known', 'chat'],
    ]);
    const rows: CouncilMetricRow[] = [
      row({
        agent: 'consolidator',
        session_id: 'sess-orphan',
        first_token_ms: 500,
      }),
      row({
        agent: 'consolidator',
        session_id: null,
        first_token_ms: 500,
      }),
    ];
    const s = summarize(rows, { ...opts, sessionModeById });
    const chatFirst = s.sloStatus.find(
      (r) => r.target.surface === 'first-token:chat',
    )!;
    expect(chatFirst.samples).toBe(0);
  });
});

describe('buildHistogram', () => {
  it('returns one bucket per boundary plus an open-ended tail', () => {
    const h = buildHistogram([], [500, 1000]);
    expect(h.buckets).toHaveLength(3);
    expect(h.buckets[0]).toEqual({ minMs: 0, maxMs: 500, count: 0 });
    expect(h.buckets[1]).toEqual({ minMs: 500, maxMs: 1000, count: 0 });
    expect(h.buckets[2]).toEqual({ minMs: 1000, maxMs: null, count: 0 });
  });

  it('treats boundaries as exclusive upper bounds', () => {
    const h = buildHistogram([499, 500, 999, 1000], [500, 1000]);
    // 499 → bucket 0 (< 500)
    // 500 → bucket 1 (not < 500, is < 1000)
    // 999 → bucket 1
    // 1000 → tail (not < 500, not < 1000)
    expect(h.buckets.map((b) => b.count)).toEqual([1, 2, 1]);
  });

  it('counts samples = input length', () => {
    const h = buildHistogram([1, 2, 3, 4, 5], FIRST_TOKEN_HISTOGRAM_BUCKETS_MS);
    expect(h.samples).toBe(5);
    expect(h.buckets.reduce((a, b) => a + b.count, 0)).toBe(5);
  });
});

describe('computeSloStatus (standalone)', () => {
  it('returns one row per SLO_TARGETS entry in stable order', () => {
    const rows = computeSloStatus([], new Map());
    expect(rows.map((r) => r.target.surface)).toEqual(
      SLO_TARGETS.map((t) => t.surface),
    );
  });

  it('no-data means samples === 0 and verdicts are no-data', () => {
    const rows = computeSloStatus([], new Map());
    for (const r of rows) {
      expect(r.samples).toBe(0);
      expect(r.p50Verdict).toBe('no-data');
      expect(r.p95Verdict).toBe('no-data');
      expect(r.overall).toBe('no-data');
    }
  });

  it('greeting SLO targets match PRD §13.3: p50 ≤ 2000ms, p95 ≤ 4000ms', () => {
    const sessionModeById = new Map<string, CouncilMode>([
      ['greet-1', 'greeting'],
    ]);
    const rows: CouncilMetricRow[] = [
      row({
        agent: 'consolidator',
        session_id: 'greet-1',
        first_token_ms: 1800,
      }),
      row({
        agent: 'consolidator',
        session_id: 'greet-1',
        first_token_ms: 3800,
      }),
    ];
    const statuses = computeSloStatus(rows, sessionModeById);
    const greet = statuses.find(
      (r) => r.target.surface === 'first-token:greeting',
    )!;
    expect(greet.target.p50Ms).toBe(2000);
    expect(greet.target.p95Ms).toBe(4000);
    expect(greet.overall).toBe('pass');
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
