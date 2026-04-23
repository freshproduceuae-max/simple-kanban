import { describe, it, expect } from 'vitest';
import {
  TaskRepositoryNotImplemented,
  CouncilMemoryRepositoryNotImplemented,
  SessionRepositoryNotImplemented,
  ProposalRepositoryNotImplemented,
  UserPreferencesRepositoryNotImplemented,
  MetricsRepositoryNotImplemented,
  AdminErrorEventsRepositoryNotImplemented,
} from '..';

describe('persistence repositories (stubs)', () => {
  it('TaskRepository stub throws with feature-id hint', async () => {
    const repo = new TaskRepositoryNotImplemented();
    await expect(repo.listForUser('u1')).rejects.toThrow(/F05/);
  });
  it('CouncilMemoryRepository stub throws with feature-id hint', async () => {
    const repo = new CouncilMemoryRepositoryNotImplemented();
    await expect(repo.listSummariesForUser('u1')).rejects.toThrow(/F18/);
  });
  it('SessionRepository stub throws with feature-id hint', async () => {
    const repo = new SessionRepositoryNotImplemented();
    await expect(
      repo.startSession({ userId: 'u1', mode: 'chat', authSessionId: 'auth-1' }),
    ).rejects.toThrow(/F18/);
  });
  it('SessionRepository.searchSessionsForUser stub throws with feature-id hint (F28)', async () => {
    const repo = new SessionRepositoryNotImplemented();
    await expect(
      repo.searchSessionsForUser({ userId: 'u1' }),
    ).rejects.toThrow(/F28/);
  });
  it('SessionRepository.deleteSession stub throws with feature-id hint (F29)', async () => {
    const repo = new SessionRepositoryNotImplemented();
    await expect(
      repo.deleteSession({ sessionId: 'session-1', userId: 'u1' }),
    ).rejects.toThrow(/F29/);
  });
  it('SessionRepository.deleteAllSessionsForUser stub throws with feature-id hint (F29)', async () => {
    const repo = new SessionRepositoryNotImplemented();
    await expect(
      repo.deleteAllSessionsForUser({ userId: 'u1' }),
    ).rejects.toThrow(/F29/);
  });
  it('ProposalRepository stub throws with feature-id hint', async () => {
    const repo = new ProposalRepositoryNotImplemented();
    await expect(repo.findById({ id: 'p1', userId: 'u1' })).rejects.toThrow(/F12/);
  });
  it('UserPreferencesRepository stub throws with feature-id hint', async () => {
    const repo = new UserPreferencesRepositoryNotImplemented();
    await expect(repo.getForUser('u1')).rejects.toThrow(/F25/);
  });
  it('MetricsRepository stub throws with feature-id hint', async () => {
    const repo = new MetricsRepositoryNotImplemented();
    await expect(repo.record({
      user_id: 'u1', session_id: null, agent: 'consolidator',
      call_started_at: new Date().toISOString(),
      first_token_ms: null, full_reply_ms: null,
      tokens_in: 0, tokens_out: 0, outcome: 'ok',
    })).rejects.toThrow(/F21/);
  });
  it('AdminErrorEventsRepository stub throws with feature-id hint', async () => {
    const repo = new AdminErrorEventsRepositoryNotImplemented();
    await expect(
      repo.record({ user_id: 'u1', kind: 'email_send_failed' }),
    ).rejects.toThrow(/F27/);
  });
});
