import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isPublicPath } from '../auth/public-paths';
import { ensureDemoSession, isDemoModeEnabled } from './demo-user';

/**
 * Refresh the Supabase session on every matched request and gate
 * protected routes behind auth. Wired from the root `middleware.ts`.
 *
 * Demo-mode branch: when `DEMO_MODE_SHARED_USER=1`, unauthenticated
 * visitors are auto-signed-in as the shared demo user (see
 * `lib/auth/demo-user.ts`). On successful auto-login we redirect back
 * to the same URL so the browser replays the request with the new
 * session cookies attached — downstream Server Components / Actions
 * then see a normal signed-in session and the rest of the app is
 * unchanged. Demo mode also funnels `/sign-in` back to home for both
 * already-signed-in and freshly-signed-in traffic.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Without Supabase configured (local-dev, CI build without env), fall
  // through so the app doesn't hard-error before F03 envs are set.
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options as never),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const demoMode = isDemoModeEnabled();

  // Demo mode: auto-sign-in the shared demo user on first visit, then
  // bounce back so the browser replays with the new cookies.
  if (!user && demoMode) {
    const ok = await ensureDemoSession(supabase);
    if (ok) {
      const redirectUrl = request.nextUrl.clone();
      // On /sign-in, drop the ?next so we land at home cleanly.
      if (pathname === '/sign-in') {
        redirectUrl.pathname = '/';
        redirectUrl.searchParams.delete('next');
      }
      // Copy the Set-Cookie headers the SSR client wrote onto `response`
      // into the redirect so the browser stores them on the next hop.
      const redirect = NextResponse.redirect(redirectUrl);
      response.cookies.getAll().forEach((cookie) => {
        redirect.cookies.set(cookie);
      });
      return redirect;
    }
    // Auto-login failed — fall through to the normal unauthenticated
    // redirect below so the user at least sees a helpful error page.
  }

  // Already-signed-in traffic hitting /sign-in bounces home. In demo
  // mode this path covers visitors whose session cookie has already
  // been set on a prior request.
  if (user && pathname === '/sign-in') {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/';
    redirectUrl.searchParams.delete('next');
    return NextResponse.redirect(redirectUrl);
  }

  // Unauthenticated → redirect to /sign-in, preserving where they came
  // from so the callback can bounce them back. Skipped in demo mode
  // (demo-mode traffic should never reach here — either ensureDemoSession
  // succeeded above, or it failed and we want the sign-in page visible
  // as a fallback).
  if (!user && !isPublicPath(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/sign-in';
    redirectUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
