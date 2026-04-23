import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupabaseUserPreferencesRepository } from '../supabase-user-preferences-repository';
import type { UserPreferencesRow } from '../types';

type Result<T> = { data: T; error: null | { message: string } };

function chain<T>(result: Result<T>) {
  const self: Record<string, unknown> = {};
  const methods = ['select', 'insert', 'upsert', 'eq'] as const;
  for (const m of methods) self[m] = vi.fn(() => self);
  self.single = vi.fn(async () => result);
  self.maybeSingle = vi.fn(async () => result);
  (self as { then: (r: (v: Result<T>) => void) => void }).then = (r) => r(result);
  return self as {
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
  };
}

const prefRow: UserPreferencesRow = {
  user_id: 'u1',
  transparency_mode: 'C',
  created_at: '2026-04-22T00:00:00Z',
  updated_at: '2026-04-22T00:00:00Z',
};

describe('SupabaseUserPreferencesRepository (F25)', () => {
  let fromSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fromSpy = vi.fn();
  });

  it('getForUser reads with .eq(user_id) and .maybeSingle — returns the row', async () => {
    const builder = chain<UserPreferencesRow>({ data: prefRow, error: null });
    fromSpy.mockReturnValue(builder);
    const repo = new SupabaseUserPreferencesRepository({ from: fromSpy } as never);

    const got = await repo.getForUser('u1');
    expect(fromSpy).toHaveBeenCalledWith('user_preferences');
    expect(builder.select).toHaveBeenCalledWith('*');
    // Defence-in-depth: explicit user_id filter alongside RLS.
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(builder.maybeSingle).toHaveBeenCalled();
    expect(got).toEqual(prefRow);
  });

  it('getForUser returns null when no row exists (new user path)', async () => {
    const builder = chain<UserPreferencesRow | null>({ data: null, error: null });
    fromSpy.mockReturnValue(builder);
    const repo = new SupabaseUserPreferencesRepository({ from: fromSpy } as never);

    const got = await repo.getForUser('u-new');
    expect(got).toBeNull();
  });

  it('getForUser surfaces the select error with a prefixed message', async () => {
    const builder = chain<UserPreferencesRow | null>({
      data: null,
      error: { message: 'offline' },
    });
    fromSpy.mockReturnValue(builder);
    const repo = new SupabaseUserPreferencesRepository({ from: fromSpy } as never);

    await expect(repo.getForUser('u1')).rejects.toThrow(
      /UserPreferencesRepository\.getForUser: offline/,
    );
  });

  it('upsert calls .upsert with user_id + transparency_mode + updated_at and onConflict=user_id', async () => {
    const builder = chain<UserPreferencesRow>({ data: prefRow, error: null });
    fromSpy.mockReturnValue(builder);
    const repo = new SupabaseUserPreferencesRepository({ from: fromSpy } as never);

    const before = Date.now();
    const got = await repo.upsert({ userId: 'u1', transparencyMode: 'C' });
    const after = Date.now();

    expect(fromSpy).toHaveBeenCalledWith('user_preferences');
    expect(builder.upsert).toHaveBeenCalledTimes(1);
    const [payload, options] = builder.upsert.mock.calls[0];
    expect(payload).toMatchObject({
      user_id: 'u1',
      transparency_mode: 'C',
    });
    // updated_at is stamped at write time — we verify it's a fresh ISO
    // within the call window so the server-side timestamp can't drift.
    expect(typeof payload.updated_at).toBe('string');
    const stamped = Date.parse(payload.updated_at as string);
    expect(stamped).toBeGreaterThanOrEqual(before);
    expect(stamped).toBeLessThanOrEqual(after);
    // onConflict is how we make this a real one-row-per-user upsert
    // rather than a read-then-write race.
    expect(options).toEqual({ onConflict: 'user_id' });
    expect(builder.select).toHaveBeenCalledWith('*');
    expect(builder.single).toHaveBeenCalled();
    expect(got).toEqual(prefRow);
  });

  it('upsert surfaces errors with a prefixed message', async () => {
    const builder = chain<UserPreferencesRow>({
      data: null as unknown as UserPreferencesRow,
      error: { message: 'check-violation' },
    });
    fromSpy.mockReturnValue(builder);
    const repo = new SupabaseUserPreferencesRepository({ from: fromSpy } as never);

    await expect(
      repo.upsert({ userId: 'u1', transparencyMode: 'B' }),
    ).rejects.toThrow(/UserPreferencesRepository\.upsert: check-violation/);
  });
});
