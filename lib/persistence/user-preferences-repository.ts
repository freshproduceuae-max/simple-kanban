import type { TransparencyMode, UserPreferencesRow } from './types';

/** Fills in at F25. */
export interface UserPreferencesRepository {
  getForUser(userId: string): Promise<UserPreferencesRow | null>;
  upsert(input: { userId: string; transparencyMode: TransparencyMode }): Promise<UserPreferencesRow>;
}

export class UserPreferencesRepositoryNotImplemented implements UserPreferencesRepository {
  async getForUser(_userId: string): Promise<UserPreferencesRow | null> {
    throw new Error('UserPreferencesRepository: implementation lands with F25');
  }
  async upsert(_input: { userId: string; transparencyMode: TransparencyMode }): Promise<UserPreferencesRow> {
    throw new Error('UserPreferencesRepository: implementation lands with F25');
  }
}
