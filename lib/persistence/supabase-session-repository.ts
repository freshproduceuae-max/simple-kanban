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
  }): Promise<CouncilSessionRow> {
    const { data, error } = await this.client
      .from('council_sessions')
      .insert({ user_id: input.userId, mode: input.mode })
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
