import type { CouncilProposalRow, ProposalStatus } from './types';

/** Fills in at F12. */
export interface ProposalRepository {
  create(input: Omit<CouncilProposalRow, 'id' | 'created_at' | 'status' | 'approved_at' | 'approval_token_hash'> & {
    status?: ProposalStatus;
  }): Promise<CouncilProposalRow>;
  markApproved(input: { id: string; userId: string; approvalTokenHash: string }): Promise<CouncilProposalRow>;
  /**
   * Compensating un-approve. Used by the approve route when the task
   * side-effect fails after `markApproved` succeeded, so the row can
   * return to `pending` and the user can retry. Refuses rows that are
   * not currently `approved` (so it can't resurrect a rejected row).
   */
  revertToPending(input: { id: string; userId: string }): Promise<CouncilProposalRow | null>;
  findById(input: { id: string; userId: string }): Promise<CouncilProposalRow | null>;
  expireStale(now: Date): Promise<number>;
  /**
   * User-scoped archive sweep. Flips every `pending` row belonging to
   * `userId` whose `expires_at` has passed to `expired`. Called on the
   * approve hot path (so the pending cap never counts dead rows) and
   * when a lookup discovers the current row is past-TTL.
   */
  expireStaleForUser(input: { userId: string; now: Date }): Promise<number>;
  /**
   * Targeted single-row archive. Flips the referenced pending row to
   * `expired`. Refuses rows that are not `pending` (so it can't
   * resurrect approved/rejected rows). Returns the updated row on
   * success or null if no row transitioned (already archived or
   * concurrently mutated). The approve route uses this to confirm a
   * specific row's archive BEFORE returning 410, so we never claim
   * archive on a row that is still `pending` in storage.
   */
  markExpired(input: { id: string; userId: string }): Promise<CouncilProposalRow | null>;
}

export class ProposalRepositoryNotImplemented implements ProposalRepository {
  async create(_input: Parameters<ProposalRepository['create']>[0]): Promise<CouncilProposalRow> {
    throw new Error('ProposalRepository: implementation lands with F12');
  }
  async markApproved(_input: { id: string; userId: string; approvalTokenHash: string }): Promise<CouncilProposalRow> {
    throw new Error('ProposalRepository: implementation lands with F12');
  }
  async revertToPending(_input: { id: string; userId: string }): Promise<CouncilProposalRow | null> {
    throw new Error('ProposalRepository: implementation lands with F12');
  }
  async findById(_input: { id: string; userId: string }): Promise<CouncilProposalRow | null> {
    throw new Error('ProposalRepository: implementation lands with F12');
  }
  async expireStale(_now: Date): Promise<number> {
    throw new Error('ProposalRepository: implementation lands with F12');
  }
  async expireStaleForUser(_input: { userId: string; now: Date }): Promise<number> {
    throw new Error('ProposalRepository: implementation lands with F12');
  }
  async markExpired(_input: { id: string; userId: string }): Promise<CouncilProposalRow | null> {
    throw new Error('ProposalRepository: implementation lands with F12');
  }
}
