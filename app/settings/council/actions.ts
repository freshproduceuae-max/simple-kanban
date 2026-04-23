'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getAuthedUserId } from '@/lib/auth/current-user';
import {
  getSessionRepository,
  getUserPreferencesRepository,
} from '@/lib/persistence/server';
import type { TransparencyMode } from '@/lib/persistence';
import { DELETE_ALL_PHRASE } from './delete-history-constants';

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

/**
 * F29 — purge every session for the authed user.
 *
 * The delete-all surface ships with a two-step confirm per PRD: users
 * must (a) tick the "I understand this can't be undone" checkbox AND
 * (b) type the exact phrase `delete my history` into the text input.
 * Either gate missing → redirect back with an error code, no DB write.
 *
 * On success the action stamps a signed count in the redirect so the
 * settings page can render a "Deleted N sessions." banner without a
 * session-scoped cookie. The cascade chain handles everything under
 * the hood (see `SessionRepository.deleteAllSessionsForUser` for the
 * FK walk).
 *
 * Signalling pattern (matches `deleteSessionAction`):
 *
 *   - success           → `?deleted=<count>`
 *   - checkbox missing  → `?deleteError=confirm-required`
 *   - phrase mismatch   → `?deleteError=phrase-mismatch`
 *   - unauthed          → `/sign-in`
 *   - persistence fail  → `?deleteError=failed`
 */
export async function deleteAllHistoryAction(
  formData: FormData,
): Promise<void> {
  // Input validation before auth: both are server-side gates, but
  // validating first matches `deleteSessionAction` and saves the auth
  // round-trip on a malformed submit. (An unauthenticated request with
  // a good phrase still falls through to `/sign-in` below.)
  const confirm = formData.get('confirm');
  if (confirm !== 'on') {
    redirect('/settings/council?deleteError=confirm-required');
  }

  const phrase = formData.get('phrase');
  const typed =
    typeof phrase === 'string' ? phrase.trim().toLowerCase() : '';
  if (typed !== DELETE_ALL_PHRASE) {
    redirect('/settings/council?deleteError=phrase-mismatch');
  }

  let userId: string;
  try {
    userId = await getAuthedUserId();
  } catch {
    redirect('/sign-in');
  }

  let count = 0;
  try {
    const repo = getSessionRepository();
    count = await repo.deleteAllSessionsForUser({ userId });
  } catch (err) {
    console.error('deleteAllHistoryAction: persistence failed', err);
    redirect('/settings/council?deleteError=failed');
  }

  // History page reads `force-dynamic`, but other surfaces (admin
  // metrics, shelf greeting) may hold fetched session data in the
  // route cache — revalidate the ones that fan out from a session
  // purge.
  revalidatePath('/history');
  revalidatePath('/settings/council');
  redirect(`/settings/council?deleted=${count}`);
}
