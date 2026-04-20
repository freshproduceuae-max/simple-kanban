import type { CouncilMetricRow } from './types';

/** Fills in at F21 (record), F26/F27 (read). */
export interface MetricsRepository {
  record(input: Omit<CouncilMetricRow, 'id'>): Promise<void>;
  listForUser(input: { userId: string; sinceIso: string; limit?: number }): Promise<CouncilMetricRow[]>;
  dailyTokenTotalForUser(input: { userId: string; dayIso: string }): Promise<number>;
}

export class MetricsRepositoryNotImplemented implements MetricsRepository {
  async record(_input: Omit<CouncilMetricRow, 'id'>): Promise<void> {
    throw new Error('MetricsRepository: implementation lands with F21');
  }
  async listForUser(_input: { userId: string; sinceIso: string; limit?: number }): Promise<CouncilMetricRow[]> {
    throw new Error('MetricsRepository: implementation lands with F26');
  }
  async dailyTokenTotalForUser(_input: { userId: string; dayIso: string }): Promise<number> {
    throw new Error('MetricsRepository: implementation lands with F22');
  }
}
