'use server';

import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { getAuthedIdentity } from '@/lib/auth/current-user';
import {
  getSessionRepository,
  getCouncilMemoryRepository,
} from '@/lib/persistence/server';

/**
 * F03 — sign-out Server Action.
 *
 * Explicit sign-out ends the Council session (PRD §10.2). Before we
 * clear the Supabase session cookies we:
 *   1. Resolve the current (userId, authSessionId) from the live
 *      cookie so we can scope the cleanup to *this* auth session —
 *      other devices signed into the same account must stay live.
 *   2. Close every still-open `council_sessions` row for that pair
 *      and write a `session-end` summary per row, so `/history`
 *      shows the session as finished and the Researcher sees a
 *      clean hand-off next time the user returns.
 *   3. Call `supabase.auth.signOut()` and redirect.
 *
 * Failure policy: sign-out must always succeed. Every persistence
 * step is wrapped in try/catch and logged; a flaky DB blocks neither
 * the cookie clear nor the redirect. If the user isn't authenticated
 * (shouldn't happen — the middleware would have redirected earlier),
 * we still hit `signOut()` as a belt-and-suspenders cookie clear.
 */
export async function signOut() {
  // Capture identity up front, while the cookie is still valid. If
  // this fails we skip cleanup and just clear the cookie.
  let identity: { userId: string; authSessionId: string } | null = null;
  try {
    identity = await getAuthedIdentity();
  } catch {
    identity = null;
  }

  if (identity) {
    const sessionRepo = getSessionRepository();
    const memoryRepo = getCouncilMemoryRepository();
    let closed: Awaited<
      ReturnType<typeof sessionRepo.endSessionsForAuthSession>
    > = [];
    try {
      closed = await sessionRepo.endSessionsForAuthSession({
        userId: identity.userId,
        authSessionId: identity.authSessionId,
      });
    } catch (err) {
      console.error('sign-out: endSessionsForAuthSession failed', err);
    }
    for (const row of closed) {
      try {
        await memoryRepo.writeSummary({
          user_id: identity.userId,
          session_id: row.id,
          kind: 'session-end',
          content: `Session closed on sign-out. Mode: ${row.mode}.`,
        });
      } catch (err) {
        console.error('sign-out: writeSummary failed', err);
      }
    }
  }

  const supabase = createServerClient();
  await supabase.auth.signOut();
  redirect('/sign-in');
}
