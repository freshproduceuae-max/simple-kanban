import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetMarksForTesting, markOnce } from '../client-marks';

/**
 * F31 — client-side path-timing beacons.
 *
 * Four guarantees to hold:
 *   1. Each named beacon fires at most ONCE per session (a new user
 *      stopwatch run must not double-count a second mount).
 *   2. The call is a no-op on environments without `window` (SSR).
 *   3. Exceptions from `performance.mark` do not leak to the caller
 *      (Safari used to throw on duplicate buffer entries in low-memory
 *      conditions; we swallow).
 *   4. The underlying `performance.mark` is called exactly once per
 *      unique name.
 */

describe('markOnce', () => {
  beforeEach(() => {
    __resetMarksForTesting();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls performance.mark exactly once for a given name', () => {
    const spy = vi.spyOn(window.performance, 'mark');
    markOnce('council:session-mount');
    markOnce('council:session-mount');
    markOnce('council:session-mount');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('council:session-mount');
  });

  it('lets distinct beacons fire independently', () => {
    const spy = vi.spyOn(window.performance, 'mark');
    markOnce('council:session-mount');
    markOnce('council:greeting-complete');
    markOnce('council:first-user-submit');
    markOnce('council:first-proposal-tap');
    expect(spy).toHaveBeenCalledTimes(4);
    expect(spy.mock.calls.map((c) => c[0])).toEqual([
      'council:session-mount',
      'council:greeting-complete',
      'council:first-user-submit',
      'council:first-proposal-tap',
    ]);
  });

  it('swallows exceptions thrown by performance.mark', () => {
    vi.spyOn(window.performance, 'mark').mockImplementation(() => {
      throw new Error('duplicate mark buffer full');
    });
    expect(() => markOnce('council:session-mount')).not.toThrow();
  });

  it('is a no-op when the browser lacks performance.mark', () => {
    // Simulate an ancient WebView: performance exists but mark() is
    // undefined. markOnce should return cleanly, and the one-shot
    // guard should still trip (so if mark() later reappears on a
    // polyfill, we don't double-fire).
    const original = window.performance.mark;
    // @ts-expect-error — deliberately clobbering for this case.
    delete window.performance.mark;
    expect(() => markOnce('council:session-mount')).not.toThrow();
    window.performance.mark = original;
  });

  it('reset helper clears the guard so tests can simulate fresh mounts', () => {
    const spy = vi.spyOn(window.performance, 'mark');
    markOnce('council:session-mount');
    __resetMarksForTesting();
    markOnce('council:session-mount');
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
