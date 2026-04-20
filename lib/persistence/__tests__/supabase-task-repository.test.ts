import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupabaseTaskRepository } from '../supabase-task-repository';
import type { TaskRow } from '../types';
import type { ApprovalContext } from '../task-repository';

/**
 * Unit coverage for the Supabase builder-chain contract: the repository
 * must filter by user_id, pass an ApprovalContext on every mutation,
 * and surface Supabase errors as thrown Errors (so Server Actions can
 * catch them and return an ActionResult).
 *
 * A full apply-time test against pglite would also exercise the real
 * SQL, but that's F02's remit — here we lock down the client
 * interaction shape so regressions (missing .eq('user_id',...), silent
 * error-swallow) fail loudly.
 */

type ThenableBuilder<T> = {
  then: (resolve: (v: { data: T; error: null | { message: string } }) => void) => void;
};

function chain<T>(result: { data: T; error: null | { message: string } }) {
  // Each method returns the same chainable object; `single()`/`then` resolves.
  const self: Record<string, unknown> = {};
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'order'] as const;
  for (const m of methods) self[m] = vi.fn(() => self);
  self.single = vi.fn(async () => result);
  (self as ThenableBuilder<T>).then = (resolve) => resolve(result);
  return self as {
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
  };
}

const ctx: ApprovalContext = { proposalId: 'p1', approvalToken: 'tok' };

const row: TaskRow = {
  id: 't1',
  user_id: 'u1',
  title: 'Write plan',
  description: null,
  board_column: 'todo',
  position: 1,
  overdue_at: null,
  created_at: '2026-04-21T00:00:00Z',
  updated_at: '2026-04-21T00:00:00Z',
};

describe('SupabaseTaskRepository (F05)', () => {
  let fromSpy: ReturnType<typeof vi.fn>;
  let builder: ReturnType<typeof chain<TaskRow | TaskRow[]>>;
  let client: { from: typeof fromSpy };

  beforeEach(() => {
    builder = chain<TaskRow | TaskRow[]>({ data: [row], error: null });
    fromSpy = vi.fn(() => builder);
    client = { from: fromSpy };
  });

  it('listForUser filters by user_id and returns mapped rows', async () => {
    const repo = new SupabaseTaskRepository(client as never);
    const out = await repo.listForUser('u1');
    expect(fromSpy).toHaveBeenCalledWith('tasks');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(out).toEqual([row]);
  });

  it('create refuses an empty ApprovalContext (Council Write Gate)', async () => {
    const repo = new SupabaseTaskRepository(client as never);
    await expect(
      repo.create({
        userId: 'u1',
        title: 't',
        board_column: 'todo',
        position: 1,
        approvalContext: { proposalId: '', approvalToken: '' },
      }),
    ).rejects.toThrow(/ApprovalContext is required/);
    // And the client was never touched — the gate fails fast.
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it('create forwards user_id + writes defaults for nullable fields', async () => {
    builder = chain<TaskRow>({ data: row, error: null });
    fromSpy = vi.fn(() => builder);
    const repo = new SupabaseTaskRepository({ from: fromSpy } as never);
    await repo.create({
      userId: 'u1',
      title: 'Write plan',
      board_column: 'todo',
      position: 123,
      approvalContext: ctx,
    });
    expect(builder.insert).toHaveBeenCalledWith({
      user_id: 'u1',
      title: 'Write plan',
      description: null,
      board_column: 'todo',
      position: 123,
    });
  });

  it('update scopes by both id and user_id (defense-in-depth beside RLS)', async () => {
    builder = chain<TaskRow>({ data: row, error: null });
    fromSpy = vi.fn(() => builder);
    const repo = new SupabaseTaskRepository({ from: fromSpy } as never);
    await repo.update({
      id: 't1',
      userId: 'u1',
      patch: { title: 'Renamed' },
      approvalContext: ctx,
    });
    const eqCalls = builder.eq.mock.calls;
    expect(eqCalls).toContainEqual(['id', 't1']);
    expect(eqCalls).toContainEqual(['user_id', 'u1']);
  });

  it('delete scopes by both id and user_id and refuses a missing context', async () => {
    const repo = new SupabaseTaskRepository(client as never);
    await expect(
      repo.delete({ id: 't1', userId: 'u1', approvalContext: { proposalId: '', approvalToken: 'x' } }),
    ).rejects.toThrow(/ApprovalContext is required/);

    await repo.delete({ id: 't1', userId: 'u1', approvalContext: ctx });
    const eqCalls = builder.eq.mock.calls;
    expect(eqCalls).toContainEqual(['id', 't1']);
    expect(eqCalls).toContainEqual(['user_id', 'u1']);
  });

  it('surfaces Supabase errors as thrown Errors (Server Actions catch them)', async () => {
    builder = chain<TaskRow[]>({ data: [], error: { message: 'boom' } });
    fromSpy = vi.fn(() => builder);
    const repo = new SupabaseTaskRepository({ from: fromSpy } as never);
    await expect(repo.listForUser('u1')).rejects.toThrow(/boom/);
  });
});
