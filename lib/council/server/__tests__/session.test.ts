import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  resolveSessionId,
  SESSION_IDLE_WINDOW_MS,
  __resetSessionCacheForTests,
} from '../session';
import type {
  CouncilSessionRow,
  CouncilTurnRow,
  CouncilMemorySummaryRow,
  MemoryRecallRow,
  CouncilMode,
} from '@/lib/persistence/types';
import type { SessionRepository } from '@/lib/persistence/session-repository';
import type { CouncilMemoryRepository } from '@/lib/persistence/council-memory-repository';

const REAL_UUID_A = '11111111-2222-4333-8444-555555555555';
const REAL_UUID_B = '99999999-8888-4777-8666-555555555555';

function makeSessionRepo(): {
  repo: SessionRepository;
  startSession: ReturnType<typeof vi.fn>;
  endSession: ReturnType<typeof vi.fn>;
} {
  const startSession = vi.fn(
    async ({ userId, mode }: { userId: string; mode: CouncilMode }) => {
      return {
        id: REAL_UUID_A,
        user_id: userId,
        mode,
        started_at: new Date().toISOString(),
        ended_at: null,
        summary_written_at: null,
      } satisfies CouncilSessionRow;
    },
  );
  const endSession = vi.fn(async () => {});
  const repo: SessionRepository = {
    startSession,
    endSession,
    appendTurn: vi.fn(async (input: Omit<CouncilTurnRow, 'id' | 'created_at'>) => ({
      ...input,
      id: 'turn-x',
      created_at: new Date().toISOString(),
    })),
    listSessionsForUser: vi.fn(async () => []),
    listTurns: vi.fn(async () => []),
  };
  return { repo, startSession, endSession };
}

function makeMemoryRepo(): {
  repo: CouncilMemoryRepository;
  writeSummary: ReturnType<typeof vi.fn>;
} {
  const writeSummary = vi.fn(
    async (input: Omit<CouncilMemorySummaryRow, 'id' | 'created_at'>) => ({
      ...input,
      id: 'summary-x',
      created_at: new Date().toISOString(),
    }),
  );
  const repo: CouncilMemoryRepository = {
    writeSummary,
    listSummariesForUser: vi.fn(async () => []),
    writeRecall: vi.fn(
      async (_input: Omit<MemoryRecallRow, 'id' | 'created_at'>) => {
        throw new Error('not for F18');
      },
    ),
    listRecallsForTurn: vi.fn(async () => []),
  };
  return { repo, writeSummary };
}

describe('resolveSessionId — F18 DB-backed', () => {
  beforeEach(() => {
    __resetSessionCacheForTests();
  });

  it('calls startSession on the first turn and caches the returned id', async () => {
    const { repo, startSession } = makeSessionRepo();
    const { repo: memoryRepo } = makeMemoryRepo();
    const t0 = 1_000_000;
    const id = await resolveSessionId({
      userId: 'u1',
      mode: 'chat',
      now: t0,
      sessionRepo: repo,
      memoryRepo,
    });
    expect(id).toBe(REAL_UUID_A);
    expect(startSession).toHaveBeenCalledTimes(1);
    expect(startSession).toHaveBeenCalledWith({ userId: 'u1', mode: 'chat' });

    // Second call within the idle window reuses the cached id — no new
    // DB insert.
    const id2 = await resolveSessionId({
      userId: 'u1',
      mode: 'chat',
      now: t0 + SESSION_IDLE_WINDOW_MS - 1,
      sessionRepo: repo,
      memoryRepo,
    });
    expect(id2).toBe(REAL_UUID_A);
    expect(startSession).toHaveBeenCalledTimes(1);
  });

  it('starts a fresh session and finalizes the prior one when idle window elapses', async () => {
    const { repo, startSession, endSession } = makeSessionRepo();
    const { repo: memoryRepo, writeSummary } = makeMemoryRepo();
    // First call creates session A.
    startSession.mockResolvedValueOnce({
      id: REAL_UUID_A,
      user_id: 'u1',
      mode: 'chat',
      started_at: new Date().toISOString(),
      ended_at: null,
      summary_written_at: null,
    });
    const t0 = 1_000_000;
    const first = await resolveSessionId({
      userId: 'u1',
      mode: 'chat',
      now: t0,
      sessionRepo: repo,
      memoryRepo,
    });
    expect(first).toBe(REAL_UUID_A);

    // Second call after idle window → fresh session B, old one
    // finalized in the background.
    startSession.mockResolvedValueOnce({
      id: REAL_UUID_B,
      user_id: 'u1',
      mode: 'chat',
      started_at: new Date().toISOString(),
      ended_at: null,
      summary_written_at: null,
    });
    const second = await resolveSessionId({
      userId: 'u1',
      mode: 'chat',
      now: t0 + SESSION_IDLE_WINDOW_MS + 1,
      sessionRepo: repo,
      memoryRepo,
    });
    expect(second).toBe(REAL_UUID_B);
    expect(startSession).toHaveBeenCalledTimes(2);

    // Let the fire-and-forget finalize microtasks settle.
    await new Promise((r) => setTimeout(r, 0));
    expect(endSession).toHaveBeenCalledWith({
      sessionId: REAL_UUID_A,
      userId: 'u1',
    });
    expect(writeSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'u1',
        session_id: REAL_UUID_A,
        kind: 'session-end',
      }),
    );
  });

  it('scopes per-user (two users never share a session id)', async () => {
    const { repo, startSession } = makeSessionRepo();
    const { repo: memoryRepo } = makeMemoryRepo();
    startSession.mockResolvedValueOnce({
      id: REAL_UUID_A,
      user_id: 'u1',
      mode: 'chat',
      started_at: new Date().toISOString(),
      ended_at: null,
      summary_written_at: null,
    });
    startSession.mockResolvedValueOnce({
      id: REAL_UUID_B,
      user_id: 'u2',
      mode: 'chat',
      started_at: new Date().toISOString(),
      ended_at: null,
      summary_written_at: null,
    });
    const t0 = 1_000_000;
    const a = await resolveSessionId({
      userId: 'u1',
      mode: 'chat',
      now: t0,
      sessionRepo: repo,
      memoryRepo,
    });
    const b = await resolveSessionId({
      userId: 'u2',
      mode: 'chat',
      now: t0,
      sessionRepo: repo,
      memoryRepo,
    });
    expect(a).not.toBe(b);
  });

  it('trusts a well-formed client-provided UUID without a DB call', async () => {
    const { repo, startSession } = makeSessionRepo();
    const { repo: memoryRepo } = makeMemoryRepo();
    const got = await resolveSessionId({
      userId: 'u1',
      mode: 'chat',
      clientProvided: REAL_UUID_A,
      sessionRepo: repo,
      memoryRepo,
    });
    expect(got).toBe(REAL_UUID_A);
    expect(startSession).not.toHaveBeenCalled();
  });

  it('rejects a malformed client id and falls through to startSession', async () => {
    const { repo, startSession } = makeSessionRepo();
    const { repo: memoryRepo } = makeMemoryRepo();
    const got = await resolveSessionId({
      userId: 'u1',
      mode: 'chat',
      clientProvided: 'not-a-uuid',
      sessionRepo: repo,
      memoryRepo,
    });
    expect(got).toBe(REAL_UUID_A);
    expect(startSession).toHaveBeenCalledTimes(1);
  });

  it('swallows finalize errors so an idle-rollover never fails the new turn', async () => {
    const { repo, startSession, endSession } = makeSessionRepo();
    const { repo: memoryRepo, writeSummary } = makeMemoryRepo();
    endSession.mockRejectedValueOnce(new Error('db blip'));
    writeSummary.mockRejectedValueOnce(new Error('db blip 2'));
    startSession
      .mockResolvedValueOnce({
        id: REAL_UUID_A,
        user_id: 'u1',
        mode: 'chat',
        started_at: new Date().toISOString(),
        ended_at: null,
        summary_written_at: null,
      })
      .mockResolvedValueOnce({
        id: REAL_UUID_B,
        user_id: 'u1',
        mode: 'chat',
        started_at: new Date().toISOString(),
        ended_at: null,
        summary_written_at: null,
      });
    const t0 = 1_000_000;
    await resolveSessionId({
      userId: 'u1',
      mode: 'chat',
      now: t0,
      sessionRepo: repo,
      memoryRepo,
      log: () => {},
    });
    const second = await resolveSessionId({
      userId: 'u1',
      mode: 'chat',
      now: t0 + SESSION_IDLE_WINDOW_MS + 1,
      sessionRepo: repo,
      memoryRepo,
      log: () => {},
    });
    expect(second).toBe(REAL_UUID_B);
    // Background failures should not have thrown.
    await new Promise((r) => setTimeout(r, 0));
  });
});
