import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isPublicPath } from '../auth/public-paths';

/**
 * Refresh the Supabase session on every matched request and gate
 * protected routes behind auth. Wired from the root `middleware.ts`.
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

  // Unauthenticated → redirect to /sign-in, preserving where they came
  // from so the callback can bounce them back.
  if (!user && !isPublicPath(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/sign-in';
    redirectUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Authenticated user hitting /sign-in — send them home instead of
  // forcing a second round-trip.
  if (user && pathname === '/sign-in') {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/';
    redirectUrl.searchParams.delete('next');
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
