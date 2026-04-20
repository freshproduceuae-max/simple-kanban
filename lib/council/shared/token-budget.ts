/**
 * Per-session + per-day token budget middleware. F22 fills in the
 * real enforcement path; this module defines the thresholds and
 * helpers so every other module can import them consistently.
 *
 * Vision §9 soft ceilings:
 *   - Morning greeting: 5k
 *   - Plan session:     40k
 *   - Chat turn:        10k
 * PRD §13 daily cap:     500k (COUNCIL_TOKEN_CAP_DAILY, [CD PICK])
 */
export const SESSION_BUDGETS = {
  greeting: 5_000,
  plan: 40_000,
  chat: 10_000,
  advise: 10_000,
} as const;

export const SOFT_WARN_FRACTION = 0.8;

export function readDailyCap(): number {
  const raw = process.env.COUNCIL_TOKEN_CAP_DAILY;
  if (!raw) return 500_000;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 500_000;
}

export function budgetOutcome(used: number, ceiling: number): 'ok' | 'warn' | 'cut' {
  if (used >= ceiling) return 'cut';
  if (used >= ceiling * SOFT_WARN_FRACTION) return 'warn';
  return 'ok';
}
