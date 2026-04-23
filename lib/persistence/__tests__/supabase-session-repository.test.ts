import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupabaseSessionRepository } from '../supabase-session-repository';
import type {
  CouncilSessionRow,
  CouncilSessionStatsRow,
  CouncilTurnRow,
} from '../types';

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
    'gte',
    'lte',
    'is',
    'in',
    'or',
    'order',
    'limit',
    'textSearch',
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
    gte: ReturnType<typeof vi.fn>;
    lte: ReturnType<typeof vi.fn>;
    is: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    or: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    textSearch: ReturnType<typeof vi.fn>;
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

  describe('listSessionsByIds (F27)', () => {
    it('short-circuits on an empty id list without a round trip', async () => {
      const repo = new SupabaseSessionRepository({ from: fromSpy } as never);
      const got = await repo.listSessionsByIds({
        userId: 'u1',
        sessionIds: [],
      });
      expect(got).toEqual([]);
      expect(fromSpy).not.toHaveBeenCalled();
    });

    it('filters by user_id and `.in(id, ids)` with a 2000-cap', async () => {
      const builder = chain<CouncilSessionRow[]>({
        data: [sessionRow],
        error: null,
      });
      fromSpy.mockReturnValue(builder);
      const repo = new SupabaseSessionRepository({ from: fromSpy } as never);

      const ids = Array.from({ length: 2500 }, (_, i) => `id-${i}`);
      await repo.listSessionsByIds({ userId: 'u1', sessionIds: ids });
      expect(fromSpy).toHaveBeenCalledWith('council_sessions');
      expect(builder.eq).toHaveBeenCalledWith('user_id', 'u1');
      const inCall = builder.in.mock.calls[0];
      expect(inCall[0]).toBe('id');
      expect(inCall[1]).toHaveLength(2000);
    });
  });

  describe('searchSessionsForUser (F28)', () => {
    const statsRow: CouncilSessionStatsRow = {
      id: 'session-1',
      user_id: 'u1',
      mode: 'chat',
      started_at: '2026-04-21T00:00:00Z',
      ended_at: null,
      summary_written_at: null,
      tokens_in_sum: 10,
      tokens_out_sum: 20,
      total_tokens: 30,
      turn_count: 2,
      outcome: 'ongoing',
      first_user_content: 'hello',
    };

    it('reads the stats view with user scope, order, limit — no FTS when query is empty', async () => {
      const builder = chain<CouncilSessionStatsRow[]>({
        data: [statsRow],
        error: null,
      });
      fromSpy.mockReturnValue(builder);
      const repo = new SupabaseSessionRepository({ from: fromSpy } as never);

      const got = await repo.searchSessionsForUser({
        userId: 'u1',
        opts: { limit: 10 },
      });
      expect(fromSpy).toHaveBeenCalledWith('council_sessions_with_stats');
      expect(builder.eq).toHaveBeenCalledWith('user_id', 'u1');
      expect(builder.order).toHaveBeenCalledWith('started_at', {
        ascending: false,
      });
      expect(builder.limit).toHaveBeenCalledWith(10);
      expect(builder.textSearch).not.toHaveBeenCalled();
      expect(got).toHaveLength(1);
    });

    it('clamps limit to [1, 100] and defaults to 25 when unset', async () => {
      const builder = chain<CouncilSessionStatsRow[]>({
        data: [],
        error: null,
      });
      fromSpy.mockReturnValue(builder);
      const repo = new SupabaseSessionRepository({ from: fromSpy } as never);

      await repo.searchSessionsForUser({ userId: 'u1' });
      expect(builder.limit).toHaveBeenCalledWith(25);

      builder.limit.mockClear();
      await repo.searchSessionsForUser({
        userId: 'u1',
        opts: { limit: 500 },
      });
      expect(builder.limit).toHaveBeenCalledWith(100);

      builder.limit.mockClear();
      await repo.searchSessionsForUser({
        userId: 'u1',
        opts: { limit: 0 },
      });
      expect(builder.limit).toHaveBeenCalledWith(1);
    });

    it('applies every non-FTS filter: modes, outcomes, dates, token range, cursor', async () => {
      const builder = chain<CouncilSessionStatsRow[]>({
        data: [statsRow],
        error: null,
      });
      fromSpy.mockReturnValue(builder);
      const repo = new SupabaseSessionRepository({ from: fromSpy } as never);

      await repo.searchSessionsForUser({
        userId: 'u1',
        opts: {
          modes: ['plan', 'chat'],
          outcomes: ['done', 'ongoing'],
          dateFrom: '2026-04-01T00:00:00Z',
          dateTo: '2026-04-30T23:59:59Z',
          tokenMin: 100,
          tokenMax: 2000,
          cursor: '2026-04-15T00:00:00Z',
        },
      });
      expect(builder.in).toHaveBeenCalledWith('mode', ['plan', 'chat']);
      expect(builder.in).toHaveBeenCalledWith('outcome', ['done', 'ongoing']);
      expect(builder.gte).toHaveBeenCalledWith(
        'started_at',
        '2026-04-01T00:00:00Z',
      );
      expect(builder.lte).toHaveBeenCalledWith(
        'started_at',
        '2026-04-30T23:59:59Z',
      );
      expect(builder.gte).toHaveBeenCalledWith('total_tokens', 100);
      expect(builder.lte).toHaveBeenCalledWith('total_tokens', 2000);
      expect(builder.lt).toHaveBeenCalledWith(
        'started_at',
        '2026-04-15T00:00:00Z',
      );
    });

    it('resolves matching session ids via FTS first, then intersects with the view', async () => {
      // First call: council_turns FTS resolution.
      const turnsBuilder = chain<{ session_id: string | null }[]>({
        data: [
          { session_id: 's-1' },
          { session_id: 's-1' }, // duplicate — Set should collapse
          { session_id: 's-2' },
          { session_id: null }, // should be filtered out
        ],
        error: null,
      });
      // Second call: view read restricted to the resolved ids.
      const viewBuilder = chain<CouncilSessionStatsRow[]>({
        data: [statsRow],
        error: null,
      });
      fromSpy
        .mockReturnValueOnce(turnsBuilder)
        .mockReturnValueOnce(viewBuilder);
      const repo = new SupabaseSessionRepository({ from: fromSpy } as never);

      await repo.searchSessionsForUser({
        userId: 'u1',
        opts: { query: '  launch  ' },
      });
      // Turns query: FTS on content_fts using plain-tsquery, user-scoped, capped.
      expect(fromSpy).toHaveBeenNthCalledWith(1, 'council_turns');
      expect(turnsBuilder.textSearch).toHaveBeenCalledWith(
        'content_fts',
        'launch', // trimmed
        { type: 'plain' },
      );
      expect(turnsBuilder.eq).toHaveBeenCalledWith('user_id', 'u1');
      expect(turnsBuilder.limit).toHaveBeenCalledWith(2000);
      // View query: intersected with the de-duped, null-filtered ids.
      expect(fromSpy).toHaveBeenNthCalledWith(
        2,
        'council_sessions_with_stats',
      );
      expect(viewBuilder.in).toHaveBeenCalledWith('id', ['s-1', 's-2']);
    });

    it('returns [] immediately when FTS yields zero matching turns', async () => {
      const turnsBuilder = chain<{ session_id: string | null }[]>({
        data: [],
        error: null,
      });
      fromSpy.mockReturnValueOnce(turnsBuilder);
      const repo = new SupabaseSessionRepository({ from: fromSpy } as never);

      const got = await repo.searchSessionsForUser({
        userId: 'u1',
        opts: { query: 'nothing-matches' },
      });
      expect(got).toEqual([]);
      // View query was NOT issued (only the first `from()` call fired).
      expect(fromSpy).toHaveBeenCalledTimes(1);
    });

    it('treats an all-whitespace query as "no FTS" and hits the view directly', async () => {
      const builder = chain<CouncilSessionStatsRow[]>({
        data: [],
        error: null,
      });
      fromSpy.mockReturnValue(builder);
      const repo = new SupabaseSessionRepository({ from: fromSpy } as never);

      await repo.searchSessionsForUser({
        userId: 'u1',
        opts: { query: '   \t  ' },
      });
      expect(fromSpy).toHaveBeenCalledTimes(1);
      expect(fromSpy).toHaveBeenCalledWith('council_sessions_with_stats');
      expect(builder.textSearch).not.toHaveBeenCalled();
    });

    it('surfaces DB errors with a prefixed message', async () => {
      const builder = chain<CouncilSessionStatsRow[]>({
        data: null as unknown as CouncilSessionStatsRow[],
        error: { message: 'boom' },
      });
      fromSpy.mockReturnValue(builder);
      const repo = new SupabaseSessionRepository({ from: fromSpy } as never);
      await expect(
        repo.searchSessionsForUser({ userId: 'u1' }),
      ).rejects.toThrow(/searchSessionsForUser: boom/);
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

  describe('deleteSession (F29)', () => {
    it('scopes by (id, user_id) and returns true when a row was deleted', async () => {
      const builder = chain<Array<{ id: string }>>({
        data: [{ id: 'session-1' }],
        error: null,
      });
      fromSpy.mockReturnValue(builder);
      const repo = new SupabaseSessionRepository({ from: fromSpy } as never);

      const deleted = await repo.deleteSession({
        sessionId: 'session-1',
        userId: 'u1',
      });

      expect(fromSpy).toHaveBeenCalledWith('council_sessions');
      expect(builder.delete).toHaveBeenCalledTimes(1);
      expect(builder.eq).toHaveBeenCalledWith('id', 'session-1');
      expect(builder.eq).toHaveBeenCalledWith('user_id', 'u1');
      expect(builder.select).toHaveBeenCalledWith('id');
      expect(deleted).toBe(true);
    });

    it('returns false when no row matched (stale link, already-purged)', async () => {
      const builder = chain<Array<{ id: string }>>({
        data: [],
        error: null,
      });
      fromSpy.mockReturnValue(builder);
      const repo = new SupabaseSessionRepository({ from: fromSpy } as never);

      const deleted = await repo.deleteSession({
        sessionId: 'session-missing',
        userId: 'u1',
      });

      expect(deleted).toBe(false);
    });

    it('treats a null data payload as no-op (false)', async () => {
      // PostgREST occasionally returns `data: null` alongside a
      // non-error response (empty DELETE result); coerce to false
      // rather than exploding.
      const builder = chain<Array<{ id: string }> | null>({
        data: null,
        error: null,
      });
      fromSpy.mockReturnValue(builder);
      const repo = new SupabaseSessionRepository({ from: fromSpy } as never);
      const deleted = await repo.deleteSession({
        sessionId: 'session-x',
        userId: 'u1',
      });
      expect(deleted).toBe(false);
    });

    it('surfaces DB errors with a prefixed message', async () => {
      const builder = chain<Array<{ id: string }>>({
        data: null as unknown as Array<{ id: string }>,
        error: { message: 'rls denied' },
      });
      fromSpy.mockReturnValue(builder);
      const repo = new SupabaseSessionRepository({ from: fromSpy } as never);
      await expect(
        repo.deleteSession({ sessionId: 'session-1', userId: 'u1' }),
      ).rejects.toThrow(/deleteSession: rls denied/);
    });
  });

  describe('deleteAllSessionsForUser (F29)', () => {
    it('scopes by user_id and returns the count of deleted rows', async () => {
      const builder = chain<Array<{ id: string }>>({
        data: [
          { id: 'session-1' },
          { id: 'session-2' },
          { id: 'session-3' },
        ],
        error: null,
      });
      fromSpy.mockReturnValue(builder);
      const repo = new SupabaseSessionRepository({ from: fromSpy } as never);

      const count = await repo.deleteAllSessionsForUser({ userId: 'u1' });

      expect(fromSpy).toHaveBeenCalledWith('council_sessions');
      expect(builder.delete).toHaveBeenCalledTimes(1);
      expect(builder.eq).toHaveBeenCalledWith('user_id', 'u1');
      // Sanity: the user_id filter is the only scope — otherwise we'd
      // risk a table-wide wipe if an earlier refactor dropped it.
      expect(builder.eq).toHaveBeenCalledTimes(1);
      expect(builder.select).toHaveBeenCalledWith('id');
      expect(count).toBe(3);
    });

    it('returns 0 when the user has no history yet', async () => {
      const builder = chain<Array<{ id: string }>>({
        data: [],
        error: null,
      });
      fromSpy.mockReturnValue(builder);
      const repo = new SupabaseSessionRepository({ from: fromSpy } as never);
      const count = await repo.deleteAllSessionsForUser({ userId: 'u1' });
      expect(count).toBe(0);
    });

    it('treats null data as 0', async () => {
      const builder = chain<Array<{ id: string }> | null>({
        data: null,
        error: null,
      });
      fromSpy.mockReturnValue(builder);
      const repo = new SupabaseSessionRepository({ from: fromSpy } as never);
      const count = await repo.deleteAllSessionsForUser({ userId: 'u1' });
      expect(count).toBe(0);
    });

    it('surfaces DB errors with a prefixed message', async () => {
      const builder = chain<Array<{ id: string }>>({
        data: null as unknown as Array<{ id: string }>,
        error: { message: 'constraint fail' },
      });
      fromSpy.mockReturnValue(builder);
      const repo = new SupabaseSessionRepository({ from: fromSpy } as never);
      await expect(
        repo.deleteAllSessionsForUser({ userId: 'u1' }),
      ).rejects.toThrow(/deleteAllSessionsForUser: constraint fail/);
    });
  });
});
