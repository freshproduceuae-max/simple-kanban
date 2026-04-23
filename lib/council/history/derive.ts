import type {
  CouncilMode,
  CouncilSessionRow,
  CouncilSessionStatsRow,
  CouncilTurnRow,
} from '@/lib/persistence/types';

/**
 * F19 — pure derivations for the Session history list view.
 *
 * The /history page renders one row per session with columns per PRD
 * §10.3:
 *
 *   timestamp | mode | title | duration | outcome | token cost
 *
 * Keeping the derivations pure (no DB access, no Date.now()) so the
 * row-shape can be unit-tested without Supabase mocks. The page
 * component does the I/O; this module does the math.
 */

export const FALLBACK_TITLE = '(no messages)';
export const MAX_TITLE_CHARS = 60;

export type SessionHistoryRow = {
  id: string;
  mode: CouncilMode;
  startedAt: string;
  endedAt: string | null;
  /** First user turn content, truncated. Fallback for empty sessions. */
  title: string;
  /** Total tokens (in + out) across every turn in the session. */
  tokenCost: number;
  /** Number of turns — useful for "ongoing" sessions that lack a duration. */
  turnCount: number;
  /**
   * Short human label: "done", "ongoing", or "empty". F20/F21 refine
   * this once the error-state signal lands in the metrics table.
   */
  outcome: 'done' | 'ongoing' | 'empty';
  /** `ended_at - started_at` in ms, or null for still-ongoing rows. */
  durationMs: number | null;
};

export function deriveSessionTitle(turns: CouncilTurnRow[]): string {
  const firstUser = turns.find(
    (t) => t.role === 'user' && typeof t.content === 'string' && t.content.trim().length > 0,
  );
  if (!firstUser) return FALLBACK_TITLE;
  const clean = firstUser.content.trim().replace(/\s+/g, ' ');
  if (clean.length <= MAX_TITLE_CHARS) return clean;
  return `${clean.slice(0, MAX_TITLE_CHARS - 1).trimEnd()}…`;
}

export function sumSessionTokens(turns: CouncilTurnRow[]): number {
  return turns.reduce((acc, t) => acc + (t.tokens_in ?? 0) + (t.tokens_out ?? 0), 0);
}

export function deriveSessionOutcome(
  session: CouncilSessionRow,
  turns: CouncilTurnRow[],
): SessionHistoryRow['outcome'] {
  if (turns.length === 0) return 'empty';
  return session.ended_at ? 'done' : 'ongoing';
}

export function deriveDurationMs(session: CouncilSessionRow): number | null {
  if (!session.ended_at) return null;
  const start = Date.parse(session.started_at);
  const end = Date.parse(session.ended_at);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.max(0, end - start);
}

export function formatDuration(ms: number | null): string {
  if (ms == null) return '—';
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  return `${hours}h ${remMin}m`;
}

export function buildHistoryRow(
  session: CouncilSessionRow,
  turns: CouncilTurnRow[],
): SessionHistoryRow {
  return {
    id: session.id,
    mode: session.mode,
    startedAt: session.started_at,
    endedAt: session.ended_at,
    title: deriveSessionTitle(turns),
    tokenCost: sumSessionTokens(turns),
    turnCount: turns.length,
    outcome: deriveSessionOutcome(session, turns),
    durationMs: deriveDurationMs(session),
  };
}

/**
 * F28 — same `SessionHistoryRow` shape as `buildHistoryRow`, but
 * sourced from the `council_sessions_with_stats` view (one query per
 * page) instead of an N+1 turn fetch. Keeps the page component
 * identical when rendering either data path.
 *
 * `first_user_content` comes from the view's correlated subquery, so
 * title derivation is a pure string op.
 */
export function buildHistoryRowFromStats(
  stats: CouncilSessionStatsRow,
): SessionHistoryRow {
  return {
    id: stats.id,
    mode: stats.mode,
    startedAt: stats.started_at,
    endedAt: stats.ended_at,
    title: deriveTitleFromStats(stats.first_user_content),
    tokenCost: stats.total_tokens,
    turnCount: stats.turn_count,
    outcome: stats.outcome,
    durationMs: deriveDurationMs({
      // `deriveDurationMs` only needs started_at + ended_at; the view
      // gives us both. Shim the field shape without a fresh helper.
      id: stats.id,
      user_id: stats.user_id,
      mode: stats.mode,
      auth_session_id: null,
      started_at: stats.started_at,
      ended_at: stats.ended_at,
      summary_written_at: stats.summary_written_at,
    }),
  };
}

/**
 * Stats-view variant of `deriveSessionTitle`. The input is already
 * the first user turn's raw content (or null for empty sessions),
 * so we skip the turn-array scan and apply the same truncation rule.
 */
export function deriveTitleFromStats(
  firstUserContent: string | null,
): string {
  if (
    firstUserContent === null ||
    typeof firstUserContent !== 'string' ||
    firstUserContent.trim().length === 0
  ) {
    return FALLBACK_TITLE;
  }
  const clean = firstUserContent.trim().replace(/\s+/g, ' ');
  if (clean.length <= MAX_TITLE_CHARS) return clean;
  return `${clean.slice(0, MAX_TITLE_CHARS - 1).trimEnd()}…`;
}
