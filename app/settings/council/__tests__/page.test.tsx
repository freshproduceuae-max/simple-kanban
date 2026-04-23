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

async function renderPage(
  props: Parameters<typeof CouncilSettingsPage>[0] = {},
): Promise<string> {
  const element = await CouncilSettingsPage(props);
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

  // F29 — "Delete all history" section + post-action banner.
  describe('delete-all form + banner (F29)', () => {
    it('renders the danger-zone section with both two-step gates', async () => {
      const html = await renderPage();
      expect(html).toContain('data-settings-section="delete-history"');
      expect(html).toContain('data-settings-delete-form=""');
      expect(html).toContain('data-settings-delete-confirm=""');
      expect(html).toContain('data-settings-delete-phrase=""');
      expect(html).toContain('data-settings-delete-submit=""');
      // The literal phrase the user must type is surfaced inline.
      expect(html).toContain('delete my history');
    });

    it('shows a success banner with the deleted count on ?deleted=N', async () => {
      const html = await renderPage({ searchParams: { deleted: '3' } });
      expect(html).toContain('data-settings-delete-notice="success"');
      expect(html).toContain('Deleted 3 sessions');
    });

    it('uses singular copy when only one session was deleted', async () => {
      const html = await renderPage({ searchParams: { deleted: '1' } });
      expect(html).toContain('Deleted 1 session ');
    });

    it('shows an "already empty" banner on ?deleted=0', async () => {
      const html = await renderPage({ searchParams: { deleted: '0' } });
      expect(html).toContain('data-settings-delete-notice="success"');
      expect(html).toContain('already empty');
    });

    it('shows the expected error banner for every known deleteError code', async () => {
      for (const code of [
        'confirm-required',
        'phrase-mismatch',
        'failed',
      ] as const) {
        const html = await renderPage({
          searchParams: { deleteError: code },
        });
        expect(html).toContain('data-settings-delete-notice="error"');
      }
    });

    it('does NOT render the banner when the params are absent or bogus', async () => {
      expect(await renderPage()).not.toContain(
        'data-settings-delete-notice',
      );
      // Unknown error code → no banner.
      expect(
        await renderPage({ searchParams: { deleteError: 'nonsense' } }),
      ).not.toContain('data-settings-delete-notice');
      // Non-integer deleted value → no banner.
      expect(
        await renderPage({ searchParams: { deleted: 'abc' } }),
      ).not.toContain('data-settings-delete-notice');
      // Negative deleted value → no banner (the action never sets
      // this; a hand-crafted URL should be treated as noise).
      expect(
        await renderPage({ searchParams: { deleted: '-1' } }),
      ).not.toContain('data-settings-delete-notice');
    });
  });
});
