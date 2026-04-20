import { safeNext } from './safe-next';

/**
 * Build the Supabase `emailRedirectTo` URL for a magic-link request.
 *
 * Preserves the sanitized `next` query param through the round-trip so
 * the callback can bounce the user back to the protected route they
 * were trying to reach before sign-in. Every path that accepts user
 * input for `next` must pass through `safeNext` — this helper does
 * that on the way out, and the callback does it again on the way in.
 *
 * Pure function, no I/O, unit-tested.
 */
export function buildEmailRedirectTo(origin: string, next: string | null | undefined): string {
  const base = `${origin}/auth/callback`;
  const sanitized = safeNext(next);
  // `/` is the callback's own fallback, so omitting `next` is equivalent.
  if (sanitized === '/') return base;
  const params = new URLSearchParams({ next: sanitized });
  return `${base}?${params.toString()}`;
}
