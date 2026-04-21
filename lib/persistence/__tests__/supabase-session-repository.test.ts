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

    const got = await repo.startSession({ userId: 'u1', mode: 'chat' });
    expect(fromSpy).toHaveBeenCalledWith('council_sessions');
    expect(builder.insert).toHaveBeenCalledWith({
      user_id: 'u1',
      mode: 'chat',
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

  it('surfaces errors from the underlying client with a prefixed message', async () => {
    const builder = chain<CouncilSessionRow>({
      data: null as unknown as CouncilSessionRow,
      error: { message: 'boom' },
    });
    fromSpy.mockReturnValue(builder);
    const repo = new SupabaseSessionRepository({ from: fromSpy } as never);
    await expect(
      repo.startSession({ userId: 'u1', mode: 'chat' }),
    ).rejects.toThrow(/SessionRepository\.startSession: boom/);
  });
});
