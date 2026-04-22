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
 * one Supabase auth session from another for the same user, so
 * server-side caches + the `council_sessions.auth_session_id` column
 * naturally invalidate on sign-out + re-sign-in and, importantly, do
 * NOT invalidate when the same user signs in on a second device.
 *
 * Source: the `session_id` claim in the JWT access token. GoTrue
 * mints one session per sign-in and stamps that id into every access
 * token issued under that session — it stays stable across token
 * refreshes and is different for each concurrent session on the
 * account. This is the per-session identifier Supabase exposes to
 * its clients; `user.last_sign_in_at` looks tempting but is a
 * user-level timestamp (it moves when the user signs in anywhere,
 * including on another device), so it would cause a live session on
 * device A to be treated as stale the moment the user signs in on
 * device B. See https://supabase.com/docs/guides/auth/users.
 *
 * Defense: we validate the user via `getUser()` (which re-verifies
 * the JWT against GoTrue) before trusting anything from the token.
 * Decoding the payload of a token that just validated is safe —
 * we're not using it to authenticate, only to read an opaque id.
 *
 * Fallback: if the token is missing or doesn't carry `session_id`
 * (older GoTrue, edge cases), we fall back to the user id. That
 * fallback still scopes per user and still gets finalized by the
 * idle window; it just can't distinguish two logins under the same
 * user id on that older server. Acceptable at v0.4 alpha.
 */
export async function getAuthedIdentity(): Promise<{
  userId: string;
  authSessionId: string;
}> {
  const supabase = createServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('not-authenticated');
  const userId = data.user.id;

  // getSession reads from the cookie (no network hop) — safe because
  // we just validated the token with getUser above.
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  const authSessionId = readSessionIdClaim(token) ?? userId;
  return { userId, authSessionId };
}

/**
 * Extracts the `session_id` claim from a Supabase JWT access token.
 * Returns null on any parse / shape failure — callers fall back to
 * a coarser fingerprint. We do NOT use this for authentication; the
 * caller must have already validated the token via `getUser()`.
 */
function readSessionIdClaim(token: string | undefined): string | null {
  if (!token) return null;
  const segments = token.split('.');
  if (segments.length !== 3) return null;
  try {
    // JWT payloads are base64url. Node's Buffer accepts 'base64url'
    // since v16; pad if the runtime is picky.
    const payload = Buffer.from(segments[1], 'base64url').toString('utf8');
    const parsed = JSON.parse(payload) as { session_id?: unknown };
    return typeof parsed.session_id === 'string' && parsed.session_id.length > 0
      ? parsed.session_id
      : null;
  } catch {
    return null;
  }
}
