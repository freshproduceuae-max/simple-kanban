import type { TransparencyMode } from '@/lib/persistence';
import type { UserPreferencesRepository } from '@/lib/persistence';

/**
 * F25 — transparency-mode resolver.
 *
 * PRD §12.1 names `B` the default ("reveal-on-demand"). The
 * `user_preferences` row is optional: a fresh account has no row
 * until the first settings-page save, and the repo returns `null` in
 * that case. This helper folds "no row" and "read failure" into the
 * same safe default so the route can always emit a concrete mode in
 * the trailer.
 *
 * Fail policy: a transient Supabase outage must NOT block the Council
 * from replying. We log and fall back to `B` — the user sees the same
 * reveals they'd see on the default path, and the settings page will
 * surface the actual pref next time the user loads it.
 */
export const DEFAULT_TRANSPARENCY_MODE: TransparencyMode = 'B';

export async function resolveTransparencyMode(
  userId: string,
  repo: UserPreferencesRepository,
  log: (msg: string, meta?: unknown) => void = console.warn,
): Promise<TransparencyMode> {
  try {
    const row = await repo.getForUser(userId);
    if (!row) return DEFAULT_TRANSPARENCY_MODE;
    const mode = row.transparency_mode;
    // Defence-in-depth: the DB has a CHECK constraint (migration 008)
    // so this branch is only hit if a bad row slipped past — we still
    // don't want to trust a malformed value inside the Council.
    if (mode !== 'A' && mode !== 'B' && mode !== 'C' && mode !== 'D') {
      log(
        `transparency: unexpected mode "${String(mode)}" for user ${userId} — falling back to ${DEFAULT_TRANSPARENCY_MODE}`,
      );
      return DEFAULT_TRANSPARENCY_MODE;
    }
    return mode;
  } catch (err) {
    log('transparency: read failed (fail-quiet)', err);
    return DEFAULT_TRANSPARENCY_MODE;
  }
}
