import type { AdminErrorEventKind, AdminErrorEventRow, CouncilAgent } from './types';

/**
 * F27 — persistent counter for secondary-path failures.
 *
 * Today only one writer exists (`reportAgentError` in
 * `lib/council/errors/email.ts` on the `send-failed` branch), and one
 * reader (`/admin/metrics`, which surfaces the count alongside the
 * 429 and error totals so the CD can see when the alert pipeline
 * itself is broken).
 *
 * The writer is called from a fail-quiet-inside-fail-quiet path — a
 * record() that throws would turn a successfully-served user request
 * into a broken one, which is the exact failure mode the email
 * pipeline is trying to avoid. Callers that intend to remain
 * fail-quiet MUST wrap record() in their own try/catch; the repo
 * itself preserves the normal throw-on-error contract so other
 * callers (if any arrive) can decide for themselves.
 */
export interface AdminErrorEventsRepository {
  record(input: {
    user_id: string;
    kind: AdminErrorEventKind;
    agent?: CouncilAgent | null;
    reason?: string | null;
  }): Promise<void>;
  countSince(input: {
    userId: string;
    sinceIso: string;
    kind?: AdminErrorEventKind;
  }): Promise<number>;
  listSince(input: {
    userId: string;
    sinceIso: string;
    limit?: number;
  }): Promise<AdminErrorEventRow[]>;
}

export class AdminErrorEventsRepositoryNotImplemented
  implements AdminErrorEventsRepository
{
  async record(): Promise<void> {
    throw new Error(
      'AdminErrorEventsRepository: implementation lands with F27',
    );
  }
  async countSince(): Promise<number> {
    throw new Error(
      'AdminErrorEventsRepository: implementation lands with F27',
    );
  }
  async listSince(): Promise<AdminErrorEventRow[]> {
    throw new Error(
      'AdminErrorEventsRepository: implementation lands with F27',
    );
  }
}
