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
  findResumableSession: ReturnType<typeof vi.fn>;
  finalizeStaleSessionsForUser: ReturnType<typeof vi.fn>;
} {
  const startSession = vi.fn(
    async ({
      userId,
      mode,
      authSessionId,
    }: {
      userId: string;
      mode: CouncilMode;
      authSessionId: string;
    }) => {
      return {
        id: REAL_UUID_A,
        user_id: userId,
        mode,
        auth_session_id: authSessionId,
        started_at: new Date().toISOString(),
        ended_at: null,
        summary_written_at: null,
      } satisfies CouncilSessionRow;
    },
  );
  const endSession = vi.fn(async () => {});
  // Default: DB knows of no resumable session. Tests that want to
  // simulate "shelf echoes a real id that's still live" override via
  // mockResolvedValueOnce.
  const findResumableSession = vi.fn(async () => null);
  const finalizeStaleSessionsForUser = vi.fn(async () => []);
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
    findResumableSession,
    finalizeStaleSessionsForUser,
  };
  return {
    repo,
    startSession,
    endSession,
    findResumableSession,
    finalizeStaleSessionsForUser,
  };
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
      authSessionId: 'auth-1',
      mode: 'chat',
      now: t0,
      sessionRepo: repo,
      memoryRepo,
    });
    expect(id).toBe(REAL_UUID_A);
    expect(startSession).toHaveBeenCalledTimes(1);
    expect(startSession).toHaveBeenCalledWith({
      userId: 'u1',
      mode: 'chat',
      authSessionId: 'auth-1',
    });

    // Second call within the idle window reuses the cached id — no new
    // DB insert.
    const id2 = await resolveSessionId({
      userId: 'u1',
      authSessionId: 'auth-1',
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
      auth_session_id: 'auth-1',
      started_at: new Date().toISOString(),
      ended_at: null,
      summary_written_at: null,
    });
    const t0 = 1_000_000;
    const first = await resolveSessionId({
      userId: 'u1',
      authSessionId: 'auth-1',
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
      auth_session_id: 'auth-1',
      started_at: new Date().toISOString(),
      ended_at: null,
      summary_written_at: null,
    });
    const second = await resolveSessionId({
      userId: 'u1',
      authSessionId: 'auth-1',
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
      auth_session_id: 'auth-1',
      started_at: new Date().toISOString(),
      ended_at: null,
      summary_written_at: null,
    });
    startSession.mockResolvedValueOnce({
      id: REAL_UUID_B,
      user_id: 'u2',
      mode: 'chat',
      auth_session_id: 'auth-1',
      started_at: new Date().toISOString(),
      ended_at: null,
      summary_written_at: null,
    });
    const t0 = 1_000_000;
    const a = await resolveSessionId({
      userId: 'u1',
      authSessionId: 'auth-1',
      mode: 'chat',
      now: t0,
      sessionRepo: repo,
      memoryRepo,
    });
    const b = await resolveSessionId({
      userId: 'u2',
      authSessionId: 'auth-1',
      mode: 'chat',
      now: t0,
      sessionRepo: repo,
      memoryRepo,
    });
    expect(a).not.toBe(b);
  });

  it('cache-hits on an echoed UUID within the idle window without a DB call', async () => {
    const { repo, startSession, findResumableSession } = makeSessionRepo();
    const { repo: memoryRepo } = makeMemoryRepo();
    const t0 = 1_000_000;

    // First turn — no clientProvided, populates the cache via startSession.
    await resolveSessionId({
      userId: 'u1',
      authSessionId: 'auth-1',
      mode: 'chat',
      now: t0,
      sessionRepo: repo,
      memoryRepo,
    });
    startSession.mockClear();

    // Same user echoes the cached UUID back within the idle window →
    // we trust the cache, no DB lookup, no new startSession.
    const got = await resolveSessionId({
      userId: 'u1',
      authSessionId: 'auth-1',
      mode: 'chat',
      clientProvided: REAL_UUID_A,
      now: t0 + 5_000,
      sessionRepo: repo,
      memoryRepo,
    });
    expect(got).toBe(REAL_UUID_A);
    expect(startSession).not.toHaveBeenCalled();
    expect(findResumableSession).not.toHaveBeenCalled();
  });

  it('validates a cold-start echoed UUID against the DB and trusts on hit', async () => {
    const { repo, startSession, findResumableSession } = makeSessionRepo();
    const { repo: memoryRepo } = makeMemoryRepo();
    // Simulate serverless cold start: cache empty, client echoes a
    // UUID it got from a prior (still-live) turn.
    findResumableSession.mockResolvedValueOnce({
      id: REAL_UUID_A,
      user_id: 'u1',
      mode: 'chat',
      auth_session_id: 'auth-1',
      started_at: new Date().toISOString(),
      ended_at: null,
      summary_written_at: null,
    });
    const got = await resolveSessionId({
      userId: 'u1',
      authSessionId: 'auth-1',
      mode: 'chat',
      clientProvided: REAL_UUID_A,
      sessionRepo: repo,
      memoryRepo,
    });
    expect(got).toBe(REAL_UUID_A);
    expect(findResumableSession).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: REAL_UUID_A,
        userId: 'u1',
        authSessionId: 'auth-1',
        idleCutoffIso: expect.any(String),
      }),
    );
    expect(startSession).not.toHaveBeenCalled();
  });

  it('drops a client UUID the DB reports is not resumable and starts fresh', async () => {
    // Stale / not-owned / past-idle / ended — DB returns null.
    const { repo, startSession, findResumableSession } = makeSessionRepo();
    const { repo: memoryRepo } = makeMemoryRepo();
    findResumableSession.mockResolvedValueOnce(null);
    startSession.mockResolvedValueOnce({
      id: REAL_UUID_B,
      user_id: 'u1',
      mode: 'chat',
      auth_session_id: 'auth-1',
      started_at: new Date().toISOString(),
      ended_at: null,
      summary_written_at: null,
    });
    const got = await resolveSessionId({
      userId: 'u1',
      authSessionId: 'auth-1',
      mode: 'chat',
      clientProvided: REAL_UUID_A,
      sessionRepo: repo,
      memoryRepo,
    });
    expect(got).toBe(REAL_UUID_B);
    expect(findResumableSession).toHaveBeenCalledTimes(1);
    expect(startSession).toHaveBeenCalledTimes(1);
  });

  it('swallows findResumableSession errors and falls through to startSession', async () => {
    const { repo, startSession, findResumableSession } = makeSessionRepo();
    const { repo: memoryRepo } = makeMemoryRepo();
    findResumableSession.mockRejectedValueOnce(new Error('db blip'));
    const got = await resolveSessionId({
      userId: 'u1',
      authSessionId: 'auth-1',
      mode: 'chat',
      clientProvided: REAL_UUID_A,
      sessionRepo: repo,
      memoryRepo,
      log: () => {},
    });
    expect(got).toBe(REAL_UUID_A); // from startSession default mock
    expect(startSession).toHaveBeenCalledTimes(1);
  });

  it('rejects a malformed client id and falls through to startSession', async () => {
    const { repo, startSession } = makeSessionRepo();
    const { repo: memoryRepo } = makeMemoryRepo();
    const got = await resolveSessionId({
      userId: 'u1',
      authSessionId: 'auth-1',
      mode: 'chat',
      clientProvided: 'not-a-uuid',
      sessionRepo: repo,
      memoryRepo,
    });
    expect(got).toBe(REAL_UUID_A);
    expect(startSession).toHaveBeenCalledTimes(1);
  });

  it('starts a fresh session after sign-out/re-sign-in even within the idle window', async () => {
    // PRD §10.2 — sign-out ends a session. The cache is keyed by
    // (userId, authSessionId), so the same user arriving with a new
    // auth fingerprint lands in a fresh cache slot and starts a new
    // `council_sessions` row, even though the prior entry is still
    // within the 30-min idle window.
    const { repo, startSession } = makeSessionRepo();
    const { repo: memoryRepo } = makeMemoryRepo();
    startSession
      .mockResolvedValueOnce({
        id: REAL_UUID_A,
        user_id: 'u1',
        mode: 'chat',
        auth_session_id: 'auth-A',
        started_at: new Date().toISOString(),
        ended_at: null,
        summary_written_at: null,
      })
      .mockResolvedValueOnce({
        id: REAL_UUID_B,
        user_id: 'u1',
        mode: 'chat',
        auth_session_id: 'auth-B',
        started_at: new Date().toISOString(),
        ended_at: null,
        summary_written_at: null,
      });
    const t0 = 1_000_000;
    const first = await resolveSessionId({
      userId: 'u1',
      authSessionId: 'auth-A',
      mode: 'chat',
      now: t0,
      sessionRepo: repo,
      memoryRepo,
    });
    const second = await resolveSessionId({
      userId: 'u1',
      authSessionId: 'auth-B', // new login, still inside 30-min idle
      mode: 'chat',
      now: t0 + 60_000,
      sessionRepo: repo,
      memoryRepo,
    });
    expect(first).toBe(REAL_UUID_A);
    expect(second).toBe(REAL_UUID_B);
    expect(startSession).toHaveBeenCalledTimes(2);
    expect(startSession).toHaveBeenNthCalledWith(2, {
      userId: 'u1',
      mode: 'chat',
      authSessionId: 'auth-B',
    });
  });

  it('rejects an echoed UUID across auth sessions — the DB filter drops it and we start fresh', async () => {
    // Round-3 P1: even though the shelf echoes a live UUID from the
    // prior login, `findResumableSession` filters on auth_session_id
    // and returns null for the new auth fingerprint. The resolver
    // must drop the id and start a fresh `council_sessions` row
    // rather than cache the stale one.
    const { repo, startSession, findResumableSession } = makeSessionRepo();
    const { repo: memoryRepo } = makeMemoryRepo();
    findResumableSession.mockResolvedValueOnce(null); // DB filter drops it
    startSession.mockResolvedValueOnce({
      id: REAL_UUID_B,
      user_id: 'u1',
      mode: 'chat',
      auth_session_id: 'auth-B',
      started_at: new Date().toISOString(),
      ended_at: null,
      summary_written_at: null,
    });
    const got = await resolveSessionId({
      userId: 'u1',
      authSessionId: 'auth-B',
      clientProvided: REAL_UUID_A, // id from a prior auth session
      mode: 'chat',
      sessionRepo: repo,
      memoryRepo,
    });
    expect(got).toBe(REAL_UUID_B);
    expect(findResumableSession).toHaveBeenCalledWith(
      expect.objectContaining({ authSessionId: 'auth-B' }),
    );
    expect(startSession).toHaveBeenCalledWith({
      userId: 'u1',
      mode: 'chat',
      authSessionId: 'auth-B',
    });
  });

  it('finalizes orphaned prior-auth rows when a fresh auth-session slot opens', async () => {
    // Round-3 P2: when a new (userId, authSessionId) cache slot is
    // minted (cache miss), ask the DB to close every still-open row
    // owned by this user under a different auth fingerprint and
    // summarize each one. This covers the case where the prior
    // auth-session entry lives on a now-cold serverless instance
    // (or was never seen by any instance that's still warm) and
    // would otherwise stay `ended_at IS NULL` forever.
    const staleRow = {
      id: REAL_UUID_A,
      user_id: 'u1',
      mode: 'chat' as const,
      auth_session_id: 'auth-A',
      started_at: new Date().toISOString(),
      ended_at: '2026-04-22T00:00:00Z',
      summary_written_at: null,
    };
    const {
      repo,
      startSession,
      finalizeStaleSessionsForUser,
    } = makeSessionRepo();
    const { repo: memoryRepo, writeSummary } = makeMemoryRepo();
    finalizeStaleSessionsForUser.mockResolvedValueOnce([staleRow]);
    startSession.mockResolvedValueOnce({
      id: REAL_UUID_B,
      user_id: 'u1',
      mode: 'chat',
      auth_session_id: 'auth-B',
      started_at: new Date().toISOString(),
      ended_at: null,
      summary_written_at: null,
    });
    const got = await resolveSessionId({
      userId: 'u1',
      authSessionId: 'auth-B',
      mode: 'chat',
      sessionRepo: repo,
      memoryRepo,
    });
    expect(got).toBe(REAL_UUID_B);
    expect(finalizeStaleSessionsForUser).toHaveBeenCalledWith({
      userId: 'u1',
      authSessionId: 'auth-B',
    });
    // Fire-and-forget — let the microtask queue drain.
    await new Promise((r) => setTimeout(r, 0));
    expect(writeSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'u1',
        session_id: REAL_UUID_A,
        kind: 'session-end',
      }),
    );
  });

  it('does not call finalizeStaleSessionsForUser on an idle-window rollover (same auth session)', async () => {
    // Same (userId, authSessionId) slot — the old session is
    // finalized via the in-memory `existing` path, not via the
    // cross-auth DB sweep. That sweep is only for the case where the
    // auth fingerprint changed.
    const { repo, startSession, finalizeStaleSessionsForUser } =
      makeSessionRepo();
    const { repo: memoryRepo } = makeMemoryRepo();
    startSession
      .mockResolvedValueOnce({
        id: REAL_UUID_A,
        user_id: 'u1',
        mode: 'chat',
        auth_session_id: 'auth-1',
        started_at: new Date().toISOString(),
        ended_at: null,
        summary_written_at: null,
      })
      .mockResolvedValueOnce({
        id: REAL_UUID_B,
        user_id: 'u1',
        mode: 'chat',
        auth_session_id: 'auth-1',
        started_at: new Date().toISOString(),
        ended_at: null,
        summary_written_at: null,
      });
    const t0 = 1_000_000;
    await resolveSessionId({
      userId: 'u1',
      authSessionId: 'auth-1',
      mode: 'chat',
      now: t0,
      sessionRepo: repo,
      memoryRepo,
    });
    expect(finalizeStaleSessionsForUser).toHaveBeenCalledTimes(1); // first call opens the slot
    await resolveSessionId({
      userId: 'u1',
      authSessionId: 'auth-1',
      mode: 'chat',
      now: t0 + SESSION_IDLE_WINDOW_MS + 1,
      sessionRepo: repo,
      memoryRepo,
    });
    // Second call stays in the same slot (existing entry present) —
    // no new sweep.
    expect(finalizeStaleSessionsForUser).toHaveBeenCalledTimes(1);
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
        auth_session_id: 'auth-1',
        started_at: new Date().toISOString(),
        ended_at: null,
        summary_written_at: null,
      })
      .mockResolvedValueOnce({
        id: REAL_UUID_B,
        user_id: 'u1',
        mode: 'chat',
        auth_session_id: 'auth-1',
        started_at: new Date().toISOString(),
        ended_at: null,
        summary_written_at: null,
      });
    const t0 = 1_000_000;
    await resolveSessionId({
      userId: 'u1',
      authSessionId: 'auth-1',
      mode: 'chat',
      now: t0,
      sessionRepo: repo,
      memoryRepo,
      log: () => {},
    });
    const second = await resolveSessionId({
      userId: 'u1',
      authSessionId: 'auth-1',
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
