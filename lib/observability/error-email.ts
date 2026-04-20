import type { FailureClass } from './failure-class';

/**
 * Resend-backed error-email pipeline — F20.
 * Real implementation lands at Phase 11. This stub defines the contract.
 */
export interface ErrorEmailPayload {
  userId: string | null;
  agent: 'researcher' | 'consolidator' | 'critic' | 'system';
  failureClass: FailureClass;
  message: string;
  stackRedacted?: string;
  context?: Record<string, unknown>;
  occurredAt: string;
}

export async function sendErrorEmail(_payload: ErrorEmailPayload): Promise<void> {
  throw new Error('error-email pipeline: implementation lands with F20');
}
