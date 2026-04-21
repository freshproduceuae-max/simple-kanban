/**
 * F15/F17 — Web-research request detection.
 *
 * Chat and Advise modes leave public-web off by default (PRD §6.3/§6.4).
 * They only enable the Researcher's web tool when the user explicitly
 * asks — "look this up", "search", "google", etc. One regex kept as a
 * named helper so the three mode routes gate on the same phrase list
 * and the behavior is grep-testable, not a bag of per-route ad-hoc
 * checks.
 *
 * Env override `COUNCIL_WEB_REQUEST_PHRASES` lets us tune the list at
 * deploy time without a code change (comma-separated substrings, case-
 * insensitive). The built-in list below is the v0.4 default.
 */

/** Canonical phrase list. Exported so tests + docs can reference it. */
export const DEFAULT_WEB_REQUEST_PHRASES: readonly string[] = [
  'look this up',
  'look it up',
  'search online',
  'search the web',
  'google',
  'search for',
  'find online',
  'look up',
  'web search',
  'check the web',
];

function readConfiguredPhrases(): readonly string[] {
  const raw = process.env.COUNCIL_WEB_REQUEST_PHRASES;
  if (!raw) return DEFAULT_WEB_REQUEST_PHRASES;
  const parts = raw
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .filter((p) => p.length > 0);
  return parts.length > 0 ? parts : DEFAULT_WEB_REQUEST_PHRASES;
}

/**
 * True when the user's input contains an explicit web-research phrase.
 * Case-insensitive substring match. Deliberately simple: a mis-classify
 * here degrades gracefully (the Researcher returns memory-only, or the
 * Plan mode already has web enabled and this check is skipped).
 */
export function userRequestedWeb(userInput: string): boolean {
  if (!userInput || typeof userInput !== 'string') return false;
  const lowered = userInput.toLowerCase();
  return readConfiguredPhrases().some((phrase) => lowered.includes(phrase));
}
