/**
 * F31 — client-side path-timing beacons.
 *
 * The first-run onboarding gate (vision §6) targets "new user reaches a
 * meaningful Council interaction in under 60 seconds." F21's server-side
 * metrics capture per-Anthropic-call latency, but they miss client-felt
 * gaps: page mount → greeting ready → first user submit → first proposal
 * tap. These marks fill that gap. The stopwatch-QA session described in
 * `docs/releases/v0.4-council/f31-onboarding-qa-protocol.md` reads them
 * via `performance.getEntriesByName('council:<beacon>')` so the run can
 * be reviewed without a screen-recorder in the loop.
 *
 * Design constraints:
 *   - SSR-safe: no-ops on the server (where `performance` exists in
 *     Node 16+ but `window` does not). We check for `window` to be
 *     conservative about the Next.js App Router's edge/runtime split.
 *   - Idempotent per mark: the beacons we care about fire at most once
 *     per session. A user who greets, chats, greets again in a new
 *     window has two separate `performance` objects anyway — each
 *     fresh — so one-shot semantics match reality.
 *   - Zero external side effects. No network, no DOM writes. If the
 *     browser lacks `performance.mark` (very old WebView), we silently
 *     return.
 *
 * The beacon name prefix `council:` groups them into one filter in
 * DevTools' Performance tab and avoids collision with the Long Tasks
 * API and other PerformanceEntry consumers.
 */

type BeaconName =
  | 'council:session-mount'
  | 'council:greeting-complete'
  | 'council:first-user-submit'
  | 'council:first-proposal-tap';

/**
 * One-shot guard. Module-scoped, so it survives React re-renders and
 * Strict Mode double-invocations. Known dev-mode quirk: Next.js Fast
 * Refresh preserves non-component module identity across HMR cycles,
 * so this Set keeps its entries when a component is hot-reloaded.
 * The `council:*` beacon will appear "missing" on the next mount in
 * dev after an edit. Not a production issue — the stopwatch QA
 * protocol runs on a fresh load. Call `__resetMarksForTesting()` in
 * a devtools console if you need to verify a clean run during dev.
 */
const fired = new Set<BeaconName>();

/**
 * Record a one-shot client-side beacon. Subsequent calls with the same
 * name are ignored. The call is a no-op in non-browser environments.
 */
export function markOnce(name: BeaconName): void {
  if (fired.has(name)) return;
  fired.add(name);
  if (typeof window === 'undefined') return;
  const perf = window.performance;
  if (!perf || typeof perf.mark !== 'function') return;
  try {
    perf.mark(name);
  } catch {
    // Some browsers throw if a duplicate mark name is used under a
    // non-standard buffer. Swallow — the beacon is best-effort.
  }
}

/**
 * Test-only: reset the one-shot guard so a spec can simulate multiple
 * mount/greet cycles in the same JSDOM instance. Production callers
 * must not import this.
 */
export function __resetMarksForTesting(): void {
  fired.clear();
  if (typeof window !== 'undefined') {
    window.performance?.clearMarks?.();
  }
}
