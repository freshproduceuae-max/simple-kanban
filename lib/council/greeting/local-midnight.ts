/**
 * Compute the UTC instant corresponding to "today 00:00" in the user's
 * local timezone. Used by the F14 greeting route to decide whether a
 * given `lastSessionStartedAt` falls on today or a prior calendar day.
 *
 * Algorithm: probe the tz offset by formatting a known UTC instant
 * (today-in-tz at 00:00Z) through the tz, reading back the FULL local
 * date+time, computing `offsetMs = localMs - probeUtc`, then subtracting
 * the offset from `probeUtc` to land exactly on local midnight.
 *
 * Reading the full date+time (not just the clock) matters: for zones
 * west of UTC the probe falls on the PREVIOUS calendar day, so a
 * clock-only read produces a boundary 24 hours too early. This version
 * is signed-offset-correct on both sides of UTC, tested under Asia/Dubai,
 * Asia/Tokyo, UTC, and America/New_York.
 */
export function localMidnightBoundaryISO(
  tz: string,
  now: Date = new Date(),
): string {
  try {
    const dayFmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const ymd = dayFmt.format(now); // today Y-M-D in tz
    const probeUtc = new Date(`${ymd}T00:00:00Z`).getTime();

    const fullFmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = fullFmt.formatToParts(new Date(probeUtc));
    const g = (t: string) =>
      Number(parts.find((p) => p.type === t)?.value ?? '0');
    const localMs = Date.UTC(
      g('year'),
      g('month') - 1,
      g('day'),
      g('hour') % 24, // en-CA returns 24 at midnight on some runtimes
      g('minute'),
      g('second'),
    );
    // offsetMs = localMs - probeUtc.
    //   east-of-UTC: probe reads LATER on same/next day → positive.
    //   west-of-UTC: probe reads EARLIER on previous day → negative.
    // Local midnight in UTC = probeUtc - offsetMs, which adds back for
    // negative offsets and subtracts for positive ones.
    const offsetMs = localMs - probeUtc;
    return new Date(probeUtc - offsetMs).toISOString();
  } catch {
    return new Date(now.toISOString().slice(0, 10) + 'T00:00:00Z').toISOString();
  }
}
