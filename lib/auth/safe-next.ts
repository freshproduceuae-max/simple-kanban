/**
 * Sanitize a `next` query parameter to prevent open-redirect abuse.
 *
 * Any value that is not a same-origin relative path falls back to `/`.
 * Used by the F03 magic-link callback — a crafted `?next=//evil.com`
 * would otherwise bounce an authenticated user off-site.
 */
export function safeNext(raw: string | null | undefined, fallback = '/'): string {
  if (!raw) return fallback;
  // Must start with a single `/` and must not start with `//` or `/\`,
  // both of which Node's URL parser treats as protocol-relative.
  if (!raw.startsWith('/')) return fallback;
  if (raw.startsWith('//') || raw.startsWith('/\\')) return fallback;
  return raw;
}
