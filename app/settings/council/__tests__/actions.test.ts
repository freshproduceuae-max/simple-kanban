import { describe, it, expect, beforeEach, vi } from 'vitest';

const getAuthedUserId = vi.fn();
const upsertPref = vi.fn();
const revalidatePath = vi.fn();

vi.mock('@/lib/auth/current-user', () => ({
  getAuthedUserId: () => getAuthedUserId(),
}));

vi.mock('@/lib/persistence/server', () => ({
  getUserPreferencesRepository: () => ({
    getForUser: vi.fn(),
    upsert: (...a: unknown[]) => upsertPref(...a),
  }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: (p: string) => revalidatePath(p),
}));

import { updateTransparencyMode } from '../actions';

describe('updateTransparencyMode (F25)', () => {
  beforeEach(() => {
    getAuthedUserId.mockReset();
    upsertPref.mockReset();
    revalidatePath.mockReset();
    getAuthedUserId.mockResolvedValue('u1');
    upsertPref.mockResolvedValue({
      user_id: 'u1',
      transparency_mode: 'C',
      created_at: '2026-04-22T00:00:00Z',
      updated_at: '2026-04-22T00:00:00Z',
    });
  });

  it('persists a valid mode and returns { ok: true, mode }', async () => {
    const result = await updateTransparencyMode('C');
    expect(result).toEqual({ ok: true, mode: 'C' });
    expect(upsertPref).toHaveBeenCalledWith({
      userId: 'u1',
      transparencyMode: 'C',
    });
  });

  it('revalidates /settings/council so the next SSR read sees the new row', async () => {
    await updateTransparencyMode('C');
    expect(revalidatePath).toHaveBeenCalledWith('/settings/council');
  });

  it('rejects a mode that is not one of the four enum values', async () => {
    // Casting through unknown so we can simulate a tampered client.
    const result = await updateTransparencyMode(
      'X' as unknown as 'A',
    );
    expect(result).toEqual({ ok: false, error: 'invalid-mode' });
    expect(upsertPref).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns not-authenticated when the auth lookup throws', async () => {
    getAuthedUserId.mockRejectedValueOnce(new Error('nope'));
    const result = await updateTransparencyMode('B');
    expect(result).toEqual({ ok: false, error: 'not-authenticated' });
    expect(upsertPref).not.toHaveBeenCalled();
  });

  it('returns persistence-failed when the upsert throws', async () => {
    upsertPref.mockRejectedValueOnce(new Error('db down'));
    // Silence console.error during this test.
    const original = console.error;
    console.error = vi.fn();
    try {
      const result = await updateTransparencyMode('D');
      expect(result).toEqual({ ok: false, error: 'persistence-failed' });
      // We still don't revalidate on failure — the row didn't change.
      expect(revalidatePath).not.toHaveBeenCalled();
    } finally {
      console.error = original;
    }
  });

  it('accepts every one of A, B, C, D', async () => {
    for (const mode of ['A', 'B', 'C', 'D'] as const) {
      upsertPref.mockResolvedValueOnce({
        user_id: 'u1',
        transparency_mode: mode,
        created_at: '2026-04-22T00:00:00Z',
        updated_at: '2026-04-22T00:00:00Z',
      });
      const result = await updateTransparencyMode(mode);
      expect(result).toEqual({ ok: true, mode });
    }
    expect(upsertPref).toHaveBeenCalledTimes(4);
  });
});
