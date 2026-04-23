import type {
  CouncilAgent,
  CouncilMetricRow,
  CouncilMode,
} from '@/lib/persistence/types';

/**
 * Pure aggregation for the `/admin/metrics` dashboard.
 *
 * Input: `CouncilMetricRow[]` straight out of
 * `MetricsRepository.listForUser`, already filtered to the window
 * the page is rendering, plus (F27) a `sessionModeById` map derived
 * from the corresponding `council_sessions` rows and a count of
 * `admin_error_events` rows in the window.
 * Output: a `MetricsSummary` the view can render with zero extra
 * work. No I/O, no clock, no randomness — deterministic so tests can
 * pin every field.
 *
 * Percentile method: nearest-rank on a sorted array
 * (`arr[floor(p * (n-1))]`). Simple, dependency-free, and stable
 * enough at v0.4 row counts (≤ a few thousand). F27 keeps this method
 * but adds fixed-bucket histograms next to the percentile summary so
 * the CD can see the tail shape, not just p50/p95.
 *
 * SLO evaluation: PRD §13.3 targets are indexed by surface (first-
 * token / full-reply × mode). Only the Consolidator is user-facing,
 * so SLO latencies are computed from Consolidator rows joined to the
 * session mode through `sessionModeById`. Researcher / Critic rows
 * contribute to token share and agent breakdown but not to the SLO
 * pass/fail evaluation.
 */

export const AGENTS: readonly CouncilAgent[] = [
  'researcher',
  'consolidator',
  'critic',
] as const;

/**
 * Fixed bucket upper bounds in ms for full-reply latencies, inclusive
 * on the upper bound. The last bucket is open-ended (anything above
 * the second-to-last threshold). Chosen to straddle the §13.3 SLO
 * breakpoints so a CD glance instantly lines up a hot bucket with a
 * target.
 */
export const FULL_REPLY_HISTOGRAM_BUCKETS_MS: readonly number[] = [
  500, 1000, 2000, 4000, 8000, 12000,
] as const;

export const FIRST_TOKEN_HISTOGRAM_BUCKETS_MS: readonly number[] = [
  250, 500, 1000, 2000, 4000,
] as const;

export interface HistogramBucket {
  /** Inclusive lower bound. 0 for the first bucket. */
  minMs: number;
  /** Exclusive upper bound; `null` for the open-ended tail bucket. */
  maxMs: number | null;
  count: number;
}

export interface Histogram {
  samples: number;
  buckets: HistogramBucket[];
}

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
  /**
   * Share of `tokensIn + tokensOut` across all three agents, expressed
   * as a fraction in `[0, 1]`. Zero when the combined total is zero.
   */
  tokenShare: number;
  /** F27 — fixed-bucket histograms over non-null samples. */
  fullReplyHistogram: Histogram;
  firstTokenHistogram: Histogram;
}

/**
 * The set of SLO-evaluated surfaces. Kept as a literal union so the
 * view can switch on it without a runtime map lookup, and so adding
 * a new surface is a compile-time ripple.
 */
export type SloSurface =
  | 'first-token:chat'
  | 'first-token:greeting'
  | 'full-reply:chat'
  | 'full-reply:plan';

export interface SloTarget {
  surface: SloSurface;
  label: string;
  /** Latency field sampled for this surface. */
  metric: 'first_token_ms' | 'full_reply_ms';
  mode: CouncilMode;
  p50Ms: number;
  p95Ms: number;
}

/**
 * PRD §13.3, verbatim. If the PRD changes, this array changes. Kept
 * exported so tests can pin the source of truth and the view can
 * render the target columns next to the actual numbers without
 * duplicating them.
 */
export const SLO_TARGETS: readonly SloTarget[] = [
  {
    surface: 'first-token:chat',
    label: 'First-token, warm chat',
    metric: 'first_token_ms',
    mode: 'chat',
    p50Ms: 1200,
    p95Ms: 2500,
  },
  {
    surface: 'first-token:greeting',
    label: 'First-token, morning greeting',
    metric: 'first_token_ms',
    mode: 'greeting',
    p50Ms: 2000,
    p95Ms: 4000,
  },
  {
    surface: 'full-reply:chat',
    label: 'Full-reply, Chat turn',
    metric: 'full_reply_ms',
    mode: 'chat',
    p50Ms: 4000,
    p95Ms: 8000,
  },
  {
    surface: 'full-reply:plan',
    label: 'Full-reply, Plan session',
    metric: 'full_reply_ms',
    mode: 'plan',
    p50Ms: 6000,
    p95Ms: 12000,
  },
] as const;

export type SloVerdict = 'pass' | 'fail' | 'no-data';

export interface SloStatusRow {
  target: SloTarget;
  samples: number;
  p50Ms: number | null;
  p95Ms: number | null;
  p50Verdict: SloVerdict;
  p95Verdict: SloVerdict;
  /** `'pass'` only if both p50 and p95 pass; `'no-data'` when samples === 0. */
  overall: SloVerdict;
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
  /**
   * F27 — count of `admin_error_events` rows in the window, currently
   * dominated by `email_send_failed`. Surfaced next to the 429 / error
   * totals so the CD sees when the alert pipeline itself is broken.
   */
  errorEmailFailures: number;
  byAgent: AgentBreakdown[];
  /** F27 — SLO verdicts per PRD §13.3 surface. */
  sloStatus: SloStatusRow[];
}

export interface SummarizeOptions {
  windowHours: number;
  windowStartIso: string;
  /**
   * Map from `council_metrics.session_id` to the session's mode,
   * used for SLO surface-matching. Rows whose session_id is not in
   * the map (or is null) don't contribute to SLO evaluation — they
   * still appear in totals and per-agent breakdowns. Default: empty
   * map, in which case the SLO section shows `no-data` everywhere.
   */
  sessionModeById?: ReadonlyMap<string, CouncilMode>;
  /**
   * F27 — count of `admin_error_events` (kind = `email_send_failed`)
   * in the window, fetched by the page from
   * `AdminErrorEventsRepository.countSince`. Defaults to 0.
   */
  errorEmailFailures?: number;
}

export function summarize(
  rows: readonly CouncilMetricRow[],
  opts: SummarizeOptions,
): MetricsSummary {
  // Compute per-agent token totals once, then derive `tokenShare`
  // after we know the grand total. Doing it in two passes keeps the
  // share denominator consistent (total tokens in + out across all
  // three agents), which is what the PRD asks for.
  const byAgentRaw = AGENTS.map((agent) => {
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
      subsetSize: subset.length,
      ok,
      errors,
      rateLimited,
      tokensIn,
      tokensOut,
      fullSamples,
      firstSamples,
    };
  });

  const totalTokensIn = byAgentRaw.reduce((sum, a) => sum + a.tokensIn, 0);
  const totalTokensOut = byAgentRaw.reduce((sum, a) => sum + a.tokensOut, 0);
  const totalTokensAllAgents = totalTokensIn + totalTokensOut;

  const byAgent: AgentBreakdown[] = byAgentRaw.map((a) => ({
    agent: a.agent,
    requests: a.subsetSize,
    ok: a.ok,
    errors: a.errors,
    rateLimited: a.rateLimited,
    tokensIn: a.tokensIn,
    tokensOut: a.tokensOut,
    p50FullReplyMs: percentile(a.fullSamples, 0.5),
    p95FullReplyMs: percentile(a.fullSamples, 0.95),
    p50FirstTokenMs: percentile(a.firstSamples, 0.5),
    p95FirstTokenMs: percentile(a.firstSamples, 0.95),
    tokenShare:
      totalTokensAllAgents === 0
        ? 0
        : (a.tokensIn + a.tokensOut) / totalTokensAllAgents,
    fullReplyHistogram: buildHistogram(
      a.fullSamples,
      FULL_REPLY_HISTOGRAM_BUCKETS_MS,
    ),
    firstTokenHistogram: buildHistogram(
      a.firstSamples,
      FIRST_TOKEN_HISTOGRAM_BUCKETS_MS,
    ),
  }));

  const totalRequests = rows.length;
  const totalOk = byAgent.reduce((sum, a) => sum + a.ok, 0);
  const totalErrors = byAgent.reduce((sum, a) => sum + a.errors, 0);
  const totalRateLimited = byAgent.reduce((sum, a) => sum + a.rateLimited, 0);

  const sloStatus = computeSloStatus(
    rows,
    opts.sessionModeById ?? new Map<string, CouncilMode>(),
  );

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
    errorEmailFailures: opts.errorEmailFailures ?? 0,
    byAgent,
    sloStatus,
  };
}

/**
 * Computes p50/p95 per §13.3 surface and compares to target. Samples
 * are drawn from Consolidator rows only (the user-facing agent) and
 * filtered by the session mode the row came from. A row without a
 * mapped session (session_id null, or id not in the map) is skipped.
 *
 * No-data → neither verdict is `'fail'`; we don't want to paint a
 * surface red just because the window is quiet. That's a design
 * choice that matches the CD's glance posture: red means something
 * to fix.
 */
export function computeSloStatus(
  rows: readonly CouncilMetricRow[],
  sessionModeById: ReadonlyMap<string, CouncilMode>,
): SloStatusRow[] {
  return SLO_TARGETS.map((target) => {
    const samples: number[] = [];
    for (const row of rows) {
      if (row.agent !== 'consolidator') continue;
      if (!row.session_id) continue;
      const mode = sessionModeById.get(row.session_id);
      if (mode !== target.mode) continue;
      const v = row[target.metric];
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
        samples.push(v);
      }
    }
    const p50 = percentile(samples, 0.5);
    const p95 = percentile(samples, 0.95);
    const p50Verdict: SloVerdict =
      p50 === null ? 'no-data' : p50 <= target.p50Ms ? 'pass' : 'fail';
    const p95Verdict: SloVerdict =
      p95 === null ? 'no-data' : p95 <= target.p95Ms ? 'pass' : 'fail';
    const overall: SloVerdict =
      samples.length === 0
        ? 'no-data'
        : p50Verdict === 'fail' || p95Verdict === 'fail'
          ? 'fail'
          : 'pass';
    return {
      target,
      samples: samples.length,
      p50Ms: p50,
      p95Ms: p95,
      p50Verdict,
      p95Verdict,
      overall,
    };
  });
}

/**
 * Bucketise a sample array into the boundaries supplied. The bucket
 * list is interpreted as [0, b0), [b0, b1), ..., [b_{n-1}, +∞); the
 * last bucket is open-ended so outliers always land somewhere.
 *
 * O(n * log(buckets)) would be marginally faster, but at v0.4 sample
 * counts (≤ 2000) a linear scan per sample is cheaper to read.
 */
export function buildHistogram(
  values: readonly number[],
  boundaries: readonly number[],
): Histogram {
  const buckets: HistogramBucket[] = [];
  let prev = 0;
  for (const b of boundaries) {
    buckets.push({ minMs: prev, maxMs: b, count: 0 });
    prev = b;
  }
  // Open-ended tail.
  buckets.push({ minMs: prev, maxMs: null, count: 0 });
  for (const v of values) {
    let placed = false;
    for (let i = 0; i < boundaries.length; i++) {
      if (v < boundaries[i]) {
        buckets[i].count += 1;
        placed = true;
        break;
      }
    }
    if (!placed) buckets[buckets.length - 1].count += 1;
  }
  return { samples: values.length, buckets };
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
