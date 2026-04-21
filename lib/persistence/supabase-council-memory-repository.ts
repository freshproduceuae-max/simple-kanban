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
 * Recalls (`writeRecall`, `listRecallsForTurn`) stay unimplemented
 * until F24 — throwing here with a feature-id hint makes an accidental
 * early call obvious during integration, which is friendlier than
 * silently returning an empty list.
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

  async writeRecall(
    _input: Omit<MemoryRecallRow, 'id' | 'created_at'>,
  ): Promise<MemoryRecallRow> {
    throw new Error('CouncilMemoryRepository.writeRecall: implementation lands with F24');
  }

  async listRecallsForTurn(_turnId: string): Promise<MemoryRecallRow[]> {
    throw new Error('CouncilMemoryRepository.listRecallsForTurn: implementation lands with F24');
  }
}
