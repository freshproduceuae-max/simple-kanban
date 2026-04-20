/**
 * v0.4-beta invite allowlist — F04.
 * Reads COUNCIL_BETA_ALLOWLIST (comma-separated emails, server-only).
 */
export function readAllowlist(): readonly string[] {
  const raw = process.env.COUNCIL_BETA_ALLOWLIST ?? '';
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = readAllowlist();
  if (list.length === 0) return false;
  return list.includes(email.trim().toLowerCase());
}
