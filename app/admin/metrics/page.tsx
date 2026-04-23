import { redirect } from 'next/navigation';
import { getAuthedAdmin } from '@/lib/auth/admin';
import { getMetricsRepository } from '@/lib/persistence/server';
import {
  parseWindowHours,
  summarize,
} from '@/lib/admin/metrics-view-model';
import { AdminMetricsView } from './AdminMetricsView';

/**
 * F26 — `/admin/metrics` baseline dashboard.
 *
 * Server Component. Gates the page on `ADMIN_EMAIL` (single-user v0.4):
 *   - not-authenticated → `/sign-in`
 *   - authenticated but not admin → `/` (no hint that the surface
 *     exists, matches conventional admin-posture)
 *
 * Reads rows from `council_metrics` for the admin's own `user_id` —
 * v0.4 is single-user, so admin rows = all rows. `listForUser` caps
 * at 2000 rows; at v0.4-beta volume that covers ≥ 7d comfortably.
 *
 * Aggregation is a pure transform in `metrics-view-model.ts` so the
 * page stays thin.
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

  const repo = getMetricsRepository();
  const rows = await repo.listForUser({
    userId: admin.userId,
    sinceIso,
    limit: 2000,
  });

  const summary = summarize(rows, { windowHours, windowStartIso: sinceIso });

  return <AdminMetricsView summary={summary} adminEmail={admin.email} />;
}
