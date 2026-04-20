import type { CouncilAgent } from '../persistence/types';

/**
 * SDK-call instrumentation wrapper — F21.
 * Captures in/out tokens, first-token latency, full-reply latency.
 * Real implementation lands at Phase 11.
 */
export interface InstrumentedCall<T> {
  agent: CouncilAgent;
  userId: string;
  sessionId: string | null;
  run: () => Promise<T>;
}

export async function instrumentCall<T>(_call: InstrumentedCall<T>): Promise<T> {
  throw new Error('instrumentation: implementation lands with F21');
}
