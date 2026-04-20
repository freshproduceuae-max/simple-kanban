/**
 * Normalize + shallow-validate a user-supplied email address.
 *
 * Returns a normalized email (trimmed + lowercased) on success, or an
 * error message. The final acceptance gate is the auth provider — this
 * exists to catch obvious typos before we round-trip to Supabase and to
 * keep the magic-link Server Action free of regex noise.
 */
export type NormalizedEmail =
  | { ok: true; email: string }
  | { ok: false; error: string };

export function normalizeEmail(raw: unknown): NormalizedEmail {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return { ok: false, error: 'Email required.' };
  }
  const email = raw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'That does not look like an email address.' };
  }
  return { ok: true, email };
}
