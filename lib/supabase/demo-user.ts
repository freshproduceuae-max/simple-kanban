import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Shared-demo-user helper.
 *
 * Short-term affordance: when `DEMO_MODE_SHARED_USER=1` is set, the
 * middleware bypasses the magic-link sign-in flow and auto-logs every
 * visitor into a single pre-provisioned account (`DEMO_USER_EMAIL` /
 * `DEMO_USER_PASSWORD`). Everyone sees the same board and the same
 * Council memory. There is no privacy contract in demo mode — this is
 * for stakeholder demos and close-out walk-throughs, not production use.
 *
 * To restore real auth: unset `DEMO_MODE_SHARED_USER` (or set it to
 * anything other than `"1"`). The sign-in page + middleware redirect
 * revert to their original behaviour with no further code changes.
 *
 * The helper is idempotent: it first tries `signInWithPassword`, and
 * only falls back to `admin.createUser` + retry when sign-in fails.
 * On a cold Supabase project, the first visit provisions the demo
 * user; every subsequent visit goes straight through `signInWithPassword`.
 */

const DEMO_EMAIL_FALLBACK = 'demo@plan.app';

export function isDemoModeEnabled(): boolean {
  // Trim: piping `echo "1" | vercel env add` lands a trailing newline in
  // the encrypted value, so a strict `=== '1'` check silently disables
  // the entire demo flow. Be defensive.
  return process.env.DEMO_MODE_SHARED_USER?.trim() === '1';
}

function getDemoCredentials(): { email: string; password: string } | null {
  if (!isDemoModeEnabled()) return null;
  const email = process.env.DEMO_USER_EMAIL?.trim() || DEMO_EMAIL_FALLBACK;
  const password = process.env.DEMO_USER_PASSWORD?.trim();
  if (!password) return null;
  return { email, password };
}

/**
 * Attempt to sign the current middleware request in as the shared
 * demo user. Returns `true` when the session cookies have been set
 * on the Supabase SSR client (the caller must then redirect so the
 * browser replays the request with those cookies attached).
 *
 * Fails closed: on any error the caller falls back to the normal
 * unauthenticated flow (redirect to `/sign-in`).
 */
export async function ensureDemoSession(ssrClient: SupabaseClient): Promise<boolean> {
  const creds = getDemoCredentials();
  if (!creds) return false;

  const first = await ssrClient.auth.signInWithPassword(creds);
  if (!first.error && first.data.session) return true;

  // Sign-in failed. The most likely cause on a fresh Supabase project
  // is that the demo user hasn't been provisioned yet — try to create
  // it via the service-role admin API, then retry sign-in.
  try {
    const service = createServiceClient();
    const { error } = await service.auth.admin.createUser({
      email: creds.email,
      password: creds.password,
      email_confirm: true,
    });
    if (error) {
      const msg = error.message.toLowerCase();
      const alreadyExists =
        msg.includes('already') ||
        msg.includes('registered') ||
        msg.includes('duplicate');
      if (!alreadyExists) {
        console.error('[demo-user] createUser failed:', error.message);
        return false;
      }
      // User exists but our password doesn't match what's in the DB.
      // Operator must reset via the Supabase dashboard.
      console.error(
        '[demo-user] user exists but password mismatch — reset via Supabase dashboard.',
      );
      return false;
    }
  } catch (e) {
    console.error(
      '[demo-user] admin client unavailable — SUPABASE_SERVICE_ROLE_KEY missing?',
      e,
    );
    return false;
  }

  const second = await ssrClient.auth.signInWithPassword(creds);
  if (!second.error && second.data.session) return true;
  console.error('[demo-user] retry sign-in failed:', second.error?.message);
  return false;
}
