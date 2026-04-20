import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/auth/safe-next';

/**
 * F03 — magic-link token exchange.
 *
 * Supabase Auth redirects back here with `?code=<one-time-code>` after
 * the user clicks the link. We exchange it for a session cookie and
 * redirect to `next` (default `/`). F04 adds the allowlist gate here.
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

  // Only allow same-origin relative next paths. External `next=` would
  // turn this callback into an open redirect. `safeNext` is unit-tested.
  return NextResponse.redirect(`${origin}${safeNext(next)}`);
}
