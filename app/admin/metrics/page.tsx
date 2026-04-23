import { redirect } from 'next/navigation';
import { getAuthedAdmin } from '@/lib/auth/admin';
import {
  getAdminErrorEventsRepository,
  getMetricsRepository,
  getSessionRepository,
} from '@/lib/persistence/server';
import type { CouncilMode } from '@/lib/persistence/types';
import {
  parseWindowHours,
  summarize,
} from '@/lib/admin/metrics-view-model';
import { AdminMetricsView } from './AdminMetricsView';

/**
 * `/admin/metrics` — CD-only dashboard.
 *
 * Server Component. Gates the page on `ADMIN_EMAIL` (single-user v0.4):
 *   - not-authenticated → `/sign-in`
 *   - authenticated but not admin → `/` (no hint that the surface
 *     exists, matches conventional admin-posture)
 *
 * F26 baseline reads `council_metrics`; F27 layers in:
 *   - `council_sessions` mode lookup for SLO evaluation per PRD §13.3
 *     (SLOs are indexed by surface/mode, not by agent, so we need to
 *     join metric rows → sessions → mode to split Consolidator
 *     latencies correctly)
 *   - `admin_error_events` count for the error-email failure counter
 *
 * All repository reads are parallelised — they share `admin.userId`
 * but don't depend on each other's results, so a single `Promise.all`
 * is the obvious shape.
 */

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type AdminMetricsPageProps = {
  searchParams?: { window?: string };
};

export default async function AdminMetricsPage({
  searchParams,
}: AdminMetricsPageProps) {
  let admin: { userId: string; email: string };
  try {
    admin = await getAuthedAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'not-authenticated') {
      redirect('/sign-in');
    }
    // `not-admin` and anything else: send them home.
    redirect('/');
  }

  const windowHours = parseWindowHours(searchParams?.window);
  const sinceIso = new Date(
    Date.now() - windowHours * 60 * 60 * 1000,
  ).toISOString();

  const metricsRepo = getMetricsRepository();
  const errorEventsRepo = getAdminErrorEventsRepository();

  // First trip: the two independent reads that don't depend on the
  // metric rows themselves.
  const [rows, errorEmailFailures] = await Promise.all([
    metricsRepo.listForUser({
      userId: admin.userId,
      sinceIso,
      limit: 2000,
    }),
    errorEventsRepo.countSince({
      userId: admin.userId,
      sinceIso,
      kind: 'email_send_failed',
    }),
  ]);

  // Second trip: session mode lookup. We collect the distinct
  // session_ids that actually appear in the window rather than
  // fetching every session in the window — the metric row set is
  // already bounded to 2000, so the id list is bounded too, and
  // sessions with no metrics don't contribute to SLO evaluation.
  const sessionIds = Array.from(
    new Set(
      rows
        .map((r) => r.session_id)
        .filter((id): id is string => typeof id === 'string'),
    ),
  );
  let sessionModeById: ReadonlyMap<string, CouncilMode> = new Map();
  if (sessionIds.length > 0) {
    const sessionsRepo = getSessionRepository();
    const sessions = await sessionsRepo.listSessionsByIds({
      userId: admin.userId,
      sessionIds,
    });
    sessionModeById = new Map(sessions.map((s) => [s.id, s.mode]));
  }

  const summary = summarize(rows, {
    windowHours,
    windowStartIso: sinceIso,
    sessionModeById,
    errorEmailFailures,
  });

  return <AdminMetricsView summary={summary} adminEmail={admin.email} />;
}
