import { NextResponse } from 'next/server';
import { getAuthedUserId } from '@/lib/auth/current-user';
import { getTaskRepository } from '@/lib/persistence/server';
import {
  composeFullGreeting,
  deriveGreetingSignals,
  shortReentryLine,
  SHORT_REENTRY_LINE,
} from '@/lib/council/greeting';
import { lastSessionStartedAt } from '@/lib/council/greeting/last-session';
import { CouncilMemoryRepositoryNotImplemented } from '@/lib/persistence/council-memory-repository';

/**
 * POST /api/council/greeting (F14).
 *
 * Returns one of:
 *   - a text/plain streaming response of the full morning greeting
 *     (≤ 200 chars, thinking-stream on the client renders chunk-by-chunk)
 *     when this is the first open for the user's local calendar day
 *   - a short re-entry line (JSON) on subsequent same-day opens
 *
 * The caller sends `{ tz: "America/New_York" }` so the first-of-day
 * decision uses the user's local midnight, not the server's. If `tz`
 * is missing or invalid we fall back to UTC — a slightly-off-day
 * boundary is a graceful degrade, not a failure.
 *
 * "First open for the day" is inferred from the most recent session
 * row in `council_sessions`: if the last started_at is on or after
 * the local-midnight boundary, we return the re-entry line.
 *
 * Memory is read via CouncilMemoryRepositoryNotImplemented — that
 * stub throws, the greeting composer swallows it, and we still
 * produce a real greeting from board signals alone. F18 swaps in the
 * real memory repo without touching this file.
 */

type GreetingRequest = { tz?: string };

function localMidnightBoundaryISO(tz: string, now: Date = new Date()): string {
  // Compute the UTC instant corresponding to "today 00:00 in tz".
  // Approach: (1) figure out today's Y-M-D in tz, (2) probe what tz
  // reports as the clock for the UTC instant Y-M-D 00:00Z, (3) shift
  // by the probed offset. Works for any tz without a date library.
  try {
    const dayFmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const ymd = dayFmt.format(now); // "YYYY-MM-DD"
    const probeUtc = new Date(`${ymd}T00:00:00Z`).getTime();

    const clockFmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const clockParts = clockFmt.formatToParts(new Date(probeUtc));
    const g = (t: string) =>
      Number(clockParts.find((p) => p.type === t)?.value ?? '0');
    const hh = g('hour') % 24; // en-CA returns 24 at midnight on some runtimes
    const mm = g('minute');
    const ss = g('second');
    const clockMsInTz = (hh * 60 * 60 + mm * 60 + ss) * 1000;
    // If tz clock at probeUtc reads 04:00, then tz is UTC+4. Today's
    // local midnight in tz corresponds to probeUtc - 4h UTC.
    return new Date(probeUtc - clockMsInTz).toISOString();
  } catch {
    return new Date(now.toISOString().slice(0, 10) + 'T00:00:00Z').toISOString();
  }
}

export async function POST(request: Request) {
  let userId: string;
  try {
    userId = await getAuthedUserId();
  } catch {
    return NextResponse.json({ error: 'not-authenticated' }, { status: 401 });
  }

  let body: GreetingRequest = {};
  try {
    body = ((await request.json()) as GreetingRequest) ?? {};
  } catch {
    // Body is optional — {} is fine.
  }
  const tz = typeof body.tz === 'string' && body.tz.length > 0 ? body.tz : 'UTC';
  const boundaryISO = localMidnightBoundaryISO(tz);

  // First-of-day check.
  const lastAt = await lastSessionStartedAt(userId);
  const isFirstOfDay = lastAt == null || lastAt < boundaryISO;

  // Pull the board snapshot (memory-only — no web on the greeting).
  let tasks: Awaited<ReturnType<ReturnType<typeof getTaskRepository>['listForUser']>> = [];
  try {
    tasks = await getTaskRepository().listForUser(userId);
  } catch {
    // Cold DB: still produce a greeting from empty signals.
  }
  const daysSinceLast =
    lastAt == null
      ? null
      : Math.max(
          0,
          Math.floor((Date.now() - new Date(lastAt).getTime()) / (24 * 60 * 60 * 1000)),
        );

  const signals = deriveGreetingSignals(
    { tasks, daysSinceLastSession: daysSinceLast },
  );

  if (!isFirstOfDay) {
    return NextResponse.json({
      kind: 'reentry',
      text: shortReentryLine(signals) || SHORT_REENTRY_LINE,
    });
  }

  // Full greeting — stream as text/plain.
  const { stream, done } = await composeFullGreeting(
    { userId, signals },
    { memoryRepo: new CouncilMemoryRepositoryNotImplemented() },
  );

  const encoder = new TextEncoder();
  const webStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch {
        controller.enqueue(encoder.encode(''));
      } finally {
        // Await done so cap/ledger math completes before the response
        // closes — not critical in v0.4 alpha but keeps future metrics
        // integration clean.
        await done;
        controller.close();
      }
    },
  });

  return new Response(webStream, {
    status: 200,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'x-greeting-kind': 'full',
    },
  });
}
