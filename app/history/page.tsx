import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAuthedUserId } from '@/lib/auth/current-user';
import { getSessionRepository } from '@/lib/persistence/server';
import {
  buildHistoryRow,
  formatDuration,
  type SessionHistoryRow,
} from '@/lib/council/history/derive';

/**
 * F19 — Session history (read-only list view).
 *
 * Server Component. Per PRD §10.3 columns: timestamp, mode, title,
 * duration, outcome, token cost. Pagination is a simple `?cursor`
 * param holding the `started_at` ISO of the last row the user saw;
 * search/filter land at F28.
 *
 * The title is derived from the first user turn in the session (or a
 * fallback for empty sessions). That read is N+1 — one `listTurns`
 * call per session — which is fine at v0.4 alpha page sizes. A proper
 * denormalized `sessions_with_stats` view can replace this in v0.5.
 */

export const dynamic = 'force-dynamic'; // always-fresh per user
export const revalidate = 0;

const PAGE_SIZE = 25;

type HistoryPageProps = {
  searchParams?: { cursor?: string };
};

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  let userId: string;
  try {
    userId = await getAuthedUserId();
  } catch {
    redirect('/sign-in');
  }

  const sessionRepo = getSessionRepository();
  const cursor =
    typeof searchParams?.cursor === 'string' && searchParams.cursor.length > 0
      ? searchParams.cursor
      : undefined;

  const sessions = await sessionRepo.listSessionsForUser(userId, {
    limit: PAGE_SIZE,
    cursor,
  });

  const rows: SessionHistoryRow[] = await Promise.all(
    sessions.map(async (s) => {
      const turns = await sessionRepo.listTurns(s.id);
      return buildHistoryRow(s, turns);
    }),
  );

  const nextCursor =
    rows.length === PAGE_SIZE ? rows[rows.length - 1].startedAt : null;

  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="text-2xl">Session history</h1>
      <p className="mt-2 text-sm text-[color:var(--color-ink-500)]">
        Read-only. Search and filters land with F28.
      </p>

      {rows.length === 0 ? (
        <p className="mt-8 text-sm">
          No sessions yet. Open the Council shelf and say hello.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-4 font-normal">When</th>
                <th className="py-2 pr-4 font-normal">Mode</th>
                <th className="py-2 pr-4 font-normal">Title</th>
                <th className="py-2 pr-4 font-normal">Duration</th>
                <th className="py-2 pr-4 font-normal">Outcome</th>
                <th className="py-2 pr-4 font-normal text-right">Tokens</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-b-0">
                  <td className="py-2 pr-4 whitespace-nowrap">
                    {formatTimestamp(r.startedAt)}
                  </td>
                  <td className="py-2 pr-4 capitalize">{r.mode}</td>
                  <td className="py-2 pr-4">{r.title}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    {formatDuration(r.durationMs)}
                  </td>
                  <td className="py-2 pr-4 capitalize">{r.outcome}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {r.tokenCost.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {nextCursor ? (
        <div className="mt-6">
          <Link
            href={`/history?cursor=${encodeURIComponent(nextCursor)}`}
            className="text-sm underline"
          >
            Older sessions →
          </Link>
        </div>
      ) : null}
    </main>
  );
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // Keep it compact — the full ISO is available in the DOM via the
  // title attribute on the cell if we want to expose it later.
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
