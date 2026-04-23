import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * F29 — Server Action coverage for `deleteSessionAction`. Every exit
 * path is a `redirect(...)` (no result object is returned to the
 * caller), so we mock `next/navigation` to throw a sentinel and
 * assert the url that the action tried to redirect to.
 */

const getAuthedUserId = vi.fn();
const deleteSession = vi.fn();
const redirect = vi.fn((_url: string): never => {
  // Mirror the real `redirect()`: it throws so execution halts.
  // Preserve the url on the error so the test can assert it.
  const err = new Error('NEXT_REDIRECT') as Error & { url: string };
  err.url = _url;
  throw err;
});
const revalidatePath = vi.fn();

vi.mock('@/lib/auth/current-user', () => ({
  getAuthedUserId: () => getAuthedUserId(),
}));

vi.mock('@/lib/persistence/server', () => ({
  getSessionRepository: () => ({
    deleteSession: (input: { sessionId: string; userId: string }) =>
      deleteSession(input),
  }),
}));

vi.mock('next/navigation', () => ({
  redirect: (url: string) => redirect(url),
}));

vi.mock('next/cache', () => ({
  revalidatePath: (p: string) => revalidatePath(p),
}));

import { deleteSessionAction } from '../actions';

const VALID_UUID = '11111111-2222-4333-8444-555555555555';

function buildFormData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

/**
 * Run the action and catch the redirect-sentinel the mock throws.
 * Returns the url the action tried to redirect to. Fails the test
 * if no redirect was invoked — every code path MUST redirect.
 */
async function runAction(fd: FormData): Promise<string> {
  try {
    await deleteSessionAction(fd);
  } catch (err) {
    const cast = err as Error & { url?: string };
    if (cast.message === 'NEXT_REDIRECT' && typeof cast.url === 'string') {
      return cast.url;
    }
    throw err;
  }
  throw new Error('deleteSessionAction completed without a redirect');
}

describe('deleteSessionAction (F29)', () => {
  beforeEach(() => {
    getAuthedUserId.mockReset();
    deleteSession.mockReset();
    redirect.mockClear();
    revalidatePath.mockClear();
    getAuthedUserId.mockResolvedValue('u1');
    deleteSession.mockResolvedValue(true);
  });

  it('redirects to ?deleted=1 on success', async () => {
    const url = await runAction(buildFormData({ sessionId: VALID_UUID }));
    expect(url).toBe('/history?deleted=1');
    expect(deleteSession).toHaveBeenCalledWith({
      sessionId: VALID_UUID,
      userId: 'u1',
    });
    expect(revalidatePath).toHaveBeenCalledWith('/history');
  });

  it('redirects to ?deleteError=missing when the repo returns false', async () => {
    deleteSession.mockResolvedValueOnce(false);
    const url = await runAction(buildFormData({ sessionId: VALID_UUID }));
    expect(url).toBe('/history?deleteError=missing');
  });

  it('redirects to ?deleteError=invalid when the id is not a UUID', async () => {
    const url = await runAction(buildFormData({ sessionId: 'not-a-uuid' }));
    expect(url).toBe('/history?deleteError=invalid');
    expect(deleteSession).not.toHaveBeenCalled();
  });

  it('redirects to ?deleteError=invalid when sessionId is absent', async () => {
    const url = await runAction(buildFormData({}));
    expect(url).toBe('/history?deleteError=invalid');
    expect(deleteSession).not.toHaveBeenCalled();
  });

  it('redirects to /sign-in when the user is not authenticated', async () => {
    getAuthedUserId.mockRejectedValueOnce(new Error('no session'));
    const url = await runAction(buildFormData({ sessionId: VALID_UUID }));
    expect(url).toBe('/sign-in');
    expect(deleteSession).not.toHaveBeenCalled();
  });

  it('redirects to ?deleteError=failed when the repo throws', async () => {
    deleteSession.mockRejectedValueOnce(new Error('rls denied'));
    // Silence the console.error the action emits on this path.
    const original = console.error;
    console.error = vi.fn();
    try {
      const url = await runAction(buildFormData({ sessionId: VALID_UUID }));
      expect(url).toBe('/history?deleteError=failed');
      // Failure path should NOT revalidate — nothing changed.
      expect(revalidatePath).not.toHaveBeenCalled();
    } finally {
      console.error = original;
    }
  });
});
