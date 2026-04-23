import { createServerClient } from '@/lib/supabase/server';

/**
 * Admin identity resolver — F26.
 *
 * v0.4 is single-user, and the sole operator is the Creative Director.
 * We gate `/admin/*` by comparing the Supabase-authenticated email
 * against `ADMIN_EMAIL` (server-only env var, comma-separated list
 * accepted for safety during role-handover, but typically one address).
 *
 * Throws:
 *   - `'not-authenticated'` — no Supabase session on the request.
 *   - `'not-admin'` — authed, but the email does not match the
 *     configured admin address(es), or `ADMIN_EMAIL` is unset.
 *
 * The caller (the `/admin/metrics` page) catches these separately so
 * it can redirect the unauthed user to `/sign-in` but the
 * authenticated-but-non-admin user to `/` — mirroring the
 * conventional "don't leak the admin surface exists" posture.
 *
 * Notes:
 *   - Comparison is case-insensitive and trims whitespace on both
 *     sides, matching the pattern used by `beta-allowlist.ts`.
 *   - We deliberately do NOT fall back to a hardcoded email. If
 *     `ADMIN_EMAIL` is unset in the environment, the gate is closed.
 *   - v0.5 replaces this with a real role column on `memberships`,
 *     and this helper becomes a thin wrapper that reads that role
 *     instead of matching on email. The surface (throws the same
 *     two errors) stays identical.
 */
export async function getAuthedAdmin(): Promise<{
  userId: string;
  email: string;
}> {
  const supabase = createServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('not-authenticated');
  const email = data.user.email;
  if (!email) throw new Error('not-admin');
  if (!isAdminEmail(email)) throw new Error('not-admin');
  return { userId: data.user.id, email };
}

/**
 * Pure predicate so tests and callers can check the config without
 * touching Supabase. Reads `ADMIN_EMAIL` (comma-separated, trimmed,
 * lowercased) on every call — fine at serverless request scale; no
 * need to cache.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const raw = process.env.ADMIN_EMAIL ?? '';
  const list = raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (list.length === 0) return false;
  return list.includes(email.trim().toLowerCase());
}
