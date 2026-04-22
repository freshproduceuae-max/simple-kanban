import type { CouncilMode } from '@/lib/persistence/types';
import type { SessionRepository } from '@/lib/persistence/session-repository';
import type { MetricsRepository } from '@/lib/persistence/metrics-repository';
import {
  SESSION_BUDGETS,
  SOFT_WARN_FRACTION,
  readDailyCap,
  budgetOutcome,
} from './token-budget';

/**
 * F22 — token-budget pre-flight.
 *
 * Runs before any Anthropic call the Council would otherwise make. Two
 * ceilings stack:
 *
 *   - Per-session ceiling (vision §9): greeting 5k, plan 40k,
 *     chat / advise 10k. Counted from the sum of tokens_in + tokens_out
 *     on existing `council_turns` for the session.
 *   - Per-user daily cap (PRD §13): 500k tokens/day across all sessions,
 *     overridable via `COUNCIL_TOKEN_CAP_DAILY`. Read from the
 *     `council_metrics_daily` view.
 *
 * Two outcomes matter to the caller:
 *   - 'ok'    → proceed, nothing to say.
 *   - 'warn'  → proceed, but prepend a one-line banner so the user knows
 *                they are at ≥ 80% of either ceiling.
 *   - 'cut'   → short-circuit; the reply becomes a single calm sentence
 *                and no Anthropic call is made.
 *
 * The check reads both numbers in parallel and returns the *worst*
 * outcome — warn losing to cut, ok losing to warn. A soft-fail on the
 * reads degrades to 'ok' so a metrics outage can never keep a user
 * from getting a reply; the ceilings are advisory to the project
 * operator, not a guarantee of hard stops across infra flakes.
 */

export type BudgetCheckInput = {
  userId: string;
  /** Null on greeting (no session yet) — session ceiling skipped. */
  sessionId: string | null;
  mode: CouncilMode;
  /** ISO day used for the daily-cap window. Defaults to `new Date()`. */
  now?: Date;
};

export type BudgetCheckDeps = {
  sessionRepo: SessionRepository;
  metricsRepo: MetricsRepository;
  /** Override the daily cap (tests). Defaults to `readDailyCap()`. */
  dailyCap?: number;
  log?: (msg: string, err: unknown) => void;
};

export type BudgetVerdict = 'ok' | 'warn' | 'cut';

export type BudgetCheckResult = {
  verdict: BudgetVerdict;
  sessionUsed: number;
  sessionCeiling: number;
  dailyUsed: number;
  dailyCap: number;
  /** One-line banner text the Consolidator prepends on 'warn'. */
  banner: string | null;
  /** Calm sentence the route streams on 'cut'. */
  cutSentence: string | null;
};

export const BUDGET_CUT_SENTENCE =
  "We've reached this session's token budget. Let's pick this up fresh in a new session.";
export const BUDGET_CUT_SENTENCE_DAILY =
  "We've reached today's token budget for your account. Let's pick this up tomorrow.";

function bannerFor(
  sessionOutcome: 'ok' | 'warn' | 'cut',
  dailyOutcome: 'ok' | 'warn' | 'cut',
): string | null {
  if (sessionOutcome === 'warn' && dailyOutcome === 'warn') {
    return "We're close to both this session's and today's token budget.";
  }
  if (sessionOutcome === 'warn') {
    return "We're close to this session's token budget.";
  }
  if (dailyOutcome === 'warn') {
    return "We're close to today's token budget.";
  }
  return null;
}

export async function checkBudget(
  input: BudgetCheckInput,
  deps: BudgetCheckDeps,
): Promise<BudgetCheckResult> {
  const log = deps.log ?? ((msg, err) => console.error(msg, err));
  const now = input.now ?? new Date();
  const dailyCap = deps.dailyCap ?? readDailyCap();
  const sessionCeiling = SESSION_BUDGETS[input.mode];

  let sessionUsed = 0;
  let dailyUsed = 0;

  // Both reads in parallel. Failures degrade to 0 — a metrics/turns
  // outage should never lock a user out of a reply.
  // The metrics view groups `day = date_trunc('day', call_started_at)` at
  // UTC midnight, and the repo reads a half-open `[dayIso, dayIso+24h)`
  // window. Passing `now` directly would shift the window forward and
  // miss the current day's aggregate row once the clock is past 00:00.
  // Normalise to UTC midnight so the window lines up with the view.
  const utcMidnightIso = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString();

  const [sessionRes, dailyRes] = await Promise.allSettled([
    input.sessionId
      ? deps.sessionRepo.sumSessionTokens({ sessionId: input.sessionId })
      : Promise.resolve(0),
    deps.metricsRepo.dailyTokenTotalForUser({
      userId: input.userId,
      dayIso: utcMidnightIso,
    }),
  ]);

  if (sessionRes.status === 'fulfilled') {
    sessionUsed = sessionRes.value;
  } else {
    log('budget: session-token read failed, degrading to 0', sessionRes.reason);
  }
  if (dailyRes.status === 'fulfilled') {
    dailyUsed = dailyRes.value;
  } else {
    log('budget: daily-token read failed, degrading to 0', dailyRes.reason);
  }

  const sessionOutcome = input.sessionId
    ? budgetOutcome(sessionUsed, sessionCeiling)
    : 'ok';
  const dailyOutcome = budgetOutcome(dailyUsed, dailyCap);

  // Cut wins over warn wins over ok.
  let verdict: BudgetVerdict = 'ok';
  if (sessionOutcome === 'cut' || dailyOutcome === 'cut') verdict = 'cut';
  else if (sessionOutcome === 'warn' || dailyOutcome === 'warn') verdict = 'warn';

  const cutSentence =
    verdict === 'cut'
      ? dailyOutcome === 'cut'
        ? BUDGET_CUT_SENTENCE_DAILY
        : BUDGET_CUT_SENTENCE
      : null;

  return {
    verdict,
    sessionUsed,
    sessionCeiling,
    dailyUsed,
    dailyCap,
    banner: verdict === 'warn' ? bannerFor(sessionOutcome, dailyOutcome) : null,
    cutSentence,
  };
}

// Re-exports so callers can import the knobs from one place.
export { SESSION_BUDGETS, SOFT_WARN_FRACTION, readDailyCap };
