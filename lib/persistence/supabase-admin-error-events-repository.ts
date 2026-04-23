import type { SupabaseClient } from '@supabase/supabase-js';
import type { AdminErrorEventsRepository } from './admin-error-events-repository';
import type {
  AdminErrorEventKind,
  AdminErrorEventRow,
  CouncilAgent,
} from './types';

/**
 * Supabase-backed AdminErrorEventsRepository (F27).
 *
 * Table + RLS live in migration 014. `auth.uid() = user_id` means the
 * user-scoped request that hit the secondary-path failure writes its
 * own row, and the CD reads their own rows back on /admin/metrics.
 *
 * `record` follows the other repositories' shape — throw on error,
 * return void on success. Fail-quiet is the caller's responsibility
 * (see `lib/council/errors/email.ts` for the one fail-quiet caller).
 *
 * `countSince` uses PostgREST's `count: 'exact', head: true` so we
 * don't pay for the row bodies; we only need the total.
 */
export class SupabaseAdminErrorEventsRepository
  implements AdminErrorEventsRepository
{
  constructor(private readonly client: SupabaseClient) {}

  async record(input: {
    user_id: string;
    kind: AdminErrorEventKind;
    agent?: CouncilAgent | null;
    reason?: string | null;
  }): Promise<void> {
    const { error } = await this.client.from('admin_error_events').insert({
      user_id: input.user_id,
      kind: input.kind,
      agent: input.agent ?? null,
      reason: input.reason ?? null,
    });
    if (error)
      throw new Error(`AdminErrorEventsRepository.record: ${error.message}`);
  }

  async countSince(input: {
    userId: string;
    sinceIso: string;
    kind?: AdminErrorEventKind;
  }): Promise<number> {
    let q = this.client
      .from('admin_error_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', input.userId)
      .gte('created_at', input.sinceIso);
    if (input.kind) q = q.eq('kind', input.kind);
    const { count, error } = await q;
    if (error)
      throw new Error(
        `AdminErrorEventsRepository.countSince: ${error.message}`,
      );
    return count ?? 0;
  }

  async listSince(input: {
    userId: string;
    sinceIso: string;
    limit?: number;
  }): Promise<AdminErrorEventRow[]> {
    const limit = Math.max(1, Math.min(input.limit ?? 500, 2000));
    const { data, error } = await this.client
      .from('admin_error_events')
      .select('*')
      .eq('user_id', input.userId)
      .gte('created_at', input.sinceIso)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error)
      throw new Error(
        `AdminErrorEventsRepository.listSince: ${error.message}`,
      );
    return (data ?? []) as AdminErrorEventRow[];
  }
}
