import type { CouncilMode, CouncilSessionRow, CouncilTurnRow } from './types';

/** Fills in at F18 / F19. */
export interface SessionRepository {
  startSession(input: {
    userId: string;
    mode: CouncilMode;
    authSessionId: string;
  }): Promise<CouncilSessionRow>;
  endSession(input: { sessionId: string; userId: string }): Promise<void>;
  appendTurn(input: Omit<CouncilTurnRow, 'id' | 'created_at'>): Promise<CouncilTurnRow>;
  listSessionsForUser(userId: string, opts?: { limit?: number; cursor?: string }): Promise<CouncilSessionRow[]>;
  listTurns(sessionId: string): Promise<CouncilTurnRow[]>;
  /**
   * Returns the session row iff it is owned by `userId`, still open
   * (`ended_at IS NULL`), matches the caller's `authSessionId` (so a
   * stale shelf id echoed across a sign-out is rejected at the DB
   * layer), and has activity at or after `idleCutoffIso` — where
   * activity means the most recent turn's `created_at`, or the
   * session's `started_at` if no turns exist yet. Returns null
   * otherwise. Used by `resolveSessionId` to validate a client-echoed
   * session id before trusting it.
   */
  findResumableSession(input: {
    sessionId: string;
    userId: string;
    authSessionId: string;
    idleCutoffIso: string;
  }): Promise<CouncilSessionRow | null>;
  /**
   * Closes every open session for `userId` whose `auth_session_id`
   * differs from the caller's current `authSessionId` (including
   * legacy rows with a NULL fingerprint). Sets `ended_at = now()` and
   * returns the affected rows so the resolver can fire a
   * `session-end` summary per orphaned row. Called when a new
   * auth-scoped cache slot is created — i.e. the user has signed out
   * and back in under a different Supabase auth session.
   */
  finalizeStaleSessionsForUser(input: {
    userId: string;
    authSessionId: string;
  }): Promise<CouncilSessionRow[]>;
  /**
   * Closes every still-open session row for `userId` whose
   * `auth_session_id` matches the caller's current fingerprint. Sets
   * `ended_at = now()` and returns the affected rows so the caller
   * can fire a `session-end` summary per row. Called from the sign-
   * out Server Action — PRD §10.2 requires explicit sign-out to end
   * the session. This is the targeted inverse of
   * `finalizeStaleSessionsForUser`: only the current auth session's
   * rows are closed, other concurrent devices stay live.
   */
  endSessionsForAuthSession(input: {
    userId: string;
    authSessionId: string;
  }): Promise<CouncilSessionRow[]>;
  /**
   * Returns the sum of `tokens_in + tokens_out` across every
   * `council_turns` row in this session. Used by F22 per-session
   * budget enforcement: we enforce against the user-visible turn
   * log (what the user has been charged for in the Council's
   * thinking-stream sense) rather than `council_metrics`, which is
   * broader and includes backstage Researcher/Critic rows that
   * exist even when they were fail-quiet. Returns 0 when the
   * session has no turns yet (greeting / first turn).
   */
  sumSessionTokens(input: { sessionId: string }): Promise<number>;
}

export class SessionRepositoryNotImplemented implements SessionRepository {
  async startSession(_input: {
    userId: string;
    mode: CouncilMode;
    authSessionId: string;
  }): Promise<CouncilSessionRow> {
    throw new Error('SessionRepository: implementation lands with F18');
  }
  async endSession(_input: { sessionId: string; userId: string }): Promise<void> {
    throw new Error('SessionRepository: implementation lands with F18');
  }
  async appendTurn(_input: Omit<CouncilTurnRow, 'id' | 'created_at'>): Promise<CouncilTurnRow> {
    throw new Error('SessionRepository: implementation lands with F18');
  }
  async listSessionsForUser(_userId: string, _opts?: { limit?: number; cursor?: string }): Promise<CouncilSessionRow[]> {
    throw new Error('SessionRepository: implementation lands with F19');
  }
  async listTurns(_sessionId: string): Promise<CouncilTurnRow[]> {
    throw new Error('SessionRepository: implementation lands with F19');
  }
  async findResumableSession(_input: {
    sessionId: string;
    userId: string;
    authSessionId: string;
    idleCutoffIso: string;
  }): Promise<CouncilSessionRow | null> {
    throw new Error('SessionRepository: implementation lands with F18');
  }
  async finalizeStaleSessionsForUser(_input: {
    userId: string;
    authSessionId: string;
  }): Promise<CouncilSessionRow[]> {
    throw new Error('SessionRepository: implementation lands with F18');
  }
  async endSessionsForAuthSession(_input: {
    userId: string;
    authSessionId: string;
  }): Promise<CouncilSessionRow[]> {
    throw new Error('SessionRepository: implementation lands with F18');
  }
  async sumSessionTokens(_input: { sessionId: string }): Promise<number> {
    throw new Error('SessionRepository: implementation lands with F22');
  }
}
