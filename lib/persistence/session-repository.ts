import type { CouncilMode, CouncilSessionRow, CouncilTurnRow } from './types';

/** Fills in at F18 / F19. */
export interface SessionRepository {
  startSession(input: { userId: string; mode: CouncilMode }): Promise<CouncilSessionRow>;
  endSession(input: { sessionId: string; userId: string }): Promise<void>;
  appendTurn(input: Omit<CouncilTurnRow, 'id' | 'created_at'>): Promise<CouncilTurnRow>;
  listSessionsForUser(userId: string, opts?: { limit?: number; cursor?: string }): Promise<CouncilSessionRow[]>;
  listTurns(sessionId: string): Promise<CouncilTurnRow[]>;
  /**
   * Returns the session row iff it is owned by `userId`, still open
   * (`ended_at IS NULL`), and has activity at or after `idleCutoffIso`
   * — where activity means the most recent turn's `created_at`, or
   * the session's `started_at` if no turns exist yet. Returns null
   * otherwise. Used by `resolveSessionId` to validate a client-echoed
   * session id before trusting it.
   */
  findResumableSession(input: {
    sessionId: string;
    userId: string;
    idleCutoffIso: string;
  }): Promise<CouncilSessionRow | null>;
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
  async findResumableSession(_input: {
    sessionId: string;
    userId: string;
    idleCutoffIso: string;
  }): Promise<CouncilSessionRow | null> {
    throw new Error('SessionRepository: implementation lands with F18');
  }
}
