/**
 * Translate a sign-in error code (written into `?error=` by the
 * /auth/callback route) into a calm, honest sentence for the sign-in
 * page. Voice matches `docs/design-system/design-system.md` — warm,
 * first-person, no emoji, no blame.
 *
 * Unknown error strings fall through unchanged so we never silently
 * swallow a Supabase-provider message that might help the user.
 */
export function signInErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  switch (code) {
    case 'not_on_allowlist':
      return "This address isn't on the v0.4 beta list yet. If you think it should be, reply to the invite and I will add it.";
    case 'missing_code':
      return 'That sign-in link is missing its code. Request a new one below.';
    default:
      // Supabase's own error text — surface as-is; it's already honest.
      return code;
  }
}
