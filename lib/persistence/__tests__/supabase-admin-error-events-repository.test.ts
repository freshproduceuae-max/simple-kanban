import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupabaseAdminErrorEventsRepository } from '../supabase-admin-error-events-repository';
import type { AdminErrorEventRow } from '../types';

type Result<T> = { data: T; error: null | { message: string } };
type CountResult = {
  count: number | null;
  error: null | { message: string };
};

function listChain<T>(result: Result<T>) {
  const self: Record<string, unknown> = {};
  const methods = ['select', 'insert', 'eq', 'gte', 'order', 'limit'] as const;
  for (const m of methods) self[m] = vi.fn(() => self);
  (self as { then: (r: (v: Result<T>) => void) => void }).then = (r) =>
    r(result);
  return self as {
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    gte: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
  };
}

function countChain(result: CountResult) {
  const self: Record<string, unknown> = {};
  const methods = ['select', 'eq', 'gte'] as const;
  for (const m of methods) self[m] = vi.fn(() => self);
  (self as { then: (r: (v: CountResult) => void) => void }).then = (r) =>
    r(result);
  return self as {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    gte: ReturnType<typeof vi.fn>;
  };
}

const sampleRow: AdminErrorEventRow = {
  id: 'e1',
  user_id: 'u1',
  kind: 'email_send_failed',
  agent: 'critic',
  reason: 'send-failed',
  created_at: '2026-04-23T12:00:00Z',
};

describe('SupabaseAdminErrorEventsRepository (F27)', () => {
  let fromSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fromSpy = vi.fn();
  });

  it('record inserts the full payload with agent + reason', async () => {
    const builder = listChain<null>({ data: null, error: null });
    fromSpy.mockReturnValue(builder);
    const repo = new SupabaseAdminErrorEventsRepository({
      from: fromSpy,
    } as never);

    await repo.record({
      user_id: 'u1',
      kind: 'email_send_failed',
      agent: 'researcher',
      reason: 'send-failed',
    });
    expect(fromSpy).toHaveBeenCalledWith('admin_error_events');
    expect(builder.insert).toHaveBeenCalledWith({
      user_id: 'u1',
      kind: 'email_send_failed',
      agent: 'researcher',
      reason: 'send-failed',
    });
  });

  it('record coerces missing agent / reason to null', async () => {
    const builder = listChain<null>({ data: null, error: null });
    fromSpy.mockReturnValue(builder);
    const repo = new SupabaseAdminErrorEventsRepository({
      from: fromSpy,
    } as never);

    await repo.record({ user_id: 'u1', kind: 'email_send_failed' });
    expect(builder.insert).toHaveBeenCalledWith({
      user_id: 'u1',
      kind: 'email_send_failed',
      agent: null,
      reason: null,
    });
  });

  it('record surfaces errors with a prefixed message', async () => {
    const builder = listChain<null>({
      data: null,
      error: { message: 'check-violation' },
    });
    fromSpy.mockReturnValue(builder);
    const repo = new SupabaseAdminErrorEventsRepository({
      from: fromSpy,
    } as never);

    await expect(
      repo.record({ user_id: 'u1', kind: 'email_send_failed' }),
    ).rejects.toThrow(
      /AdminErrorEventsRepository\.record: check-violation/,
    );
  });

  it('countSince uses head-select and filters on user_id + sinceIso', async () => {
    const builder = countChain({ count: 3, error: null });
    fromSpy.mockReturnValue(builder);
    const repo = new SupabaseAdminErrorEventsRepository({
      from: fromSpy,
    } as never);

    const got = await repo.countSince({
      userId: 'u1',
      sinceIso: '2026-04-22T00:00:00Z',
    });
    expect(got).toBe(3);
    expect(fromSpy).toHaveBeenCalledWith('admin_error_events');
    // Head-only select is how we avoid pulling row bodies just for a count.
    expect(builder.select).toHaveBeenCalledWith('id', {
      count: 'exact',
      head: true,
    });
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(builder.gte).toHaveBeenCalledWith(
      'created_at',
      '2026-04-22T00:00:00Z',
    );
  });

  it('countSince narrows by kind when provided', async () => {
    const builder = countChain({ count: 1, error: null });
    fromSpy.mockReturnValue(builder);
    const repo = new SupabaseAdminErrorEventsRepository({
      from: fromSpy,
    } as never);

    await repo.countSince({
      userId: 'u1',
      sinceIso: '2026-04-22T00:00:00Z',
      kind: 'email_send_failed',
    });
    expect(builder.eq).toHaveBeenCalledWith('kind', 'email_send_failed');
  });

  it('countSince returns 0 when the backend reports null', async () => {
    const builder = countChain({ count: null, error: null });
    fromSpy.mockReturnValue(builder);
    const repo = new SupabaseAdminErrorEventsRepository({
      from: fromSpy,
    } as never);
    const got = await repo.countSince({
      userId: 'u1',
      sinceIso: '2026-04-22T00:00:00Z',
    });
    expect(got).toBe(0);
  });

  it('countSince surfaces errors with a prefixed message', async () => {
    const builder = countChain({ count: null, error: { message: 'timeout' } });
    fromSpy.mockReturnValue(builder);
    const repo = new SupabaseAdminErrorEventsRepository({
      from: fromSpy,
    } as never);
    await expect(
      repo.countSince({ userId: 'u1', sinceIso: '2026-04-22T00:00:00Z' }),
    ).rejects.toThrow(/AdminErrorEventsRepository\.countSince: timeout/);
  });

  it('listSince orders newest-first and caps the limit', async () => {
    const builder = listChain<AdminErrorEventRow[]>({
      data: [sampleRow],
      error: null,
    });
    fromSpy.mockReturnValue(builder);
    const repo = new SupabaseAdminErrorEventsRepository({
      from: fromSpy,
    } as never);

    const got = await repo.listSince({
      userId: 'u1',
      sinceIso: '2026-04-22T00:00:00Z',
      limit: 5_000, // intentionally above the cap
    });
    expect(got).toEqual([sampleRow]);
    expect(builder.order).toHaveBeenCalledWith('created_at', {
      ascending: false,
    });
    // Upper bound is 2000 (matches MetricsRepository.listForUser).
    expect(builder.limit).toHaveBeenCalledWith(2000);
  });

  it('listSince applies the default limit when none is given', async () => {
    const builder = listChain<AdminErrorEventRow[]>({
      data: [],
      error: null,
    });
    fromSpy.mockReturnValue(builder);
    const repo = new SupabaseAdminErrorEventsRepository({
      from: fromSpy,
    } as never);

    await repo.listSince({ userId: 'u1', sinceIso: '2026-04-22T00:00:00Z' });
    expect(builder.limit).toHaveBeenCalledWith(500);
  });
});
