import type { CouncilMode, CouncilSessionRow, CouncilTurnRow } from './types';

/** Fills in at F18 / F19. */
export interface SessionRepository {
  startSession(input: { userId: string; mode: CouncilMode }): Promise<CouncilSessionRow>;
  endSession(input: { sessionId: string; userId: string }): Promise<void>;
  appendTurn(input: Omit<CouncilTurnRow, 'id' | 'created_at'>): Promise<CouncilTurnRow>;
  listSessionsForUser(userId: string, opts?: { limit?: number; cursor?: string }): Promise<CouncilSessionRow[]>;
  listTurns(sessionId: string): Promise<CouncilTurnRow[]>;
}

export class SessionRepositoryNotImplemented implements SessionRepository {
  async startSession(_input: { userId: string; mode: CouncilMode }): Promise<CouncilSessionRow> {
    throw new Error('SessionRepository: implementation lands with F18');
  }
  async endSession(_input: { sessionId: string; userId: string }): Promise<void> {
    throw new Error('SessionRepository: implementation lands with F18');
  }
  async appendTurn(_input: Omit<CouncilTurnRow, 'id' | 'created_at'>): Promise<CouncilTurnRow> {
    throw new Error('SessionRepository: implementation lands with F18');
  }
  async listSessionsForUser(_userId: string, _opts?: { limit?: number; cursor?: string }): Promise<CouncilSessionRow[]> {
    throw new Error('SessionRepository: implementation lands with F19');
  }
  async listTurns(_sessionId: string): Promise<CouncilTurnRow[]> {
    throw new Error('SessionRepository: implementation lands with F19');
  }
}
