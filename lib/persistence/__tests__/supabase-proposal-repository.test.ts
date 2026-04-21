import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SupabaseProposalRepository,
  PENDING_CAP_PER_USER,
  PROPOSAL_TTL_MS,
} from '../supabase-proposal-repository';
import type { CouncilProposalRow } from '../types';

/**
 * F12 unit coverage for the Supabase builder-chain contract of the
 * ProposalRepository: creates with a server-computed 24h expiry, stores
 * only the hash of the approval token, scopes by user_id in addition to
 * RLS, and FIFO-evicts oldest pending rows once the user is at cap.
 */

type Result<T> = { data: T; error: null | { message: string } };

function chain<T>(result: Result<T>) {
  const self: Record<string, unknown> = {};
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'lt', 'in', 'order'] as const;
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
    in: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
  };
}

const baseRow: CouncilProposalRow = {
  id: 'p1',
  user_id: 'u1',
  session_id: null,
  kind: 'task',
  payload: { title: 'Write plan' },
  status: 'pending',
  created_at: '2026-04-21T00:00:00Z',
  expires_at: '2026-04-22T00:00:00Z',
  approved_at: null,
  approval_token_hash: null,
};

describe('SupabaseProposalRepository (F12)', () => {
  let builder: ReturnType<typeof chain<CouncilProposalRow | CouncilProposalRow[] | Array<{ id: string; created_at: string }>>>;
  let fromSpy: ReturnType<typeof vi.fn>;
  let client: { from: typeof fromSpy };

  beforeEach(() => {
    builder = chain({ data: baseRow, error: null });
    fromSpy = vi.fn(() => builder);
    client = { from: fromSpy };
  });

  it('create computes a 24h expires_at and scopes insert by user_id', async () => {
    // create now performs three writes in order: sweep stale →
    // enforcePendingCap list → insert.
    const sweepBuilder = chain<Array<{ id: string }>>({ data: [], error: null });
    const listBuilder = chain<Array<{ id: string; created_at: string }>>({ data: [], error: null });
    const insertBuilder = chain<CouncilProposalRow>({ data: baseRow, error: null });
    const calls: Array<'sweep' | 'list' | 'insert'> = [];
    fromSpy = vi.fn(() => {
      const n = calls.length;
      const kind = n === 0 ? 'sweep' : n === 1 ? 'list' : 'insert';
      calls.push(kind);
      return kind === 'sweep' ? sweepBuilder : kind === 'list' ? listBuilder : insertBuilder;
    });
    const repo = new SupabaseProposalRepository({ from: fromSpy } as never);

    const before = Date.now();
    await repo.create({
      user_id: 'u1',
      session_id: null,
      kind: 'task',
      payload: { title: 'x' },
      expires_at: undefined as unknown as string,
    } as Parameters<typeof repo.create>[0]);
    const after = Date.now();

    const insertArg = insertBuilder.insert.mock.calls[0][0] as {
      user_id: string;
      expires_at: string;
      status: string;
    };
    expect(insertArg.user_id).toBe('u1');
    expect(insertArg.status).toBe('pending');
    const expiresMs = new Date(insertArg.expires_at).getTime();
    expect(expiresMs).toBeGreaterThanOrEqual(before + PROPOSAL_TTL_MS - 100);
    expect(expiresMs).toBeLessThanOrEqual(after + PROPOSAL_TTL_MS + 100);
  });

  it('markApproved refuses rows that are not still pending (defensive .eq on status)', async () => {
    const repo = new SupabaseProposalRepository(client as never);
    await repo.markApproved({ id: 'p1', userId: 'u1', approvalTokenHash: 'hhh' });
    const eqCalls = builder.eq.mock.calls;
    expect(eqCalls).toContainEqual(['id', 'p1']);
    expect(eqCalls).toContainEqual(['user_id', 'u1']);
    expect(eqCalls).toContainEqual(['status', 'pending']);
    const upd = builder.update.mock.calls[0][0] as { approval_token_hash: string; status: string };
    expect(upd.status).toBe('approved');
    expect(upd.approval_token_hash).toBe('hhh');
  });

  it('findById scopes by id + user_id and returns null on miss', async () => {
    builder = chain<CouncilProposalRow | null>({ data: null, error: null });
    fromSpy = vi.fn(() => builder);
    const repo = new SupabaseProposalRepository({ from: fromSpy } as never);
    const out = await repo.findById({ id: 'p1', userId: 'u1' });
    expect(out).toBeNull();
    const eqCalls = builder.eq.mock.calls;
    expect(eqCalls).toContainEqual(['id', 'p1']);
    expect(eqCalls).toContainEqual(['user_id', 'u1']);
  });

  it('expireStale flips pending rows past TTL and returns the count', async () => {
    builder = chain<Array<{ id: string }>>({
      data: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      error: null,
    });
    fromSpy = vi.fn(() => builder);
    const repo = new SupabaseProposalRepository({ from: fromSpy } as never);
    const n = await repo.expireStale(new Date('2026-05-01'));
    expect(n).toBe(3);
    expect(builder.update).toHaveBeenCalledWith({ status: 'expired' });
    expect(builder.eq).toHaveBeenCalledWith('status', 'pending');
    expect(builder.lt).toHaveBeenCalledWith('expires_at', '2026-05-01T00:00:00.000Z');
  });

  it('enforces the pending cap by FIFO-evicting the oldest when user is already at cap', async () => {
    // List call returns PENDING_CAP_PER_USER rows sorted oldest-first.
    const existing = Array.from({ length: PENDING_CAP_PER_USER }, (_, i) => ({
      id: `old-${i}`,
      created_at: `2026-04-2${i}T00:00:00Z`,
    }));
    const sweepBuilder = chain<Array<{ id: string }>>({ data: [], error: null });
    const listBuilder = chain<Array<{ id: string; created_at: string }>>({ data: existing, error: null });
    const evictBuilder = chain<Array<{ id: string }>>({ data: [{ id: 'old-0' }], error: null });
    const insertBuilder = chain<CouncilProposalRow>({ data: baseRow, error: null });

    const order: Array<'sweep' | 'list' | 'evict' | 'insert'> = [];
    fromSpy = vi.fn(() => {
      const n = order.length;
      const kind = n === 0 ? 'sweep' : n === 1 ? 'list' : n === 2 ? 'evict' : 'insert';
      order.push(kind);
      return kind === 'sweep'
        ? sweepBuilder
        : kind === 'list'
          ? listBuilder
          : kind === 'evict'
            ? evictBuilder
            : insertBuilder;
    });
    const log = vi.fn();
    const repo = new SupabaseProposalRepository({ from: fromSpy } as never, log);
    await repo.create({
      user_id: 'u1',
      session_id: null,
      kind: 'task',
      payload: { title: 't' },
    } as Parameters<typeof repo.create>[0]);

    // Expected: exactly dropCount = PENDING_CAP_PER_USER - (PENDING_CAP_PER_USER - 1) = 1 victim.
    const victims = evictBuilder.in.mock.calls[0];
    expect(victims[0]).toBe('id');
    expect(victims[1]).toEqual(['old-0']);
    expect(evictBuilder.update).toHaveBeenCalledWith({ status: 'expired' });
    expect(log).toHaveBeenCalledWith(
      expect.stringMatching(/dropped to make room/),
    );
  });

  it('expireStaleForUser scopes the archive sweep by user_id + status + past TTL', async () => {
    builder = chain<Array<{ id: string }>>({
      data: [{ id: 'a' }, { id: 'b' }],
      error: null,
    });
    fromSpy = vi.fn(() => builder);
    const repo = new SupabaseProposalRepository({ from: fromSpy } as never);
    const n = await repo.expireStaleForUser({
      userId: 'u1',
      now: new Date('2026-05-01'),
    });
    expect(n).toBe(2);
    expect(builder.update).toHaveBeenCalledWith({ status: 'expired' });
    const eqCalls = builder.eq.mock.calls;
    expect(eqCalls).toContainEqual(['user_id', 'u1']);
    expect(eqCalls).toContainEqual(['status', 'pending']);
    expect(builder.lt).toHaveBeenCalledWith(
      'expires_at',
      '2026-05-01T00:00:00.000Z',
    );
  });

  it('create sweeps the user’s stale pending rows before counting the cap', async () => {
    const sweepBuilder = chain<Array<{ id: string }>>({ data: [{ id: 'dead' }], error: null });
    const listBuilder = chain<Array<{ id: string; created_at: string }>>({ data: [], error: null });
    const insertBuilder = chain<CouncilProposalRow>({ data: baseRow, error: null });
    const order: Array<'sweep' | 'list' | 'insert'> = [];
    fromSpy = vi.fn(() => {
      const n = order.length;
      const kind = n === 0 ? 'sweep' : n === 1 ? 'list' : 'insert';
      order.push(kind);
      return kind === 'sweep' ? sweepBuilder : kind === 'list' ? listBuilder : insertBuilder;
    });
    const repo = new SupabaseProposalRepository({ from: fromSpy } as never);
    await repo.create({
      user_id: 'u1',
      session_id: null,
      kind: 'task',
      payload: { title: 't' },
    } as Parameters<typeof repo.create>[0]);
    // The first write was an UPDATE to `expired` scoped to user_id 'u1'.
    expect(sweepBuilder.update).toHaveBeenCalledWith({ status: 'expired' });
    expect(sweepBuilder.eq.mock.calls).toContainEqual(['user_id', 'u1']);
    expect(sweepBuilder.eq.mock.calls).toContainEqual(['status', 'pending']);
    expect(order).toEqual(['sweep', 'list', 'insert']);
  });

  it('revertToPending un-approves a row and clears approved metadata', async () => {
    const repo = new SupabaseProposalRepository(client as never);
    await repo.revertToPending({ id: 'p1', userId: 'u1' });
    const upd = builder.update.mock.calls[0][0] as {
      status: string;
      approved_at: string | null;
      approval_token_hash: string | null;
    };
    expect(upd.status).toBe('pending');
    expect(upd.approved_at).toBeNull();
    expect(upd.approval_token_hash).toBeNull();
    const eqCalls = builder.eq.mock.calls;
    expect(eqCalls).toContainEqual(['id', 'p1']);
    expect(eqCalls).toContainEqual(['user_id', 'u1']);
    // Refuses to transition rows that are not currently 'approved' —
    // keeps revert from resurrecting rejected/expired rows.
    expect(eqCalls).toContainEqual(['status', 'approved']);
  });

  it('surfaces Supabase errors as thrown Errors', async () => {
    builder = chain<CouncilProposalRow | null>({ data: null, error: { message: 'boom' } });
    fromSpy = vi.fn(() => builder);
    const repo = new SupabaseProposalRepository({ from: fromSpy } as never);
    await expect(repo.findById({ id: 'p1', userId: 'u1' })).rejects.toThrow(/boom/);
  });
});
