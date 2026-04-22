import type { SupabaseClient } from '@supabase/supabase-js';
import type { SessionRepository } from './session-repository';
import type { CouncilMode, CouncilSessionRow, CouncilTurnRow } from './types';

/**
 * Supabase-backed SessionRepository (F18). Persists the Council
 * session + turn log that PRD §10.2 requires:
 *
 *   - `startSession` inserts a `council_sessions` row and returns it.
 *     Each call creates a fresh row — idle-window reuse is decided
 *     upstream in `lib/council/server/session.ts`, not here.
 *   - `endSession` stamps `ended_at`. Scoped by `user_id` in addition
 *     to RLS so a miswired call fails loudly rather than quietly
 *     mutating someone else's session.
 *   - `appendTurn` writes one row per Researcher / Consolidator /
 *     Critic / user turn. The FK on `council_turns.session_id` forces
 *     the caller to pass a real session id (F17's null-session-id
 *     workaround on proposals doesn't apply here — turns only exist
 *     inside a session).
 *   - `listSessionsForUser` (F19) returns sessions desc by started_at
 *     with optional limit/cursor pagination.
 *   - `listTurns` (F19) returns every turn in a session ordered by
 *     created_at asc so the history detail view can replay them.
 *
 * RLS already blocks cross-user reads/writes; we still pass `user_id`
 * explicitly on every filter so the service-role path stays correct
 * post-v1.0 and mis-scoped calls fail loudly.
 */

export const DEFAULT_SESSIONS_PAGE_SIZE = 25;

export class SupabaseSessionRepository implements SessionRepository {
  constructor(private readonly client: SupabaseClient) {}

  async startSession(input: {
    userId: string;
    mode: CouncilMode;
    authSessionId: string;
  }): Promise<CouncilSessionRow> {
    const { data, error } = await this.client
      .from('council_sessions')
      .insert({
        user_id: input.userId,
        mode: input.mode,
        auth_session_id: input.authSessionId,
      })
      .select('*')
      .single();
    if (error) throw new Error(`SessionRepository.startSession: ${error.message}`);
    return data as CouncilSessionRow;
  }

  async endSession(input: {
    sessionId: string;
    userId: string;
  }): Promise<void> {
    const { error } = await this.client
      .from('council_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', input.sessionId)
      .eq('user_id', input.userId)
      .is('ended_at', null); // only stamp once
    if (error) throw new Error(`SessionRepository.endSession: ${error.message}`);
  }

  async appendTurn(
    input: Omit<CouncilTurnRow, 'id' | 'created_at'>,
  ): Promise<CouncilTurnRow> {
    const { data, error } = await this.client
      .from('council_turns')
      .insert({
        session_id: input.session_id,
        user_id: input.user_id,
        agent: input.agent,
        role: input.role,
        content: input.content,
        tool_calls: input.tool_calls,
        tokens_in: input.tokens_in,
        tokens_out: input.tokens_out,
      })
      .select('*')
      .single();
    if (error) throw new Error(`SessionRepository.appendTurn: ${error.message}`);
    return data as CouncilTurnRow;
  }

  async listSessionsForUser(
    userId: string,
    opts?: { limit?: number; cursor?: string },
  ): Promise<CouncilSessionRow[]> {
    const limit = Math.max(1, Math.min(opts?.limit ?? DEFAULT_SESSIONS_PAGE_SIZE, 100));
    let q = this.client
      .from('council_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(limit);
    if (opts?.cursor) {
      // Cursor is the `started_at` ISO string of the last row the caller
      // already saw — we fetch everything strictly older than it.
      q = q.lt('started_at', opts.cursor);
    }
    const { data, error } = await q;
    if (error)
      throw new Error(`SessionRepository.listSessionsForUser: ${error.message}`);
    return (data ?? []) as CouncilSessionRow[];
  }

  async findResumableSession(input: {
    sessionId: string;
    userId: string;
    authSessionId: string;
    idleCutoffIso: string;
  }): Promise<CouncilSessionRow | null> {
    // 1) Session must exist, be owned, still be open, and belong to
    // the caller's current Supabase auth session. The auth filter is
    // what enforces the PRD rule "sign-out ends the session" even
    // when the client echoes a stale shelf sessionId across a new
    // login — pre-migration-011 rows (auth_session_id IS NULL) also
    // fall out here because `.eq` rejects nulls.
    const { data: session, error: sErr } = await this.client
      .from('council_sessions')
      .select('*')
      .eq('id', input.sessionId)
      .eq('user_id', input.userId)
      .eq('auth_session_id', input.authSessionId)
      .is('ended_at', null)
      .maybeSingle();
    if (sErr)
      throw new Error(
        `SessionRepository.findResumableSession: ${sErr.message}`,
      );
    if (!session) return null;

    // 2) Last activity must be within the idle cutoff. We take the
    // newest turn's `created_at` and fall back to `started_at` when
    // there are no turns yet (first resolve before any appendTurn).
    const { data: turns, error: tErr } = await this.client
      .from('council_turns')
      .select('created_at')
      .eq('session_id', input.sessionId)
      .order('created_at', { ascending: false })
      .limit(1);
    if (tErr)
      throw new Error(
        `SessionRepository.findResumableSession: ${tErr.message}`,
      );
    const row = session as CouncilSessionRow;
    const lastActivityIso =
      (turns?.[0] as { created_at?: string } | undefined)?.created_at ??
      row.started_at;
    // Compare as instants, not strings. `timestamptz` from Postgres
    // and `Date.toISOString()` from JS aren't guaranteed to share the
    // same textual format (timezone offset, sub-ms precision), so a
    // lexical compare can mis-order at the idle boundary on cold start.
    const lastActivityMs = Date.parse(lastActivityIso);
    const cutoffMs = Date.parse(input.idleCutoffIso);
    if (Number.isNaN(lastActivityMs) || Number.isNaN(cutoffMs)) return null;
    if (lastActivityMs < cutoffMs) return null;
    return row;
  }

  async finalizeStaleSessionsForUser(input: {
    userId: string;
    authSessionId: string;
  }): Promise<CouncilSessionRow[]> {
    // Close every still-open session for this user whose
    // auth_session_id differs from the caller's current fingerprint.
    // `neq` in PostgREST excludes NULLs, so pre-migration-011 rows
    // (which have a NULL fingerprint) are matched via an explicit
    // `or(auth_session_id.is.null, auth_session_id.neq.<current>)`.
    const nowIso = new Date().toISOString();
    const { data, error } = await this.client
      .from('council_sessions')
      .update({ ended_at: nowIso })
      .eq('user_id', input.userId)
      .is('ended_at', null)
      .or(
        `auth_session_id.is.null,auth_session_id.neq.${input.authSessionId}`,
      )
      .select('*');
    if (error)
      throw new Error(
        `SessionRepository.finalizeStaleSessionsForUser: ${error.message}`,
      );
    return (data ?? []) as CouncilSessionRow[];
  }

  async endSessionsForAuthSession(input: {
    userId: string;
    authSessionId: string;
  }): Promise<CouncilSessionRow[]> {
    // Close every open row whose (user_id, auth_session_id) matches
    // the caller's current fingerprint. Scoped tightly on purpose:
    // concurrent sessions on other devices (different auth_session_id)
    // stay live.
    const nowIso = new Date().toISOString();
    const { data, error } = await this.client
      .from('council_sessions')
      .update({ ended_at: nowIso })
      .eq('user_id', input.userId)
      .eq('auth_session_id', input.authSessionId)
      .is('ended_at', null)
      .select('*');
    if (error)
      throw new Error(
        `SessionRepository.endSessionsForAuthSession: ${error.message}`,
      );
    return (data ?? []) as CouncilSessionRow[];
  }

  async listTurns(sessionId: string): Promise<CouncilTurnRow[]> {
    const { data, error } = await this.client
      .from('council_turns')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(`SessionRepository.listTurns: ${error.message}`);
    return (data ?? []) as CouncilTurnRow[];
  }
}
