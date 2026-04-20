import type { CouncilProposalRow, ProposalStatus } from './types';

/** Fills in at F12. */
export interface ProposalRepository {
  create(input: Omit<CouncilProposalRow, 'id' | 'created_at' | 'status' | 'approved_at' | 'approval_token_hash'> & {
    status?: ProposalStatus;
  }): Promise<CouncilProposalRow>;
  markApproved(input: { id: string; userId: string; approvalTokenHash: string }): Promise<CouncilProposalRow>;
  findById(input: { id: string; userId: string }): Promise<CouncilProposalRow | null>;
  expireStale(now: Date): Promise<number>;
}

export class ProposalRepositoryNotImplemented implements ProposalRepository {
  async create(_input: Parameters<ProposalRepository['create']>[0]): Promise<CouncilProposalRow> {
    throw new Error('ProposalRepository: implementation lands with F12');
  }
  async markApproved(_input: { id: string; userId: string; approvalTokenHash: string }): Promise<CouncilProposalRow> {
    throw new Error('ProposalRepository: implementation lands with F12');
  }
  async findById(_input: { id: string; userId: string }): Promise<CouncilProposalRow | null> {
    throw new Error('ProposalRepository: implementation lands with F12');
  }
  async expireStale(_now: Date): Promise<number> {
    throw new Error('ProposalRepository: implementation lands with F12');
  }
}
