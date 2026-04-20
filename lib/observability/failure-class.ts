/**
 * Failure classes attached to every caught server-side failure.
 * Used by F20 (error-email dedup) and F21 (metrics outcomes).
 */
export const FAILURE_CLASSES = [
  'anthropic_429',
  'anthropic_error',
  'supabase_error',
  'resend_error',
  'write_gate_rejected',
  'token_budget_cut',
  'unknown',
] as const;

export type FailureClass = (typeof FAILURE_CLASSES)[number];

export function isFailureClass(value: unknown): value is FailureClass {
  return typeof value === 'string' && (FAILURE_CLASSES as readonly string[]).includes(value);
}
