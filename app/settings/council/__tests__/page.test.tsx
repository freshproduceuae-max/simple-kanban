import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const getAuthedUserId = vi.fn();
const getForUserPref = vi.fn();
const redirectMock = vi.fn((_: string) => {
  throw new Error('NEXT_REDIRECT');
});

vi.mock('@/lib/auth/current-user', () => ({
  getAuthedUserId: () => getAuthedUserId(),
}));

vi.mock('@/lib/persistence/server', () => ({
  getUserPreferencesRepository: () => ({
    getForUser: (...a: unknown[]) => getForUserPref(...a),
    upsert: vi.fn(),
  }),
}));

vi.mock('next/navigation', () => ({
  redirect: (p: string) => redirectMock(p),
}));

import CouncilSettingsPage from '../page';

async function renderPage(): Promise<string> {
  const element = await CouncilSettingsPage();
  return renderToStaticMarkup(element);
}

describe('CouncilSettingsPage (F25)', () => {
  beforeEach(() => {
    getAuthedUserId.mockReset();
    getForUserPref.mockReset();
    redirectMock.mockClear();
    getAuthedUserId.mockResolvedValue('u1');
    getForUserPref.mockResolvedValue(null);
  });

  it('redirects to /sign-in when unauthenticated', async () => {
    getAuthedUserId.mockRejectedValueOnce(new Error('not-authenticated'));
    await expect(renderPage()).rejects.toThrow(/NEXT_REDIRECT/);
    expect(redirectMock).toHaveBeenCalledWith('/sign-in');
  });

  it('reads the preference via the repository', async () => {
    await renderPage();
    expect(getForUserPref).toHaveBeenCalledWith('u1');
  });

  it('renders the Council settings heading and default-B copy when no row exists', async () => {
    const html = await renderPage();
    expect(html).toContain('Council settings');
    expect(html).toContain('Default is B');
  });

  it('preselects the stored mode on the form', async () => {
    getForUserPref.mockResolvedValueOnce({
      user_id: 'u1',
      transparency_mode: 'D',
      created_at: '2026-04-22T00:00:00Z',
      updated_at: '2026-04-22T00:00:00Z',
    });
    const html = await renderPage();
    // The D radio is checked in SSR markup.
    const dCheckedPattern = /value="D"[^>]*checked|checked[^>]*value="D"/;
    expect(dCheckedPattern.test(html)).toBe(true);
  });

  it('falls back to B when the repo returns null (new user)', async () => {
    getForUserPref.mockResolvedValueOnce(null);
    const html = await renderPage();
    const bCheckedPattern = /value="B"[^>]*checked|checked[^>]*value="B"/;
    expect(bCheckedPattern.test(html)).toBe(true);
  });

  it('fail-quiets to B when the repo throws (Supabase wobble)', async () => {
    // Silence the console.warn from the resolver's fail-quiet path.
    const original = console.warn;
    console.warn = vi.fn();
    try {
      getForUserPref.mockRejectedValueOnce(new Error('db down'));
      const html = await renderPage();
      const bCheckedPattern = /value="B"[^>]*checked|checked[^>]*value="B"/;
      expect(bCheckedPattern.test(html)).toBe(true);
    } finally {
      console.warn = original;
    }
  });
});
