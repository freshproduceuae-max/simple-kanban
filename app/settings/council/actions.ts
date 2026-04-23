'use server';

import { revalidatePath } from 'next/cache';
import { getAuthedUserId } from '@/lib/auth/current-user';
import { getUserPreferencesRepository } from '@/lib/persistence/server';
import type { TransparencyMode } from '@/lib/persistence';

/**
 * F25 — persist a transparency-mode pref.
 *
 * Called from the Settings page form. Validates the incoming mode
 * against the enum so a stale or tampered client can't poison the
 * column (migration 008 also has a CHECK constraint; this is the
 * outer fence at the action boundary). Revalidates `/settings/council`
 * so the next render re-reads the row and shows the new value as
 * selected without a hard reload.
 *
 * Returns a small result object so the client can surface a success /
 * failure toast without another round-trip.
 */
export type UpdateTransparencyModeResult =
  | { ok: true; mode: TransparencyMode }
  | { ok: false; error: string };

const VALID: readonly TransparencyMode[] = ['A', 'B', 'C', 'D'] as const;

export async function updateTransparencyMode(
  mode: TransparencyMode,
): Promise<UpdateTransparencyModeResult> {
  if (!VALID.includes(mode)) {
    return { ok: false, error: 'invalid-mode' };
  }
  let userId: string;
  try {
    userId = await getAuthedUserId();
  } catch {
    return { ok: false, error: 'not-authenticated' };
  }
  try {
    const repo = getUserPreferencesRepository();
    const row = await repo.upsert({ userId, transparencyMode: mode });
    // Settings page re-renders the form with the persisted pref
    // preselected on the next navigation; revalidating ensures a
    // subsequent SSR read sees the new row.
    revalidatePath('/settings/council');
    return { ok: true, mode: row.transparency_mode };
  } catch (err) {
    console.error('updateTransparencyMode: persistence failed', err);
    return { ok: false, error: 'persistence-failed' };
  }
}
