/**
 * Paths reachable without a session.
 *
 * Anything NOT listed here is gated by `lib/supabase/middleware.ts` and
 * redirects unauthenticated traffic to `/sign-in?next=<original>`.
 *
 * Keep this set tight — F03 only needs the two auth endpoints. Every
 * other app surface (board, history, settings, admin, council API) is
 * behind auth. The exact shape of public/private is unit-tested so
 * drift surfaces in CI, not at runtime.
 */
const PUBLIC_PATHS = new Set<string>(['/sign-in', '/auth/callback', '/api/demo-debug']);

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  // Next.js internals and favicon — the middleware matcher already
  // skips static assets, but this keeps the function self-contained.
  if (pathname.startsWith('/_next')) return true;
  if (pathname === '/favicon.ico') return true;
  return false;
}
