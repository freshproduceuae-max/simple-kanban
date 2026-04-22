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
  source_turn_id: string;
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
