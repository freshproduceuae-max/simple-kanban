import { describe, it, expect } from 'vitest';
import { localMidnightBoundaryISO } from '../local-midnight';

/**
 * F14 tz-math coverage. Fix for Codex P1 on PR #29: the earlier
 * version probed only the tz clock-time at UTC midnight and subtracted
 * it, which landed 24h early for zones west of UTC (where the probe
 * reads the PREVIOUS calendar day). Reading the full local date+time
 * makes the computed offset signed and correct on both sides of UTC.
 */
describe('localMidnightBoundaryISO (F14)', () => {
  // Pinned now = 2026-04-21T12:00:00Z (April → DST is in effect for
  // North America; both NY and London are on summer time).
  const now = new Date('2026-04-21T12:00:00Z');

  it('east-of-UTC: Asia/Dubai (UTC+4) → today local midnight is 20:00Z previous day', () => {
    expect(localMidnightBoundaryISO('Asia/Dubai', now)).toBe(
      '2026-04-20T20:00:00.000Z',
    );
  });

  it('west-of-UTC: America/New_York (UTC-4 DST) → today local midnight is 04:00Z same day', () => {
    // Regression: the bug computed 2026-04-20T04:00:00Z (one day early).
    expect(localMidnightBoundaryISO('America/New_York', now)).toBe(
      '2026-04-21T04:00:00.000Z',
    );
  });

  it('UTC: identity — today local midnight is 00:00Z same day', () => {
    expect(localMidnightBoundaryISO('UTC', now)).toBe(
      '2026-04-21T00:00:00.000Z',
    );
  });

  it('far east: Asia/Tokyo (UTC+9) → today local midnight is 15:00Z previous day', () => {
    expect(localMidnightBoundaryISO('Asia/Tokyo', now)).toBe(
      '2026-04-20T15:00:00.000Z',
    );
  });

  it('far west: Pacific/Honolulu (UTC-10) → today local midnight is 10:00Z same day', () => {
    expect(localMidnightBoundaryISO('Pacific/Honolulu', now)).toBe(
      '2026-04-21T10:00:00.000Z',
    );
  });

  it('falls back to UTC midnight on an invalid tz', () => {
    const out = localMidnightBoundaryISO('Not/A/Real_Zone', now);
    expect(out).toBe('2026-04-21T00:00:00.000Z');
  });
});
