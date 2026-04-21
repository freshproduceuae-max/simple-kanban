import { createServerClient } from '@/lib/supabase/server';

/**
 * Resolve the authenticated user id from the current request's Supabase
 * session, or throw. Consumed by Server Actions / Route Handlers so
 * product modules never touch the Supabase client directly.
 *
 * Route-level auth is already handled by middleware (see
 * `lib/supabase/middleware.ts`) — this function is the defense-in-depth
 * check at the action boundary.
 */
export async function getAuthedUserId(): Promise<string> {
  const supabase = createServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('not-authenticated');
  return data.user.id;
}

/**
 * Extended variant used by Council routes that need an auth-session
 * fingerprint as well as the user id. The fingerprint distinguishes
 * one sign-in from another for the same user, so server-side caches
 * keyed on `(userId, authSessionId)` naturally invalidate on
 * sign-out + re-sign-in (Supabase bumps `last_sign_in_at` on each
 * fresh sign-in, and it does not move on token refresh).
 *
 * Falls back to the user id when `last_sign_in_at` is absent (the
 * field is nullable on some OAuth flows). The fallback still scopes
 * per user; it just can't distinguish two consecutive logins with
 * no recorded timestamp. That's acceptable at v0.4 alpha — the
 * idle window still bounds the reuse.
 */
export async function getAuthedIdentity(): Promise<{
  userId: string;
  authSessionId: string;
}> {
  const supabase = createServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('not-authenticated');
  const authSessionId = data.user.last_sign_in_at ?? data.user.id;
  return { userId: data.user.id, authSessionId };
}
