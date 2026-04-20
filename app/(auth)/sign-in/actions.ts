'use server';

import { headers } from 'next/headers';
import { createServerClient } from '@/lib/supabase/server';
import { normalizeEmail } from '@/lib/auth/email';
import { buildEmailRedirectTo } from '@/lib/auth/callback-url';

/**
 * F03 — magic-link sign-in action.
 *
 * Sends a one-time login link via Supabase Auth. F04 adds the allowlist
 * rejection on the callback side, so during the alpha this function will
 * happily mail a link to any address; the callback refuses non-allowed
 * emails after redemption. That keeps this action free of allowlist
 * coupling and lets F04 evolve independently.
 *
 * Preserves the `next` form field (set by the sign-in page from the URL
 * `?next=` that middleware attaches on a protected-route redirect) so
 * the callback can return the user to the page they were trying to
 * reach. `buildEmailRedirectTo` sanitizes it.
 */
export type SendMagicLinkResult =
  | { ok: true; email: string }
  | { ok: false; error: string };

export async function sendMagicLink(formData: FormData): Promise<SendMagicLinkResult> {
  const normalized = normalizeEmail(formData.get('email'));
  if (!normalized.ok) return normalized;
  const { email } = normalized;

  const rawNext = formData.get('next');
  const next = typeof rawNext === 'string' ? rawNext : null;

  const supabase = createServerClient();

  // Build origin from the current request so magic links point back at
  // whichever environment the user signed in from (localhost, preview,
  // production). Supabase still verifies the redirect against its
  // configured allow-list at the project level.
  const hdrs = headers();
  const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host');
  const proto = hdrs.get('x-forwarded-proto') ?? 'https';
  if (!host) {
    return { ok: false, error: 'Could not resolve callback host.' };
  }
  const origin = `${proto}://${host}`;
  const emailRedirectTo = buildEmailRedirectTo(origin, next);

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo },
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, email };
}
