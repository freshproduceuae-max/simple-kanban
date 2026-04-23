import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAuthedUserId } from '@/lib/auth/current-user';
import { getSessionRepository } from '@/lib/persistence/server';
import {
  buildHistoryRowFromStats,
  formatDuration,
  type SessionHistoryRow,
} from '@/lib/council/history/derive';
import type { CouncilMode, SessionOutcome } from '@/lib/persistence/types';
import { deleteSessionAction } from './actions';

/**
 * F28 — searchable + filterable Session history.
 *
 * Server Component, same shape as the F19 list but reading
 * `council_sessions_with_stats` (migration 015) via
 * `searchSessionsForUser`. The view exposes per-session token
 * totals, derived outcome, and the first user-turn content, so the
 * page renders a full-detail row without an N+1 turn fetch.
 *
 * Filter controls are a plain `<form method="get">` so no client
 * island is needed — the form submits the same `?search`/`?mode` etc
 * search params this component reads. Keyset cursor (`?cursor=`) is
 * preserved across filter changes by embedding it as a hidden input;
 * filter edits reset to page 1 by not including the hidden cursor
 * field in that form path.
 */

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PAGE_SIZE = 25;
const MODE_VALUES: readonly CouncilMode[] = [
  'greeting',
  'plan',
  'advise',
  'chat',
];
const OUTCOME_VALUES: readonly SessionOutcome[] = [
  'done',
  'ongoing',
  'empty',
];

type HistorySearchParams = {
  cursor?: string;
  q?: string;
  mode?: string | string[];
  outcome?: string | string[];
  from?: string;
  to?: string;
  tokenMin?: string;
  tokenMax?: string;
  /** F29 — set to `1` after a successful per-session delete. */
  deleted?: string;
  /**
   * F29 — set to the failure code by `deleteSessionAction` when the
   * per-row delete can't complete. Recognised values:
   *   `invalid`  — session id missing or not a UUID
   *   `missing`  — id was well-formed but matched no owned row
   *   `failed`   — repository threw
   */
  deleteError?: string;
};

const DELETE_ERROR_COPY: Record<string, string> = {
  invalid: 'That delete link looked off, so nothing was removed.',
  missing:
    'That session was already gone — maybe from another tab. Nothing left to delete.',
  failed: 'Something went wrong deleting the session. Please try again.',
};

type HistoryPageProps = {
  searchParams?: HistorySearchParams;
};

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  let userId: string;
  try {
    userId = await getAuthedUserId();
  } catch {
    redirect('/sign-in');
  }

  const parsed = parseSearchParams(searchParams ?? {});
  const sessionRepo = getSessionRepository();

  const stats = await sessionRepo.searchSessionsForUser({
    userId,
    opts: {
      query: parsed.query,
      modes: parsed.modes.length > 0 ? parsed.modes : undefined,
      outcomes: parsed.outcomes.length > 0 ? parsed.outcomes : undefined,
      dateFrom: parsed.dateFrom,
      dateTo: parsed.dateTo,
      tokenMin: parsed.tokenMin,
      tokenMax: parsed.tokenMax,
      limit: PAGE_SIZE,
      cursor: parsed.cursor,
    },
  });

  const rows: SessionHistoryRow[] = stats.map(buildHistoryRowFromStats);

  // Keyset: the next-page cursor is the last row's `startedAt` — but
  // only when the page came back full. A short page means we've hit
  // the tail of the window.
  const nextCursor =
    rows.length === PAGE_SIZE ? rows[rows.length - 1].startedAt : null;

  const filterActive = isAnyFilterActive(parsed);
  const olderHref = nextCursor
    ? buildHref({ ...parsed, cursor: nextCursor })
    : null;

  // F29 — post-delete banner. Only shown on the render right after
  // the action redirects; the flag falls off on any subsequent
  // navigation (including the "Older sessions" link) because the
  // keyset `buildHref` doesn't copy these one-shot params forward.
  const deleteNotice: { kind: 'success' | 'error'; message: string } | null =
    typeof searchParams?.deleteError === 'string' &&
    DELETE_ERROR_COPY[searchParams.deleteError]
      ? {
          kind: 'error',
          message: DELETE_ERROR_COPY[searchParams.deleteError],
        }
      : searchParams?.deleted === '1'
        ? { kind: 'success', message: 'Session deleted.' }
        : null;

  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="text-2xl">Session history</h1>
      <p className="mt-2 text-sm text-[color:var(--color-ink-500)]">
        Full-text search across every turn. Filter by mode, date,
        token cost, or outcome.
      </p>

      {deleteNotice ? (
        <p
          className={`mt-4 rounded border px-3 py-2 text-sm ${
            deleteNotice.kind === 'success'
              ? 'border-[color:var(--color-border-default)] text-[color:var(--color-ink-700)]'
              : 'border-red-300 text-red-700'
          }`}
          data-history-delete-notice={deleteNotice.kind}
          role="status"
        >
          {deleteNotice.message}
        </p>
      ) : null}

      <HistoryFilters parsed={parsed} />

      {filterActive ? (
        <p className="mt-4 text-xs text-[color:var(--color-ink-500)]">
          {rows.length} result{rows.length === 1 ? '' : 's'} on this
          page.{' '}
          {/* F32 — 44px tap floor on the inline reset link. */}
          <Link
            href="/history"
            className="inline-flex items-center justify-center min-h-tap min-w-tap align-middle underline"
          >
            Clear filters
          </Link>
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p
          className="mt-8 text-sm"
          data-history-empty={filterActive ? 'filtered' : 'none'}
        >
          {filterActive
            ? 'No sessions match these filters on this page.'
            : 'No sessions yet. Open the Council shelf and say hello.'}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table
            className="w-full border-collapse text-sm"
            data-history-table=""
          >
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-4 font-normal">When</th>
                <th className="py-2 pr-4 font-normal">Mode</th>
                <th className="py-2 pr-4 font-normal">Title</th>
                <th className="py-2 pr-4 font-normal">Duration</th>
                <th className="py-2 pr-4 font-normal">Outcome</th>
                <th className="py-2 pr-4 font-normal text-right">Tokens</th>
                {/* F29 — per-row delete. Empty heading on purpose;
                    a label would compete with the data columns. */}
                <th className="py-2 pr-2 font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b last:border-b-0"
                  data-history-row={r.id}
                >
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
                  <td className="py-2 pr-2 text-right whitespace-nowrap">
                    {/* Inline Server Action form. No client island
                        is needed — the browser handles submit and
                        Next re-renders /history on the redirect. */}
                    <form action={deleteSessionAction}>
                      <input
                        type="hidden"
                        name="sessionId"
                        value={r.id}
                      />
                      <button
                        type="submit"
                        // F32 — min-h-tap lifts the per-row delete to
                        // the 44px mobile floor without enlarging the
                        // visual chip (kept at text-xs underlined).
                        className="inline-flex items-center justify-center min-h-tap min-w-tap text-xs text-[color:var(--color-ink-500)] underline hover:text-red-700"
                        data-history-row-delete={r.id}
                        aria-label={`Delete session from ${formatTimestamp(
                          r.startedAt,
                        )}`}
                      >
                        Delete
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {olderHref ? (
        <div className="mt-6">
          <Link
            href={olderHref}
            // F32 — 44px tap floor on the pagination link.
            className="inline-flex items-center justify-center min-h-tap min-w-tap text-sm underline"
          >
            Older sessions →
          </Link>
        </div>
      ) : null}
    </main>
  );
}

/**
 * Filter form. Plain `<form method="get" action="/history">` — the
 * browser handles the submit and re-renders this same Server
 * Component with the new searchParams. Leaving `cursor` out of the
 * form means any filter edit resets to the first page, which is the
 * right default: the old cursor references a position in a different
 * result set.
 */
function HistoryFilters({
  parsed,
}: {
  parsed: ReturnType<typeof parseSearchParams>;
}): JSX.Element {
  return (
    <form
      method="get"
      action="/history"
      className="mt-6 grid gap-3 sm:grid-cols-2 md:grid-cols-3"
      data-history-filters=""
    >
      <label className="flex flex-col gap-1 md:col-span-3">
        <span className="text-xs text-[color:var(--color-ink-500)]">
          Search
        </span>
        <input
          type="search"
          name="q"
          defaultValue={parsed.query ?? ''}
          placeholder="search every turn"
          className="rounded border min-h-tap px-2 py-1 text-sm"
          data-history-filter="q"
        />
      </label>

      <fieldset
        className="flex flex-col gap-1"
        data-history-filter="mode"
      >
        <legend className="text-xs text-[color:var(--color-ink-500)]">
          Mode
        </legend>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
          {MODE_VALUES.map((m) => (
            <label key={m} className="inline-flex items-center gap-1">
              <input
                type="checkbox"
                name="mode"
                value={m}
                defaultChecked={parsed.modes.includes(m)}
              />
              <span className="capitalize">{m}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset
        className="flex flex-col gap-1"
        data-history-filter="outcome"
      >
        <legend className="text-xs text-[color:var(--color-ink-500)]">
          Outcome
        </legend>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
          {OUTCOME_VALUES.map((o) => (
            <label key={o} className="inline-flex items-center gap-1">
              <input
                type="checkbox"
                name="outcome"
                value={o}
                defaultChecked={parsed.outcomes.includes(o)}
              />
              <span className="capitalize">{o}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-[color:var(--color-ink-500)]">
          From
        </span>
        <input
          type="date"
          name="from"
          defaultValue={parsed.dateFromInput}
          className="rounded border min-h-tap px-2 py-1 text-sm"
          data-history-filter="from"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-[color:var(--color-ink-500)]">
          To
        </span>
        <input
          type="date"
          name="to"
          defaultValue={parsed.dateToInput}
          className="rounded border min-h-tap px-2 py-1 text-sm"
          data-history-filter="to"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-[color:var(--color-ink-500)]">
          Min tokens
        </span>
        <input
          type="number"
          min={0}
          name="tokenMin"
          defaultValue={
            typeof parsed.tokenMin === 'number' ? parsed.tokenMin : ''
          }
          className="rounded border min-h-tap px-2 py-1 text-sm"
          data-history-filter="tokenMin"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-[color:var(--color-ink-500)]">
          Max tokens
        </span>
        <input
          type="number"
          min={0}
          name="tokenMax"
          defaultValue={
            typeof parsed.tokenMax === 'number' ? parsed.tokenMax : ''
          }
          className="rounded border min-h-tap px-2 py-1 text-sm"
          data-history-filter="tokenMax"
        />
      </label>

      <div className="flex gap-2 sm:col-span-2 md:col-span-3">
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded border min-h-tap min-w-tap px-3 py-1 text-sm"
          data-history-filter-apply=""
        >
          Apply
        </button>
        <Link
          href="/history"
          className="inline-flex items-center justify-center rounded border min-h-tap min-w-tap px-3 py-1 text-sm"
          data-history-filter-reset=""
        >
          Reset
        </Link>
      </div>
    </form>
  );
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Pull the search params into shape: trimmed strings, validated
 * enums, clamped numbers, and `dateFrom` / `dateTo` converted from
 * browser-native `yyyy-mm-dd` to the full-day ISO bounds we want to
 * pass through to the repository (`00:00:00Z` / `23:59:59.999Z`).
 *
 * Invalid or out-of-range values are silently dropped — the page
 * should never hard-fail on a hand-rolled URL; the filter simply
 * doesn't apply. The `Input` field defaults come back unchanged so
 * the user can see their typo.
 */
function parseSearchParams(raw: HistorySearchParams): {
  query?: string;
  modes: CouncilMode[];
  outcomes: SessionOutcome[];
  dateFrom?: string;
  dateTo?: string;
  dateFromInput?: string;
  dateToInput?: string;
  tokenMin?: number;
  tokenMax?: number;
  cursor?: string;
} {
  const query =
    typeof raw.q === 'string' && raw.q.trim().length > 0
      ? raw.q.trim()
      : undefined;

  const modes = toStringArray(raw.mode).filter((v): v is CouncilMode =>
    (MODE_VALUES as readonly string[]).includes(v),
  );

  const outcomes = toStringArray(raw.outcome).filter(
    (v): v is SessionOutcome =>
      (OUTCOME_VALUES as readonly string[]).includes(v),
  );

  // `yyyy-mm-dd` is the browser-native <input type="date"> format,
  // and we want it round-trippable: drop anything whose `Date.parse`
  // is NaN (covers "2026-13-40"-style impossible dates the regex
  // would otherwise wave through).
  const dateFromInput = isValidDateInput(raw.from) ? raw.from! : undefined;
  const dateToInput = isValidDateInput(raw.to) ? raw.to! : undefined;
  // `from` covers the whole day starting at UTC midnight; `to` covers
  // up to the very last tick of the day. Both sides inclusive is what
  // users reading a human date range will expect.
  const dateFrom = dateFromInput
    ? `${dateFromInput}T00:00:00.000Z`
    : undefined;
  const dateTo = dateToInput
    ? `${dateToInput}T23:59:59.999Z`
    : undefined;

  const tokenMin = parseNonNegativeInt(raw.tokenMin);
  const tokenMax = parseNonNegativeInt(raw.tokenMax);

  const cursor =
    typeof raw.cursor === 'string' && raw.cursor.length > 0
      ? raw.cursor
      : undefined;

  return {
    query,
    modes,
    outcomes,
    dateFrom,
    dateTo,
    dateFromInput,
    dateToInput,
    tokenMin,
    tokenMax,
    cursor,
  };
}

function isAnyFilterActive(
  parsed: ReturnType<typeof parseSearchParams>,
): boolean {
  return (
    !!parsed.query ||
    parsed.modes.length > 0 ||
    parsed.outcomes.length > 0 ||
    !!parsed.dateFrom ||
    !!parsed.dateTo ||
    typeof parsed.tokenMin === 'number' ||
    typeof parsed.tokenMax === 'number'
  );
}

function toStringArray(v: string | string[] | undefined): string[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

function isValidDateInput(v: string | undefined): boolean {
  if (typeof v !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  // Reject impossible calendar dates. `Date.parse` returns NaN for
  // obvious overflows (month 13) but silently normalises day
  // overflows (Feb 30 → Mar 2), which would then pass straight
  // through to Postgres and crash the render with a `22008
  // datetime field overflow`. The round-trip comparison catches both.
  const ms = Date.parse(`${v}T00:00:00.000Z`);
  if (Number.isNaN(ms)) return false;
  const normalized = new Date(ms).toISOString().slice(0, 10);
  return normalized === v;
}

function parseNonNegativeInt(v: string | undefined): number | undefined {
  if (typeof v !== 'string' || v.trim().length === 0) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return undefined;
  return n;
}

/**
 * Build the `/history?...` URL for the "Older sessions" link,
 * preserving every active filter alongside the new cursor. Uses
 * `URLSearchParams` so array params (`mode`, `outcome`) round-trip as
 * repeated keys, which is the shape the form submits and the shape
 * this page reads.
 */
function buildHref(
  parsed: ReturnType<typeof parseSearchParams> & { cursor?: string },
): string {
  const params = new URLSearchParams();
  if (parsed.query) params.set('q', parsed.query);
  for (const m of parsed.modes) params.append('mode', m);
  for (const o of parsed.outcomes) params.append('outcome', o);
  if (parsed.dateFromInput) params.set('from', parsed.dateFromInput);
  if (parsed.dateToInput) params.set('to', parsed.dateToInput);
  if (typeof parsed.tokenMin === 'number') {
    params.set('tokenMin', String(parsed.tokenMin));
  }
  if (typeof parsed.tokenMax === 'number') {
    params.set('tokenMax', String(parsed.tokenMax));
  }
  if (parsed.cursor) params.set('cursor', parsed.cursor);
  const qs = params.toString();
  return qs.length > 0 ? `/history?${qs}` : '/history';
}
