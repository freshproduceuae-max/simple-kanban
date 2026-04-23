'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getAuthedUserId } from '@/lib/auth/current-user';
import { getSessionRepository } from '@/lib/persistence/server';

/**
 * F29 — per-session delete Server Action for `/history`.
 *
 * Submitted by a plain `<form action={deleteSessionAction}>` on every
 * row of the history table. Cascade FKs on the session's dependent
 * tables (council_turns → critic_diffs/memory_recalls, plus
 * council_memory_summaries) clear every per-user artifact in one
 * statement (see migrations 003/004/006/007). `council_proposals`
 * survives with `session_id` set to null by design — proposals are an
 * audit surface.
 *
 * Signalling pattern:
 *
 *   - success           → redirect to `/history?deleted=1`
 *   - stale / no match  → redirect to `/history?deleteError=missing`
 *   - validation fail   → redirect to `/history?deleteError=invalid`
 *   - unauthed          → redirect to `/sign-in`
 *   - persistence fail  → redirect to `/history?deleteError=failed`
 *
 * The /history page reads those query params and renders an inline
 * banner; no client island required.
 */

// Standard v4 UUID shape. Session ids come from Postgres
// `gen_random_uuid()` (v4) so this rejects anything hand-crafted that
// would otherwise hit the DB and either match nothing or fail to parse.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function deleteSessionAction(formData: FormData): Promise<void> {
  const sessionId = formData.get('sessionId');
  if (typeof sessionId !== 'string' || !UUID_RE.test(sessionId)) {
    redirect('/history?deleteError=invalid');
  }

  let userId: string;
  try {
    userId = await getAuthedUserId();
  } catch {
    redirect('/sign-in');
  }

  let deleted = false;
  try {
    const repo = getSessionRepository();
    deleted = await repo.deleteSession({ sessionId, userId });
  } catch (err) {
    console.error('deleteSessionAction: persistence failed', err);
    redirect('/history?deleteError=failed');
  }

  // /history reads `force-dynamic`, so this is belt-and-suspenders for
  // any cached fetch the App Router may hold off the route.
  revalidatePath('/history');
  redirect(deleted ? '/history?deleted=1' : '/history?deleteError=missing');
}
