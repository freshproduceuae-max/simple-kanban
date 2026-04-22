import type {
  CouncilSessionRow,
  CouncilTurnRow,
  CouncilMode,
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
