import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/auth/safe-next';
import { isAllowed } from '@/lib/auth/beta-allowlist';

/**
 * F03 — magic-link token exchange.
 * F04 — beta allowlist enforcement layered onto redemption.
 *
 * Supabase Auth redirects back here with `?code=<one-time-code>` after
 * the user clicks the link. Flow:
 *   1. Exchange the code for a session cookie.
 *   2. F04: confirm the authenticated email is on COUNCIL_BETA_ALLOWLIST.
 *      If not, sign the user back out (so the session cookie doesn't
 *      linger) and bounce to `/sign-in?error=not_on_allowlist`.
 *   3. Redirect to the sanitized `next` path (default `/`).
 *
 * The calm honest sentence surfaced on rejection lives in the sign-in
 * page's error handler — the callback just picks the reason code.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/';
  const origin = url.origin;

  if (!code) {
    return NextResponse.redirect(`${origin}/sign-in?error=missing_code`);
  }

  const supabase = createServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      `${origin}/sign-in?error=${encodeURIComponent(error.message)}`,
    );
  }

  // F04: enforce allowlist *after* exchange (we need the email, which
  // only lives on the session). If the email isn't on the list, tear
  // the session back down before redirecting — otherwise the cookie
  // survives and middleware happily lets the user into the app.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAllowed(user?.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/sign-in?error=not_on_allowlist`);
  }

  // Same-origin relative paths only — external `next=` would turn this
  // callback into an open redirect. `safeNext` is unit-tested.
  return NextResponse.redirect(`${origin}${safeNext(next)}`);
}
