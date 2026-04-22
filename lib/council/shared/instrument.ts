import type { MetricsRepository } from '@/lib/persistence/metrics-repository';
import type { CouncilAgent } from '@/lib/persistence/types';

/**
 * F21 — per-call instrumentation helper.
 *
 * One row per Anthropic call is written to `council_metrics`. The
 * agents (Researcher / Consolidator / Critic) capture timing + token
 * usage at the call site and hand the numbers to `recordMetric`. We
 * keep this split rather than wrapping the SDK call because:
 *
 *   - Researcher and Critic are non-streaming (single `messages.create`
 *     response). Full-reply time is the natural number; first-token
 *     time is null.
 *   - Consolidator is streaming. First-token time is meaningful and
 *     distinct from full-reply time. The Consolidator loop already
 *     tracks both numbers for its own persistence — it just forwards
 *     them here.
 *
 * Write semantics: fire-and-forget. The metrics row is a side-effect
 * of the reply, never a blocker. A failed write is logged and
 * swallowed — it must never surface as a route error.
 */

export type Outcome = 'ok' | 'error' | 'rate_limited';

export type RecordMetricArgs = {
  userId: string;
  /** Null is allowed — the greeting turn fires before a session exists. */
  sessionId: string | null;
  agent: CouncilAgent;
  /** ISO timestamp of when the outbound Anthropic call started. */
  callStartedAt: string;
  /** Milliseconds to first streamed token. Null for non-streaming agents. */
  firstTokenMs: number | null;
  /** Milliseconds to full reply. Null only if the call never completed. */
  fullReplyMs: number | null;
  tokensIn: number;
  tokensOut: number;
  outcome: Outcome;
};

export type RecordMetricDeps = {
  metricsRepo: MetricsRepository;
  log?: (msg: string, err: unknown) => void;
};

/**
 * Writes one metrics row. Errors are logged and swallowed. Returns
 * void so call sites can `void recordMetric(...)` in a fire-and-
 * forget position inside a `finally` block.
 */
export async function recordMetric(
  args: RecordMetricArgs,
  deps: RecordMetricDeps,
): Promise<void> {
  const log = deps.log ?? ((msg, err) => console.error(msg, err));
  try {
    await deps.metricsRepo.record({
      user_id: args.userId,
      session_id: args.sessionId,
      agent: args.agent,
      call_started_at: args.callStartedAt,
      first_token_ms: args.firstTokenMs,
      full_reply_ms: args.fullReplyMs,
      tokens_in: args.tokensIn,
      tokens_out: args.tokensOut,
      outcome: args.outcome,
    });
  } catch (err) {
    log('instrument: metrics write failed (swallowed)', err);
  }
}

/**
 * Classifies a thrown error into the 3-value `outcome` column. Rate-
 * limited is separated out because F22 + the /admin/metrics view
 * treat it differently from a hard failure.
 */
export function classifyOutcome(err: unknown): Outcome {
  const msg = err instanceof Error ? err.message : String(err);
  if (/\b429\b|rate[- ]?limit/i.test(msg)) return 'rate_limited';
  return 'error';
}
