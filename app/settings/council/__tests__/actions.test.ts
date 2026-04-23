import { describe, it, expect, beforeEach, vi } from 'vitest';

const getAuthedUserId = vi.fn();
const upsertPref = vi.fn();
const deleteAllSessionsForUser = vi.fn();
const revalidatePath = vi.fn();
const redirect = vi.fn((_url: string): never => {
  // Mirror real `redirect()`: throws so control leaves the action.
  const err = new Error('NEXT_REDIRECT') as Error & { url: string };
  err.url = _url;
  throw err;
});

vi.mock('@/lib/auth/current-user', () => ({
  getAuthedUserId: () => getAuthedUserId(),
}));

vi.mock('@/lib/persistence/server', () => ({
  getUserPreferencesRepository: () => ({
    getForUser: vi.fn(),
    upsert: (...a: unknown[]) => upsertPref(...a),
  }),
  getSessionRepository: () => ({
    deleteAllSessionsForUser: (input: { userId: string }) =>
      deleteAllSessionsForUser(input),
  }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: (p: string) => revalidatePath(p),
}));

vi.mock('next/navigation', () => ({
  redirect: (url: string) => redirect(url),
}));

import {
  deleteAllHistoryAction,
  updateTransparencyMode,
} from '../actions';
import { DELETE_ALL_PHRASE } from '../delete-history-constants';

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

describe('deleteAllHistoryAction (F29)', () => {
  beforeEach(() => {
    getAuthedUserId.mockReset();
    deleteAllSessionsForUser.mockReset();
    revalidatePath.mockClear();
    redirect.mockClear();
    getAuthedUserId.mockResolvedValue('u1');
    deleteAllSessionsForUser.mockResolvedValue(0);
  });

  function buildFormData(entries: Record<string, string>): FormData {
    const fd = new FormData();
    for (const [k, v] of Object.entries(entries)) fd.set(k, v);
    return fd;
  }

  async function runAction(fd: FormData): Promise<string> {
    try {
      await deleteAllHistoryAction(fd);
    } catch (err) {
      const cast = err as Error & { url?: string };
      if (cast.message === 'NEXT_REDIRECT' && typeof cast.url === 'string') {
        return cast.url;
      }
      throw err;
    }
    throw new Error('deleteAllHistoryAction completed without a redirect');
  }

  it('runs the purge when both gates pass and redirects with the deleted count', async () => {
    deleteAllSessionsForUser.mockResolvedValueOnce(7);
    const url = await runAction(
      buildFormData({ confirm: 'on', phrase: DELETE_ALL_PHRASE }),
    );
    expect(url).toBe('/settings/council?deleted=7');
    expect(deleteAllSessionsForUser).toHaveBeenCalledWith({ userId: 'u1' });
    expect(revalidatePath).toHaveBeenCalledWith('/history');
    expect(revalidatePath).toHaveBeenCalledWith('/settings/council');
  });

  it('trims + lowercases the confirmation phrase before comparing', async () => {
    deleteAllSessionsForUser.mockResolvedValueOnce(3);
    const url = await runAction(
      buildFormData({
        confirm: 'on',
        phrase: '  DELETE My HISTORY   ',
      }),
    );
    expect(url).toBe('/settings/council?deleted=3');
  });

  it('redirects to ?deleteError=confirm-required when the checkbox is missing', async () => {
    const url = await runAction(
      buildFormData({ phrase: DELETE_ALL_PHRASE }),
    );
    expect(url).toBe('/settings/council?deleteError=confirm-required');
    expect(deleteAllSessionsForUser).not.toHaveBeenCalled();
  });

  it('redirects to ?deleteError=phrase-mismatch when the phrase is wrong', async () => {
    const url = await runAction(
      buildFormData({ confirm: 'on', phrase: 'delete my data' }),
    );
    expect(url).toBe('/settings/council?deleteError=phrase-mismatch');
    expect(deleteAllSessionsForUser).not.toHaveBeenCalled();
  });

  it('redirects to ?deleteError=phrase-mismatch when the phrase is absent', async () => {
    const url = await runAction(buildFormData({ confirm: 'on' }));
    expect(url).toBe('/settings/council?deleteError=phrase-mismatch');
  });

  it('redirects to /sign-in when the user is not authenticated', async () => {
    getAuthedUserId.mockRejectedValueOnce(new Error('no session'));
    const url = await runAction(
      buildFormData({ confirm: 'on', phrase: DELETE_ALL_PHRASE }),
    );
    expect(url).toBe('/sign-in');
    expect(deleteAllSessionsForUser).not.toHaveBeenCalled();
  });

  it('redirects to ?deleteError=failed when the repo throws', async () => {
    deleteAllSessionsForUser.mockRejectedValueOnce(new Error('db down'));
    const original = console.error;
    console.error = vi.fn();
    try {
      const url = await runAction(
        buildFormData({ confirm: 'on', phrase: DELETE_ALL_PHRASE }),
      );
      expect(url).toBe('/settings/council?deleteError=failed');
      // Failure path MUST NOT revalidate — no rows changed.
      expect(revalidatePath).not.toHaveBeenCalled();
    } finally {
      console.error = original;
    }
  });

  it('returns ?deleted=0 when the user had no history', async () => {
    deleteAllSessionsForUser.mockResolvedValueOnce(0);
    const url = await runAction(
      buildFormData({ confirm: 'on', phrase: DELETE_ALL_PHRASE }),
    );
    expect(url).toBe('/settings/council?deleted=0');
  });
});
