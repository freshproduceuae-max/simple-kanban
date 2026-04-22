import type { SupabaseClient } from '@supabase/supabase-js';
import type { MetricsRepository } from './metrics-repository';
import type { CouncilMetricRow } from './types';

/**
 * Supabase-backed MetricsRepository (F21).
 *
 *   - `record` inserts one row per Anthropic call. RLS on
 *     `council_metrics` (migration 009) is `auth.uid() = user_id`,
 *     so the user-scoped request that made the call inserts into
 *     its own rows. No service-role path is used here.
 *   - `dailyTokenTotalForUser` reads `council_metrics_daily`, the
 *     view created with `security_invoker = true` so reads honor the
 *     base-table RLS. This is the per-user daily total F22 uses for
 *     the 500k cap. `dayIso` is a `YYYY-MM-DD` string matching the
 *     view's `date_trunc('day', call_started_at)` column.
 *   - `listForUser` is for F26's `/admin/metrics` read path; returns
 *     rows since a timestamp ordered newest-first.
 */
export class SupabaseMetricsRepository implements MetricsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async record(input: Omit<CouncilMetricRow, 'id'>): Promise<void> {
    const { error } = await this.client.from('council_metrics').insert({
      user_id: input.user_id,
      session_id: input.session_id,
      agent: input.agent,
      call_started_at: input.call_started_at,
      first_token_ms: input.first_token_ms,
      full_reply_ms: input.full_reply_ms,
      tokens_in: input.tokens_in,
      tokens_out: input.tokens_out,
      outcome: input.outcome,
    });
    if (error) throw new Error(`MetricsRepository.record: ${error.message}`);
  }

  async listForUser(input: {
    userId: string;
    sinceIso: string;
    limit?: number;
  }): Promise<CouncilMetricRow[]> {
    const limit = Math.max(1, Math.min(input.limit ?? 500, 2000));
    const { data, error } = await this.client
      .from('council_metrics')
      .select('*')
      .eq('user_id', input.userId)
      .gte('call_started_at', input.sinceIso)
      .order('call_started_at', { ascending: false })
      .limit(limit);
    if (error)
      throw new Error(`MetricsRepository.listForUser: ${error.message}`);
    return (data ?? []) as CouncilMetricRow[];
  }

  async dailyTokenTotalForUser(input: {
    userId: string;
    dayIso: string;
  }): Promise<number> {
    // `day` in the view is `date_trunc('day', call_started_at)` — a
    // timestamptz at UTC midnight. Filter with a half-open range on
    // the day we care about so the index scan is cheap and we don't
    // have to format the view's day column back into a string.
    const start = new Date(input.dayIso);
    if (Number.isNaN(start.getTime())) {
      throw new Error(
        `MetricsRepository.dailyTokenTotalForUser: invalid dayIso '${input.dayIso}'`,
      );
    }
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const { data, error } = await this.client
      .from('council_metrics_daily')
      .select('total_tokens, day')
      .eq('user_id', input.userId)
      .gte('day', start.toISOString())
      .lt('day', end.toISOString())
      .maybeSingle();
    if (error)
      throw new Error(
        `MetricsRepository.dailyTokenTotalForUser: ${error.message}`,
      );
    const total = (data as { total_tokens?: number | string } | null)
      ?.total_tokens;
    if (total == null) return 0;
    // The view computes `sum(...)::bigint`; PostgREST can surface
    // bigints as strings. Coerce defensively.
    const n = typeof total === 'string' ? Number.parseInt(total, 10) : total;
    return Number.isFinite(n) ? n : 0;
  }
}
