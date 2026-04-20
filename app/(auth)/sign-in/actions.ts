'use server';

import { headers } from 'next/headers';
import { createServerClient } from '@/lib/supabase/server';
import { normalizeEmail } from '@/lib/auth/email';

/**
 * F03 — magic-link sign-in action.
 *
 * Sends a one-time login link via Supabase Auth. F04 adds the allowlist
 * rejection on the callback side, so during the alpha this function will
 * happily mail a link to any address; the callback refuses non-allowed
 * emails after redemption. That keeps this action free of allowlist
 * coupling and lets F04 evolve independently.
 */
export type SendMagicLinkResult =
  | { ok: true; email: string }
  | { ok: false; error: string };

export async function sendMagicLink(formData: FormData): Promise<SendMagicLinkResult> {
  const normalized = normalizeEmail(formData.get('email'));
  if (!normalized.ok) return normalized;
  const { email } = normalized;

  const supabase = createServerClient();

  // Build the callback URL from the current request's host, so the magic
  // link points back at whichever environment the user signed in from
  // (localhost, preview, or production).
  const hdrs = headers();
  const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host');
  const proto = hdrs.get('x-forwarded-proto') ?? 'https';
  if (!host) {
    return { ok: false, error: 'Could not resolve callback host.' };
  }
  const emailRedirectTo = `${proto}://${host}/auth/callback`;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo },
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, email };
}
