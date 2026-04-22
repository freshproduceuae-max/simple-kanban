import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupabaseSessionRepository } from '../supabase-session-repository';
import type { CouncilSessionRow, CouncilTurnRow } from '../types';

/**
 * F18 unit coverage for the Supabase builder-chain contract of the
 * SessionRepository: verifies insert/select shapes, explicit user_id
 * filters (RLS belt-and-suspenders), the `ended_at IS NULL` guard on
 * endSession, and cursor pagination on listSessionsForUser.
 */

type Result<T> = { data: T; error: null | { message: string } };

function chain<T>(result: Result<T>) {
  const self: Record<string, unknown> = {};
  const methods = [
    'select',
    'insert',
    'update',
    'delete',
    'eq',
    'lt',
    'is',
    'or',
    'order',
    'limit',
  ] as const;
  for (const m of methods) self[m] = vi.fn(() => self);
  self.single = vi.fn(async () => result);
  self.maybeSingle = vi.fn(async () => result);
  (self as { then: (r: (v: Result<T>) => void) => void }).then = (r) => r(result);
  return self as {
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    lt: ReturnType<typeof vi.fn>;
    is: ReturnType<typeof vi.fn>;
    or: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
  };
}

const sessionRow: CouncilSessionRow = {
  id: 'session-1',
  user_id: 'u1',
  mode: 'chat',
  auth_session_id: 'auth-1',
  started_at: '2026-04-21T00:00:00Z',
  ended_at: null,
  summary_written_at: null,
};

const turnRow: CouncilTurnRow = {
  id: 'turn-1',
  session_id: 'session-1',
  user_id: 'u1',
  agent: 'consolidator',
  role: 'assistant',
  content: 'hi',
  tool_calls: null,
  tokens_in: null,
  tokens_out: null,
  created_at: '2026-04-21T00:00:01Z',
};

describe('SupabaseSessionRepository (F18)', () => {
  let fromSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fromSpy = vi.fn();
  });

  it('startSession inserts user_id + mode and returns the row', async () => {
    const builder = chain<CouncilSessionRow>({ data: sessionRow, error: null });
    fromSpy.mockReturnValue(builder);
    const repo = new SupabaseSessionRepository({ from: fromSpy } as never);

    const got = await repo.startSession({
      userId: 'u1',
      mode: 'chat',
      authSessionId: 'auth-1',
    });
    expect(fromSpy).toHaveBeenCalledWith('council_sessions');
    expect(builder.insert).toHaveBeenCalledWith({
      user_id: 'u1',
      mode: 'chat',
      auth_session_id: 'auth-1',
    });
    expect(got.id).toBe('session-1');
  });

  it('endSession stamps ended_at, filters by user_id, and refuses already-ended rows', async () => {
    const builder = chain<CouncilSessionRow>({ data: sessionRow, error: null });
    fromSpy.mockReturnValue(builder);
    const repo = new SupabaseSessionRepository({ from: fromSpy } as never);

    await repo.endSession({ sessionId: 'session-1', userId: 'u1' });
    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ ended_at: expect.any(String) }),
    );
    expect(builder.eq).toHaveBeenCalledWith('id', 'session-1');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(builder.is).toHaveBeenCalledWith('ended_at', null);
  });

  it('appendTurn inserts the full turn shape and returns the row', async () => {
    const builder = chain<CouncilTurnRow>({ data: turnRow, error: null });
    fromSpy.mockReturnValue(builder);
    const repo = new SupabaseSessionRepository({ from: fromSpy } as never);

    const got = await repo.appendTurn({
      session_id: 'session-1',
      user_id: 'u1',
      agent: 'consolidator',
      role: 'assistant',
      content: 'hi',
      tool_calls: null,
      tokens_in: null,
      tokens_out: null,
    });
    expect(fromSpy).toHaveBeenCalledWith('council_turns');
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        session_id: 'session-1',
        user_id: 'u1',
        agent: 'consolidator',
        role: 'assistant',
      }),
    );
    expect(got.id).toBe('turn-1');
  });

  it('listSessionsForUser filters by user_id, orders desc, clamps limit', async () => {
    const builder = chain<CouncilSessionRow[]>({ data: [sessionRow], error: null });
    fromSpy.mockReturnValue(builder);
    const repo = new SupabaseSessionRepository({ from: fromSpy } as never);

    const rows = await repo.listSessionsForUser('u1', { limit: 10 });
    expect(fromSpy).toHaveBeenCalledWith('council_sessions');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(builder.order).toHaveBeenCalledWith('started_at', { ascending: false });
    expect(builder.limit).toHaveBeenCalledWith(10);
    expect(rows).toHaveLength(1);
  });

  it('listSessionsForUser applies a cursor as a strict lt on started_at', async () => {
    const builder = chain<CouncilSessionRow[]>({ data: [], error: null });
    fromSpy.mockReturnValue(builder);
    const repo = new SupabaseSessionRepository({ from: fromSpy } as never);
    await repo.listSessionsForUser('u1', { cursor: '2026-04-21T00:00:00Z' });
    expect(builder.lt).toHaveBeenCalledWith('started_at', '2026-04-21T00:00:00Z');
  });

  it('listTurns orders asc by created_at so history replays in order', async () => {
    const builder = chain<CouncilTurnRow[]>({ data: [turnRow], error: null });
    fromSpy.mockReturnValue(builder);
    const repo = new SupabaseSessionRepository({ from: fromSpy } as never);
    await repo.listTurns('session-1');
    expect(builder.eq).toHaveBeenCalledWith('session_id', 'session-1');
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: true });
  });

  describe('findResumableSession', () => {
    it('returns null when the session is missing/not-owned/ended', async () => {
      // maybeSingle yields `data: null` — our "not resumable" signal.
      const builder = chain<CouncilSessionRow | null>({
        data: null,
        error: null,
      });
      fromSpy.mockReturnValue(builder);
      const repo = new SupabaseSessionRepository({ from: fromSpy } as never);
      const got = await repo.findResumableSession({
        sessionId: 'session-1',
        userId: 'u1',
        authSessionId: 'auth-1',
        idleCutoffIso: '2026-04-21T00:00:00Z',
      });
      expect(got).toBeNull();
      // Filters applied: id, user_id, auth_session_id, ended_at IS NULL.
      expect(builder.eq).toHaveBeenCalledWith('id', 'session-1');
      expect(builder.eq).toHaveBeenCalledWith('user_id', 'u1');
      expect(builder.eq).toHaveBeenCalledWith('auth_session_id', 'auth-1');
      expect(builder.is).toHaveBeenCalledWith('ended_at', null);
    });

    it('returns null when the last turn is older than the idle cutoff', async () => {
      // First from() call returns the session; second returns the turns.
      const sessionBuilder = chain<CouncilSessionRow>({
        data: {
          ...sessionRow,
          started_at: '2026-04-01T00:00:00Z',
        },
        error: null,
      });
      const turnBuilder = chain<{ created_at: string }[]>({
        data: [{ created_at: '2026-04-20T00:00:00Z' }],
        error: null,
      });
      fromSpy
        .mockReturnValueOnce(sessionBuilder)
        .mockReturnValueOnce(turnBuilder);
      const repo = new SupabaseSessionRepository({ from: fromSpy } as never);
      const got = await repo.findResumableSession({
        sessionId: 'session-1',
        userId: 'u1',
        authSessionId: 'auth-1',
        idleCutoffIso: '2026-04-21T00:00:00Z',
      });
      expect(got).toBeNull();
    });

    it('returns the session when the last turn is inside the idle cutoff', async () => {
      const sessionBuilder = chain<CouncilSessionRow>({
        data: sessionRow,
        error: null,
      });
      const turnBuilder = chain<{ created_at: string }[]>({
        data: [{ created_at: '2026-04-21T00:10:00Z' }],
        error: null,
      });
      fromSpy
        .mockReturnValueOnce(sessionBuilder)
        .mockReturnValueOnce(turnBuilder);
      const repo = new SupabaseSessionRepository({ from: fromSpy } as never);
      const got = await repo.findResumableSession({
        sessionId: 'session-1',
        userId: 'u1',
        authSessionId: 'auth-1',
        idleCutoffIso: '2026-04-21T00:00:00Z',
      });
      expect(got?.id).toBe('session-1');
    });

    it('compares timestamps as instants, not lexical strings (tz offset)', async () => {
      // Postgres `timestamptz` can surface as "+00:00" suffix while
      // `Date.toISOString()` uses "Z" — string ordering would reject
      // this live session at the boundary.
      const sessionBuilder = chain<CouncilSessionRow>({
        data: sessionRow,
        error: null,
      });
      const turnBuilder = chain<{ created_at: string }[]>({
        data: [{ created_at: '2026-04-21T00:00:00.500+00:00' }],
        error: null,
      });
      fromSpy
        .mockReturnValueOnce(sessionBuilder)
        .mockReturnValueOnce(turnBuilder);
      const repo = new SupabaseSessionRepository({ from: fromSpy } as never);
      const got = await repo.findResumableSession({
        sessionId: 'session-1',
        userId: 'u1',
        authSessionId: 'auth-1',
        idleCutoffIso: '2026-04-21T00:00:00.100Z',
      });
      expect(got?.id).toBe('session-1');
    });

    it('falls back to started_at when there are no turns yet', async () => {
      const sessionBuilder = chain<CouncilSessionRow>({
        data: sessionRow, // started_at: '2026-04-21T00:00:00Z'
        error: null,
      });
      const turnBuilder = chain<{ created_at: string }[]>({
        data: [],
        error: null,
      });
      fromSpy
        .mockReturnValueOnce(sessionBuilder)
        .mockReturnValueOnce(turnBuilder);
      const repo = new SupabaseSessionRepository({ from: fromSpy } as never);
      const got = await repo.findResumableSession({
        sessionId: 'session-1',
        userId: 'u1',
        authSessionId: 'auth-1',
        idleCutoffIso: '2026-04-20T23:59:59Z',
      });
      expect(got?.id).toBe('session-1');
    });
  });

  it('surfaces errors from the underlying client with a prefixed message', async () => {
    const builder = chain<CouncilSessionRow>({
      data: null as unknown as CouncilSessionRow,
      error: { message: 'boom' },
    });
    fromSpy.mockReturnValue(builder);
    const repo = new SupabaseSessionRepository({ from: fromSpy } as never);
    await expect(
      repo.startSession({ userId: 'u1', mode: 'chat', authSessionId: 'auth-1' }),
    ).rejects.toThrow(/SessionRepository\.startSession: boom/);
  });

  describe('finalizeStaleSessionsForUser', () => {
    it('filters by user_id, live rows, auth_session_id mismatch; returns rows', async () => {
      const otherRow: CouncilSessionRow = {
        ...sessionRow,
        id: 'session-2',
        auth_session_id: 'auth-OLD',
      };
      const builder = chain<CouncilSessionRow[]>({
        data: [otherRow],
        error: null,
      });
      fromSpy.mockReturnValue(builder);
      const repo = new SupabaseSessionRepository({ from: fromSpy } as never);

      const rows = await repo.finalizeStaleSessionsForUser({
        userId: 'u1',
        authSessionId: 'auth-NEW',
      });
      expect(fromSpy).toHaveBeenCalledWith('council_sessions');
      expect(builder.update).toHaveBeenCalledWith(
        expect.objectContaining({ ended_at: expect.any(String) }),
      );
      expect(builder.eq).toHaveBeenCalledWith('user_id', 'u1');
      expect(builder.is).toHaveBeenCalledWith('ended_at', null);
      // NULL-safe mismatch: exclude the caller's current fingerprint
      // AND include pre-migration-011 rows whose fingerprint is NULL.
      expect(builder.or).toHaveBeenCalledWith(
        'auth_session_id.is.null,auth_session_id.neq.auth-NEW',
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe('session-2');
    });

    it('surfaces DB errors with a prefixed message', async () => {
      const builder = chain<CouncilSessionRow[]>({
        data: null as unknown as CouncilSessionRow[],
        error: { message: 'boom' },
      });
      fromSpy.mockReturnValue(builder);
      const repo = new SupabaseSessionRepository({ from: fromSpy } as never);
      await expect(
        repo.finalizeStaleSessionsForUser({
          userId: 'u1',
          authSessionId: 'auth-NEW',
        }),
      ).rejects.toThrow(/finalizeStaleSessionsForUser: boom/);
    });
  });

  describe('endSessionsForAuthSession', () => {
    it('closes open rows matching the caller’s (user_id, auth_session_id) and returns them', async () => {
      const builder = chain<CouncilSessionRow[]>({
        data: [sessionRow],
        error: null,
      });
      fromSpy.mockReturnValue(builder);
      const repo = new SupabaseSessionRepository({ from: fromSpy } as never);

      const rows = await repo.endSessionsForAuthSession({
        userId: 'u1',
        authSessionId: 'auth-1',
      });
      expect(fromSpy).toHaveBeenCalledWith('council_sessions');
      expect(builder.update).toHaveBeenCalledWith(
        expect.objectContaining({ ended_at: expect.any(String) }),
      );
      expect(builder.eq).toHaveBeenCalledWith('user_id', 'u1');
      expect(builder.eq).toHaveBeenCalledWith('auth_session_id', 'auth-1');
      expect(builder.is).toHaveBeenCalledWith('ended_at', null);
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe('session-1');
    });

    it('surfaces DB errors with a prefixed message', async () => {
      const builder = chain<CouncilSessionRow[]>({
        data: null as unknown as CouncilSessionRow[],
        error: { message: 'boom' },
      });
      fromSpy.mockReturnValue(builder);
      const repo = new SupabaseSessionRepository({ from: fromSpy } as never);
      await expect(
        repo.endSessionsForAuthSession({
          userId: 'u1',
          authSessionId: 'auth-1',
        }),
      ).rejects.toThrow(/endSessionsForAuthSession: boom/);
    });
  });
});
