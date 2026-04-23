import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserPreferencesRepository } from './user-preferences-repository';
import type { TransparencyMode, UserPreferencesRow } from './types';

/**
 * Supabase-backed UserPreferencesRepository (F25). The `user_preferences`
 * table (migration 008) holds one row per user; `transparency_mode` is
 * an enum `A | B | C | D` with default `B` (the "reveal-on-demand"
 * mode called out in PRD §12.1). New users have no row until the first
 * `upsert` writes one — `getForUser` returns `null` in that case and
 * the resolver layer fills in the default.
 *
 *   - `getForUser` reads with a maybe-single so the "no row yet" path
 *     returns `null` cleanly rather than throwing. Explicit
 *     `.eq('user_id', userId)` belt-and-braces alongside RLS; this
 *     keeps the service-role path safe post-v1.0 if a background
 *     worker ever touches this table.
 *   - `upsert` uses Postgres `on conflict (user_id) do update` semantics
 *     via the Supabase client's `upsert` API with `onConflict: 'user_id'`.
 *     That avoids a read-then-write race (two tabs changing the same
 *     preference at the same time land deterministically) and keeps the
 *     row count at one per user by construction.
 *
 * The `updated_at` column is left to the DB default at insert time and
 * is not currently bumped on update — migration 008 doesn't define a
 * trigger. If the admin panel later needs "last changed" telemetry we
 * can add a trigger or set `updated_at: new Date().toISOString()` in
 * the upsert payload; for v0.4 the creation timestamp is enough.
 */
export class SupabaseUserPreferencesRepository
  implements UserPreferencesRepository
{
  constructor(private readonly client: SupabaseClient) {}

  async getForUser(userId: string): Promise<UserPreferencesRow | null> {
    const { data, error } = await this.client
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error)
      throw new Error(
        `UserPreferencesRepository.getForUser: ${error.message}`,
      );
    return (data as UserPreferencesRow | null) ?? null;
  }

  async upsert(input: {
    userId: string;
    transparencyMode: TransparencyMode;
  }): Promise<UserPreferencesRow> {
    const { data, error } = await this.client
      .from('user_preferences')
      .upsert(
        {
          user_id: input.userId,
          transparency_mode: input.transparencyMode,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
      .select('*')
      .single();
    if (error)
      throw new Error(`UserPreferencesRepository.upsert: ${error.message}`);
    return data as UserPreferencesRow;
  }
}
