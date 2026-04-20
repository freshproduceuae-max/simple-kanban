import type { CouncilMemorySummaryRow, MemoryRecallRow } from './types';

/** Fills in at F18 (summaries) and F24 (recalls). */
export interface CouncilMemoryRepository {
  listSummariesForUser(userId: string, limit?: number): Promise<CouncilMemorySummaryRow[]>;
  writeSummary(input: Omit<CouncilMemorySummaryRow, 'id' | 'created_at'>): Promise<CouncilMemorySummaryRow>;
  writeRecall(input: Omit<MemoryRecallRow, 'id' | 'created_at'>): Promise<MemoryRecallRow>;
  listRecallsForTurn(turnId: string): Promise<MemoryRecallRow[]>;
}

export class CouncilMemoryRepositoryNotImplemented implements CouncilMemoryRepository {
  async listSummariesForUser(_userId: string, _limit?: number): Promise<CouncilMemorySummaryRow[]> {
    throw new Error('CouncilMemoryRepository: implementation lands with F18');
  }
  async writeSummary(_input: Omit<CouncilMemorySummaryRow, 'id' | 'created_at'>): Promise<CouncilMemorySummaryRow> {
    throw new Error('CouncilMemoryRepository: implementation lands with F18');
  }
  async writeRecall(_input: Omit<MemoryRecallRow, 'id' | 'created_at'>): Promise<MemoryRecallRow> {
    throw new Error('CouncilMemoryRepository: implementation lands with F24');
  }
  async listRecallsForTurn(_turnId: string): Promise<MemoryRecallRow[]> {
    throw new Error('CouncilMemoryRepository: implementation lands with F24');
  }
}
