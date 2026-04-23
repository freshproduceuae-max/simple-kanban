import { RateLimitError } from '@anthropic-ai/sdk';

/**
 * F30 — Anthropic 429 soft-pause primitive.
 *
 * Every Council agent's Anthropic call runs through this wrapper. On a
 * rate-limit error (429) we back off per the vision §9 schedule, honour
 * any `Retry-After` header the server sent, and retry. After the 30s
 * cumulative cap we give up and rethrow — the caller's existing
 * per-agent failure policy (fail-visible Researcher, fail-quiet Critic,
 * fail-hard Consolidator) then engages.
 *
 * The `onBackoff` callback fires once per wait, *before* sleeping, so
 * dispatch can multiplex a soft-pause meta frame into the user-visible
 * stream ("the shelf enters soft-pause state" per features.json F30).
 *
 * This primitive is pure server-side and has zero side effects beyond
 * what `onBackoff` does. Tests override `sleep` to advance fake timers.
 */

/**
 * Backoff schedule (ms). Doubles each step. Sum = 31_000 ms, exceeding
 * the 30s budget by one second — the budget cap catches the final
 * attempt before it's scheduled, so only the first four sleeps run in
 * the worst case and the fifth throws through.
 */
export const BACKOFF_SCHEDULE_MS: readonly number[] = [
  1_000,
  2_000,
  4_000,
  8_000,
  16_000,
];

/** Maximum cumulative wall-clock time spent sleeping between retries. */
export const BACKOFF_BUDGET_MS = 30_000;

export type SoftPauseInfo = {
  /** 1 for the first 429, 2 for the second, etc. */
  attemptNumber: number;
  /**
   * Delay (rounded up to whole seconds) before the next attempt. The
   * shelf renders this as a countdown-style soft-pause indicator.
   */
  retrySeconds: number;
};

export type RetryOn429Options<T> = {
  /** The call to (re)try. Invoked once plus up to N backoff retries. */
  attempt: () => Promise<T>;
  /**
   * Fires before each sleep between attempts. Use to emit a soft-pause
   * meta frame into the user-visible stream.
   */
  onBackoff?: (info: SoftPauseInfo) => void;
  /**
   * Test-override for the sleep between retries. Production path uses
   * `setTimeout`. Default indirection keeps the primitive deterministic
   * under vitest.
   */
  sleep?: (ms: number) => Promise<void>;
};

/**
 * Run `attempt`; on 429, back off and retry up to the schedule cap.
 * Re-throws anything non-429 immediately. Re-throws the last 429 if the
 * cumulative sleep budget would be exceeded.
 */
export async function retryOn429<T>(opts: RetryOn429Options<T>): Promise<T> {
  const sleep = opts.sleep ?? defaultSleep;
  let elapsedMs = 0;
  let attemptNumber = 0;

  while (true) {
    try {
      return await opts.attempt();
    } catch (err) {
      if (!is429(err)) throw err;

      attemptNumber += 1;
      const scheduleIdx = Math.min(
        attemptNumber - 1,
        BACKOFF_SCHEDULE_MS.length - 1,
      );
      const scheduledDelay = BACKOFF_SCHEDULE_MS[scheduleIdx];
      const retryAfter = readRetryAfterMs(err);
      // If the server hinted a Retry-After, prefer it when it's >= the
      // schedule delay (we never retry sooner than the server asked).
      const delayMs =
        retryAfter !== null && retryAfter > scheduledDelay
          ? retryAfter
          : scheduledDelay;

      if (elapsedMs + delayMs > BACKOFF_BUDGET_MS) throw err;

      opts.onBackoff?.({
        attemptNumber,
        retrySeconds: Math.max(1, Math.ceil(delayMs / 1000)),
      });

      await sleep(delayMs);
      elapsedMs += delayMs;
    }
  }
}

/**
 * Is this error an Anthropic 429? We check three levels in order:
 *   1. `RateLimitError` instance — the SDK's typed 429.
 *   2. A plain `status === 429` field — covers hand-rolled errors.
 *   3. Message regex — last-resort fallback mirrors the existing
 *      classification in each agent's `errorHook`.
 */
export function is429(err: unknown): boolean {
  if (err instanceof RateLimitError) return true;
  if (typeof err === 'object' && err !== null) {
    const status = (err as { status?: unknown }).status;
    if (status === 429) return true;
  }
  const msg = err instanceof Error ? err.message : String(err);
  return /\b429\b|rate[- ]?limit/i.test(msg);
}

/**
 * Extract a `Retry-After` header value in milliseconds, if present.
 * Supports the numeric-seconds form (RFC 7231 §7.1.3). Returns null for
 * HTTP-date form (not used by Anthropic today) and for missing/invalid
 * values.
 *
 * The Anthropic SDK types `RateLimitError.headers` as
 * `Record<string, string | null | undefined>` — NOT a fetch `Headers`
 * object with a `.get()` method. We still accept the fetch-style shape
 * for robustness: some tests fabricate errors with a `Headers` double,
 * and a future SDK version might switch wire types.
 */
function readRetryAfterMs(err: unknown): number | null {
  if (typeof err !== 'object' || err === null) return null;
  const headers = (err as { headers?: unknown }).headers;
  if (headers === null || typeof headers !== 'object') return null;

  let raw: string | null = null;
  const getter = (headers as { get?: unknown }).get;
  if (typeof getter === 'function') {
    // Duck-type: fetch-style Headers (tests, future SDK versions).
    const value = (getter as (name: string) => string | null).call(
      headers,
      'retry-after',
    );
    if (typeof value === 'string') raw = value;
  } else {
    // SDK-native shape: plain record.
    const record = headers as Record<string, unknown>;
    const value = record['retry-after'] ?? record['Retry-After'];
    if (typeof value === 'string') raw = value;
  }

  const seconds = raw === null ? NaN : Number(raw);
  if (Number.isFinite(seconds) && seconds > 0) return seconds * 1_000;
  return null;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
