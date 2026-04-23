import type { CouncilAgent, CouncilMetricRow } from '@/lib/persistence/types';

/**
 * Pure aggregation for the F26 `/admin/metrics` baseline dashboard.
 *
 * Input: `CouncilMetricRow[]` straight out of
 * `MetricsRepository.listForUser`, already filtered to the window
 * the page is rendering.
 * Output: a `MetricsSummary` the view can render with zero extra
 * work. No I/O, no clock, no randomness — deterministic so tests can
 * pin every field.
 *
 * Percentile method: nearest-rank on a sorted array
 * (`arr[floor(p * (n-1))]`). Simple, dependency-free, and stable
 * enough at v0.4 row counts (≤ a few thousand). When we graduate to
 * proper histograms in F27, this gets replaced — until then, the
 * baseline CD view doesn't need textbook interpolation.
 */

export const AGENTS: readonly CouncilAgent[] = [
  'researcher',
  'consolidator',
  'critic',
] as const;

export interface AgentBreakdown {
  agent: CouncilAgent;
  requests: number;
  ok: number;
  errors: number;
  rateLimited: number;
  tokensIn: number;
  tokensOut: number;
  /** Null when no sample contributed (e.g. all rows errored mid-call). */
  p50FullReplyMs: number | null;
  p95FullReplyMs: number | null;
  p50FirstTokenMs: number | null;
  p95FirstTokenMs: number | null;
}

export interface MetricsSummary {
  windowHours: number;
  windowStartIso: string;
  totalRequests: number;
  totalOk: number;
  totalErrors: number;
  totalRateLimited: number;
  totalTokensIn: number;
  totalTokensOut: number;
  /** Fraction in `[0, 1]`; `0` when `totalRequests === 0`. */
  errorRate: number;
  rateLimitedRate: number;
  byAgent: AgentBreakdown[];
}

export interface SummarizeOptions {
  windowHours: number;
  windowStartIso: string;
}

export function summarize(
  rows: readonly CouncilMetricRow[],
  opts: SummarizeOptions,
): MetricsSummary {
  const byAgent: AgentBreakdown[] = AGENTS.map((agent) => {
    const subset = rows.filter((r) => r.agent === agent);
    const ok = subset.filter((r) => r.outcome === 'ok').length;
    const errors = subset.filter((r) => r.outcome === 'error').length;
    const rateLimited = subset.filter(
      (r) => r.outcome === 'rate_limited',
    ).length;
    const tokensIn = sumField(subset, 'tokens_in');
    const tokensOut = sumField(subset, 'tokens_out');
    const fullSamples = latencySamples(subset, 'full_reply_ms');
    const firstSamples = latencySamples(subset, 'first_token_ms');
    return {
      agent,
      requests: subset.length,
      ok,
      errors,
      rateLimited,
      tokensIn,
      tokensOut,
      p50FullReplyMs: percentile(fullSamples, 0.5),
      p95FullReplyMs: percentile(fullSamples, 0.95),
      p50FirstTokenMs: percentile(firstSamples, 0.5),
      p95FirstTokenMs: percentile(firstSamples, 0.95),
    };
  });

  const totalRequests = rows.length;
  const totalOk = byAgent.reduce((sum, a) => sum + a.ok, 0);
  const totalErrors = byAgent.reduce((sum, a) => sum + a.errors, 0);
  const totalRateLimited = byAgent.reduce((sum, a) => sum + a.rateLimited, 0);
  const totalTokensIn = byAgent.reduce((sum, a) => sum + a.tokensIn, 0);
  const totalTokensOut = byAgent.reduce((sum, a) => sum + a.tokensOut, 0);

  return {
    windowHours: opts.windowHours,
    windowStartIso: opts.windowStartIso,
    totalRequests,
    totalOk,
    totalErrors,
    totalRateLimited,
    totalTokensIn,
    totalTokensOut,
    errorRate: totalRequests === 0 ? 0 : totalErrors / totalRequests,
    rateLimitedRate:
      totalRequests === 0 ? 0 : totalRateLimited / totalRequests,
    byAgent,
  };
}

/**
 * Clamp a raw `?window=` query param to one of the supported buckets.
 * The UI offers 1h / 24h / 7d; any unknown value falls back to 24h so
 * a tampered URL can't make the page query an unbounded window.
 */
export const WINDOW_OPTIONS = [
  { hours: 1, label: '1h' },
  { hours: 24, label: '24h' },
  { hours: 24 * 7, label: '7d' },
] as const;

export function parseWindowHours(raw: string | undefined): number {
  if (typeof raw !== 'string') return 24;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return 24;
  const found = WINDOW_OPTIONS.find((w) => w.hours === n);
  return found ? found.hours : 24;
}

// ---------- helpers ----------

function sumField(
  rows: readonly CouncilMetricRow[],
  field: 'tokens_in' | 'tokens_out',
): number {
  let total = 0;
  for (const r of rows) total += r[field] ?? 0;
  return total;
}

function latencySamples(
  rows: readonly CouncilMetricRow[],
  field: 'full_reply_ms' | 'first_token_ms',
): number[] {
  const out: number[] = [];
  for (const r of rows) {
    const v = r[field];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out.push(v);
  }
  return out;
}

/**
 * Nearest-rank percentile on an unsorted numeric array. Returns null
 * when the array is empty.
 *
 * One formula for every `p`: sort once, then clamp
 * `floor(p * (n-1))` into `[0, n-1]`. Keeping a single code path (no
 * early-return min/max branches) avoids latent drift if the formula
 * ever moves to proper interpolation, and avoids spreading a large
 * array into `Math.min`/`Math.max` argument slots.
 */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const raw = Math.floor(p * (sorted.length - 1));
  const idx = Math.max(0, Math.min(sorted.length - 1, raw));
  return sorted[idx];
}
