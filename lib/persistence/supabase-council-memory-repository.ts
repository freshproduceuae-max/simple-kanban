import type { SupabaseClient } from '@supabase/supabase-js';
import type { CouncilMemoryRepository } from './council-memory-repository';
import type { CouncilMemorySummaryRow, MemoryRecallRow } from './types';

/**
 * Supabase-backed CouncilMemoryRepository (F18 for summaries; F24 for
 * recalls). PRD §11.1 stores per-session summaries in
 * `council_memory_summaries` so Researcher / greeting can pull the last
 * few notes back into the prompt without replaying every turn.
 *
 *   - `writeSummary` inserts a row. `kind` is a free-text tag
 *     (`session-pending`, `session-end`, `topic`, ...); callers pick a
 *     convention that maps to their retrieval query.
 *   - `listSummariesForUser` returns the most recent N summaries desc
 *     by created_at, defaulting to 3 (matches the Researcher /
 *     greeting read path).
 *
 * Recalls (`writeRecall`, `listRecallsForTurn`) landed with F24. The
 * recall row captures the summary the Researcher surfaced into the
 * Consolidator's prompt; `source_turn_id` is null on the summary-based
 * path (see migration 007 + `MemoryRecallRow` JSDoc for why).
 *
 * RLS already blocks cross-user access; we pass `user_id` explicitly on
 * reads so the service-role path stays correct post-v1.0.
 */

export const DEFAULT_SUMMARY_LIMIT = 3;

export class SupabaseCouncilMemoryRepository implements CouncilMemoryRepository {
  constructor(private readonly client: SupabaseClient) {}

  async writeSummary(
    input: Omit<CouncilMemorySummaryRow, 'id' | 'created_at'>,
  ): Promise<CouncilMemorySummaryRow> {
    const { data, error } = await this.client
      .from('council_memory_summaries')
      .insert({
        user_id: input.user_id,
        session_id: input.session_id,
        kind: input.kind,
        content: input.content,
      })
      .select('*')
      .single();
    if (error)
      throw new Error(`CouncilMemoryRepository.writeSummary: ${error.message}`);
    return data as CouncilMemorySummaryRow;
  }

  async listSummariesForUser(
    userId: string,
    limit: number = DEFAULT_SUMMARY_LIMIT,
  ): Promise<CouncilMemorySummaryRow[]> {
    const clamped = Math.max(1, Math.min(limit, 50));
    const { data, error } = await this.client
      .from('council_memory_summaries')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(clamped);
    if (error)
      throw new Error(
        `CouncilMemoryRepository.listSummariesForUser: ${error.message}`,
      );
    return (data ?? []) as CouncilMemorySummaryRow[];
  }

  /**
   * F24 — write one recall row per memory summary the Researcher
   * surfaced into this turn's system prompt. `source_turn_id` is
   * nullable in both migration 007 and the TS type because v0.4 keys
   * memory off summaries (session-level) rather than individual turns;
   * passing null is expected on the common path. `snippet` carries the
   * displayed body (the caller truncates it per `MEMORY_RECALL_SNIPPET_CAP`
   * in `memory-recall-audit.ts`).
   *
   * RLS already restricts inserts to `auth.uid() = user_id`; we still
   * pass `user_id` explicitly so the service-role path stays correct
   * post-v1.0 when a background job might need to write recalls.
   */
  async writeRecall(
    input: Omit<MemoryRecallRow, 'id' | 'created_at'>,
  ): Promise<MemoryRecallRow> {
    const { data, error } = await this.client
      .from('memory_recalls')
      .insert({
        turn_id: input.turn_id,
        user_id: input.user_id,
        source_turn_id: input.source_turn_id,
        snippet: input.snippet,
      })
      .select('*')
      .single();
    if (error)
      throw new Error(`CouncilMemoryRepository.writeRecall: ${error.message}`);
    return data as MemoryRecallRow;
  }

  /**
   * F24 — read recalls for a given Consolidator turn. Ordered oldest
   * first so the UI can render them in the sequence they were
   * surfaced into the prompt. F28 (session history) will reuse this
   * to replay the recall sidebar next to each stored turn.
   *
   * `userId` is required. RLS already restricts reads to the caller's
   * rows on the cookie-auth path, but the service-role path (CLI
   * backfills, background jobs that might land post-v1.0) bypasses
   * RLS entirely — the explicit `.eq('user_id', userId)` is what
   * keeps that path from leaking another user's recalls if two turns
   * ever shared an id. Same defence-in-depth pattern as
   * `listSummariesForUser` above.
   */
  async listRecallsForTurn(
    userId: string,
    turnId: string,
  ): Promise<MemoryRecallRow[]> {
    const { data, error } = await this.client
      .from('memory_recalls')
      .select('*')
      .eq('user_id', userId)
      .eq('turn_id', turnId)
      .order('created_at', { ascending: true });
    if (error)
      throw new Error(
        `CouncilMemoryRepository.listRecallsForTurn: ${error.message}`,
      );
    return (data ?? []) as MemoryRecallRow[];
  }
}
