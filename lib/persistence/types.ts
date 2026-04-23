/**
 * Shared row types for the persistence layer.
 * Tables match the Supabase migrations under supabase/migrations.
 * Feature PRs (F02, F05, F12, F18, F19, F21, F25) fill in fields as needed.
 */

export type BoardColumn = 'todo' | 'in_progress' | 'done';

export interface TaskRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  board_column: BoardColumn;
  position: number;
  overdue_at: string | null;
  created_at: string;
  updated_at: string;
}

export type CouncilMode = 'greeting' | 'plan' | 'advise' | 'chat';
export type CouncilAgent = 'researcher' | 'consolidator' | 'critic';
export type RiskLevel = 'low' | 'medium' | 'high';
export type TransparencyMode = 'A' | 'B' | 'C' | 'D';
export type ProposalStatus = 'pending' | 'approved' | 'expired' | 'rejected';

export interface CouncilSessionRow {
  id: string;
  user_id: string;
  mode: CouncilMode;
  /**
   * Fingerprint of the Supabase auth session that opened this row —
   * see `getAuthedIdentity`. Nullable at the column level because
   * migration 011 added the field without a backfill; migration 012
   * then stamps `ended_at` on every remaining NULL-fingerprint row
   * as a one-time close-out. Post-012, every live row has a non-NULL
   * fingerprint (the repo sets it on every insert), so in practice
   * this is only NULL for historical, already-ended rows.
   */
  auth_session_id: string | null;
  started_at: string;
  ended_at: string | null;
  summary_written_at: string | null;
}

export interface CouncilTurnRow {
  id: string;
  session_id: string;
  user_id: string;
  agent: CouncilAgent | 'user';
  role: 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls: unknown | null;
  tokens_in: number | null;
  tokens_out: number | null;
  created_at: string;
}

export interface CouncilMemorySummaryRow {
  id: string;
  user_id: string;
  session_id: string;
  kind: string;
  content: string;
  created_at: string;
}

export interface CouncilProposalRow {
  id: string;
  user_id: string;
  session_id: string | null;
  kind: string;
  payload: unknown;
  status: ProposalStatus;
  created_at: string;
  expires_at: string;
  approved_at: string | null;
  approval_token_hash: string | null;
}

export interface CriticDiffRow {
  id: string;
  turn_id: string;
  user_id: string;
  diff: string;
  risk_level: RiskLevel;
  created_at: string;
}

export interface MemoryRecallRow {
  id: string;
  turn_id: string;
  user_id: string;
  /**
   * FK to `council_turns.id` on delete set null (see migration 007).
   * Nullable because v0.4 memory surfaces `council_memory_summaries`
   * (session-level digests), not individual turns — so the recall row
   * captures the snippet + user/turn attribution without a hard link
   * back to a source turn. A future release that stores turn-level
   * recall can populate this field; the current summary-based path
   * leaves it null and relies on `snippet` + `created_at` for display.
   */
  source_turn_id: string | null;
  snippet: string;
  created_at: string;
}

export interface UserPreferencesRow {
  user_id: string;
  transparency_mode: TransparencyMode;
  created_at: string;
  updated_at: string;
}

export interface CouncilMetricRow {
  id: string;
  user_id: string;
  session_id: string | null;
  agent: CouncilAgent;
  call_started_at: string;
  first_token_ms: number | null;
  full_reply_ms: number | null;
  tokens_in: number;
  tokens_out: number;
  outcome: 'ok' | 'error' | 'rate_limited';
}

/**
 * F27 — persistent counter for secondary-path failures. Today only
 * `email_send_failed` is written (see `lib/council/errors/email.ts`);
 * the `kind` column is CHECK-gated in migration 014 so new kinds
 * require a schema change rather than a free-typed string.
 */
export type AdminErrorEventKind = 'email_send_failed';

export interface AdminErrorEventRow {
  id: string;
  user_id: string;
  kind: AdminErrorEventKind;
  /** Null when the failure is not tied to a specific Council agent. */
  agent: CouncilAgent | null;
  /** Short classifier the caller already computes (e.g. `send-failed`). */
  reason: string | null;
  created_at: string;
}

/**
 * F28 — derived per-session classification for the searchable
 * history. The `council_sessions` table has no `outcome` column;
 * the `council_sessions_with_stats` view (migration 015) derives
 * these three values from turn count + `ended_at`.
 *
 *   - `empty`   — session was opened but no turns ever landed
 *   - `ongoing` — at least one turn, `ended_at IS NULL`
 *   - `done`    — `ended_at IS NOT NULL` (regardless of turn count)
 */
export type SessionOutcome = 'empty' | 'ongoing' | 'done';

/**
 * F28 — shape of `council_sessions_with_stats` (the read-side view).
 * Mirrors `CouncilSessionRow` for the columns it forwards; adds
 * per-session aggregates so `/history` can filter on cost and
 * outcome without an N+1 turn fetch.
 *
 * `tokens_in_sum` / `tokens_out_sum` / `turn_count` come back as
 * Postgres bigints; PostgREST serializes them as JSON strings when
 * they exceed 2^53-1, but for single-user v0.4 they stay well inside
 * JS number range. We type them as `number` to match how every other
 * numeric column in this file is represented; the Supabase driver
 * coerces the value on read.
 */
export interface CouncilSessionStatsRow {
  id: string;
  user_id: string;
  mode: CouncilMode;
  started_at: string;
  ended_at: string | null;
  summary_written_at: string | null;
  tokens_in_sum: number;
  tokens_out_sum: number;
  /** Pre-computed `tokens_in_sum + tokens_out_sum`, exposed by the view for range filters. */
  total_tokens: number;
  turn_count: number;
  outcome: SessionOutcome;
  /** First non-blank user-turn content, or null for empty sessions. Used by `/history` to derive the row title without a per-row turn fetch. */
  first_user_content: string | null;
}
