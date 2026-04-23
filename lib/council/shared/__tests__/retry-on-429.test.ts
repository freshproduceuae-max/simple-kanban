import { describe, it, expect, vi } from 'vitest';
import { RateLimitError } from '@anthropic-ai/sdk';
import {
  BACKOFF_BUDGET_MS,
  BACKOFF_SCHEDULE_MS,
  is429,
  retryOn429,
  type SoftPauseInfo,
} from '../retry-on-429';

/**
 * `RateLimitError` has a ctor signature bound to the SDK's internal
 * `Headers` type; for a unit test we fabricate one via its prototype
 * so `instanceof` checks pass without importing the full transport.
 */
function make429({
  message = 'Too Many Requests',
  retryAfter,
}: { message?: string; retryAfter?: string } = {}): Error {
  const err = Object.create(RateLimitError.prototype) as RateLimitError & {
    message: string;
    status: number;
    headers: { get: (name: string) => string | null };
  };
  err.message = message;
  err.status = 429;
  err.headers = {
    get: (name: string) =>
      name.toLowerCase() === 'retry-after' && retryAfter !== undefined
        ? retryAfter
        : null,
  };
  return err;
}

describe('is429', () => {
  it('detects a RateLimitError instance', () => {
    expect(is429(make429())).toBe(true);
  });
  it('detects a plain object with status === 429', () => {
    expect(is429({ status: 429, message: 'nope' })).toBe(true);
  });
  it('detects a 429 via message regex (last-resort)', () => {
    expect(is429(new Error('Got 429 back'))).toBe(true);
    expect(is429(new Error('rate limit exceeded'))).toBe(true);
    expect(is429(new Error('rate-limited'))).toBe(true);
  });
  it('returns false for unrelated errors', () => {
    expect(is429(new Error('network down'))).toBe(false);
    expect(is429({ status: 500 })).toBe(false);
    expect(is429('timeout')).toBe(false);
  });
});

describe('retryOn429', () => {
  it('returns the attempt result on first success (no sleep)', async () => {
    const sleep = vi.fn(async () => {});
    const onBackoff = vi.fn();
    const attempt = vi.fn(async () => 'ok');
    const result = await retryOn429({ attempt, sleep, onBackoff });
    expect(result).toBe('ok');
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
    expect(onBackoff).not.toHaveBeenCalled();
  });

  it('retries on 429 and resolves on later success', async () => {
    const sleep = vi.fn(async () => {});
    const onBackoff = vi.fn();
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(make429())
      .mockResolvedValueOnce('recovered');
    const result = await retryOn429({ attempt, sleep, onBackoff });
    expect(result).toBe('recovered');
    expect(attempt).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(BACKOFF_SCHEDULE_MS[0]);
    expect(onBackoff).toHaveBeenCalledTimes(1);
    expect(onBackoff).toHaveBeenCalledWith<
      [SoftPauseInfo]
    >({ attemptNumber: 1, retrySeconds: 1 });
  });

  it('rethrows non-429 errors immediately without backoff', async () => {
    const sleep = vi.fn(async () => {});
    const onBackoff = vi.fn();
    const networkErr = new Error('connection refused');
    const attempt = vi.fn(async () => {
      throw networkErr;
    });
    await expect(retryOn429({ attempt, sleep, onBackoff })).rejects.toBe(
      networkErr,
    );
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
    expect(onBackoff).not.toHaveBeenCalled();
  });

  it('honors the schedule across repeated 429s', async () => {
    const sleep = vi.fn(async () => {});
    const onBackoff = vi.fn();
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(make429())
      .mockRejectedValueOnce(make429())
      .mockRejectedValueOnce(make429())
      .mockResolvedValueOnce('done');
    const result = await retryOn429({ attempt, sleep, onBackoff });
    expect(result).toBe('done');
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([1_000, 2_000, 4_000]);
    expect(onBackoff.mock.calls.map((c) => c[0])).toEqual([
      { attemptNumber: 1, retrySeconds: 1 },
      { attemptNumber: 2, retrySeconds: 2 },
      { attemptNumber: 3, retrySeconds: 4 },
    ]);
  });

  it('throws the last 429 when the cumulative budget would be exceeded', async () => {
    const sleep = vi.fn(async () => {});
    const onBackoff = vi.fn();
    const finalErr = make429({ message: 'final 429' });
    const attempt = vi
      .fn()
      // 1s + 2s + 4s + 8s = 15s. The fifth schedule step is 16s, and
      // 15 + 16 > 30 → budget exhausted. The 5th invocation throws the
      // 429 and retryOn429 rethrows it.
      .mockRejectedValueOnce(make429())
      .mockRejectedValueOnce(make429())
      .mockRejectedValueOnce(make429())
      .mockRejectedValueOnce(make429())
      .mockRejectedValueOnce(finalErr);
    await expect(retryOn429({ attempt, sleep, onBackoff })).rejects.toBe(
      finalErr,
    );
    expect(attempt).toHaveBeenCalledTimes(5);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([
      1_000,
      2_000,
      4_000,
      8_000,
    ]);
    expect(onBackoff).toHaveBeenCalledTimes(4);
    const totalSlept = sleep.mock.calls.reduce((acc, c) => acc + (c[0] as number), 0);
    expect(totalSlept).toBeLessThanOrEqual(BACKOFF_BUDGET_MS);
  });

  it('uses Retry-After when it exceeds the scheduled backoff', async () => {
    const sleep = vi.fn(async () => {});
    const onBackoff = vi.fn();
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(make429({ retryAfter: '3' })) // 3s > schedule[0]=1s
      .mockResolvedValueOnce('done');
    const result = await retryOn429({ attempt, sleep, onBackoff });
    expect(result).toBe('done');
    expect(sleep).toHaveBeenCalledWith(3_000);
    expect(onBackoff).toHaveBeenCalledWith({
      attemptNumber: 1,
      retrySeconds: 3,
    });
  });

  it('keeps scheduled backoff when Retry-After is shorter', async () => {
    const sleep = vi.fn(async () => {});
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(make429({ retryAfter: '0.1' }))
      .mockResolvedValueOnce('done');
    await retryOn429({ attempt, sleep });
    // schedule[0] wins (1000ms > 100ms).
    expect(sleep).toHaveBeenCalledWith(1_000);
  });

  it('treats plain {status:429} without headers as 429', async () => {
    const sleep = vi.fn(async () => {});
    const attempt = vi
      .fn()
      .mockRejectedValueOnce({ status: 429, message: 'Too Many' })
      .mockResolvedValueOnce('ok');
    const result = await retryOn429({ attempt, sleep });
    expect(result).toBe('ok');
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('accepts a duck-typed headers object with Retry-After', async () => {
    const sleep = vi.fn(async () => {});
    const attempt = vi
      .fn()
      .mockRejectedValueOnce({
        status: 429,
        headers: { 'retry-after': '5' },
        message: 'throttled',
      })
      .mockResolvedValueOnce('ok');
    await retryOn429({ attempt, sleep });
    expect(sleep).toHaveBeenCalledWith(5_000);
  });

  it('fires onBackoff before each sleep (order matters for the UI)', async () => {
    const events: string[] = [];
    const sleep = vi.fn(async (ms: number) => {
      events.push(`sleep:${ms}`);
    });
    const onBackoff = vi.fn((info: SoftPauseInfo) => {
      events.push(`onBackoff:${info.attemptNumber}`);
    });
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(make429())
      .mockRejectedValueOnce(make429())
      .mockResolvedValueOnce('done');
    await retryOn429({ attempt, sleep, onBackoff });
    expect(events).toEqual([
      'onBackoff:1',
      'sleep:1000',
      'onBackoff:2',
      'sleep:2000',
    ]);
  });
});
