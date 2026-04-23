import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CouncilSessionStatsRow } from '@/lib/persistence/types';

const getAuthedUserId = vi.fn();
const searchSessionsForUser = vi.fn();
// Kept on the mock surface so legacy test utilities that reach for
// these don't blow up even though F28 no longer hits them.
const listSessionsForUser = vi.fn();
const listTurns = vi.fn();
const redirectMock = vi.fn((_: string) => {
  // Next.js redirect() throws internally to short-circuit; emulate.
  throw new Error('NEXT_REDIRECT');
});

vi.mock('@/lib/auth/current-user', () => ({
  getAuthedUserId: () => getAuthedUserId(),
}));

vi.mock('@/lib/persistence/server', () => ({
  getSessionRepository: () => ({
    startSession: vi.fn(),
    endSession: vi.fn(),
    appendTurn: vi.fn(),
    listSessionsForUser: (...a: unknown[]) => listSessionsForUser(...a),
    listTurns: (...a: unknown[]) => listTurns(...a),
    searchSessionsForUser: (...a: unknown[]) =>
      searchSessionsForUser(...a),
  }),
}));

vi.mock('next/navigation', () => ({
  redirect: (p: string) => redirectMock(p),
}));

import HistoryPage from '../page';

function statsRow(
  overrides: Partial<CouncilSessionStatsRow> = {},
): CouncilSessionStatsRow {
  return {
    id: 'session-1',
    user_id: 'u1',
    mode: 'chat',
    started_at: '2026-04-21T12:00:00Z',
    ended_at: '2026-04-21T12:10:00Z',
    summary_written_at: null,
    tokens_in_sum: 12,
    tokens_out_sum: 34,
    total_tokens: 46,
    turn_count: 2,
    outcome: 'done',
    first_user_content: 'plan the launch',
    ...overrides,
  };
}

async function renderPage(
  props: Parameters<typeof HistoryPage>[0] = {},
): Promise<string> {
  const element = await HistoryPage(props);
  return renderToStaticMarkup(element);
}

describe('HistoryPage (F28)', () => {
  beforeEach(() => {
    getAuthedUserId.mockReset();
    searchSessionsForUser.mockReset();
    listSessionsForUser.mockReset();
    listTurns.mockReset();
    redirectMock.mockClear();
    getAuthedUserId.mockResolvedValue('u1');
    searchSessionsForUser.mockResolvedValue([]);
    listSessionsForUser.mockResolvedValue([]);
    listTurns.mockResolvedValue([]);
  });

  it('redirects to /sign-in when unauthenticated', async () => {
    getAuthedUserId.mockRejectedValueOnce(new Error('not-authenticated'));
    await expect(renderPage()).rejects.toThrow(/NEXT_REDIRECT/);
    expect(redirectMock).toHaveBeenCalledWith('/sign-in');
  });

  it('renders the bare empty-state message when no filters + no sessions', async () => {
    const html = await renderPage();
    expect(html).toContain('No sessions yet');
    expect(html).toContain('data-history-empty="none"');
    expect(searchSessionsForUser).toHaveBeenCalledWith({
      userId: 'u1',
      opts: {
        query: undefined,
        modes: undefined,
        outcomes: undefined,
        dateFrom: undefined,
        dateTo: undefined,
        tokenMin: undefined,
        tokenMax: undefined,
        limit: 25,
        cursor: undefined,
      },
    });
  });

  it('shows a distinct empty-state when filters are active but no rows match', async () => {
    const html = await renderPage({
      searchParams: { q: 'launch' },
    });
    expect(html).toContain('No sessions match these filters');
    expect(html).toContain('data-history-empty="filtered"');
    expect(html).toContain('Clear filters');
  });

  it('renders one row per session with derived columns sourced from the view', async () => {
    searchSessionsForUser.mockResolvedValueOnce([
      statsRow({ id: 's-a', mode: 'plan' }),
    ]);
    const html = await renderPage();
    expect(html).toContain('plan'); // mode
    expect(html).toContain('plan the launch'); // title from first_user_content
    expect(html).toContain('10m 0s'); // duration (12:00 → 12:10)
    expect(html).toContain('done'); // outcome
    expect(html).toContain('46'); // tokens: pulled straight from total_tokens
    expect(html).toContain('data-history-row="s-a"');
  });

  it('passes every parsed filter through to searchSessionsForUser', async () => {
    await renderPage({
      searchParams: {
        q: '  launch  ',
        mode: ['plan', 'chat'],
        outcome: 'done',
        from: '2026-04-01',
        to: '2026-04-30',
        tokenMin: '100',
        tokenMax: '2000',
        cursor: '2026-04-15T12:00:00Z',
      },
    });
    expect(searchSessionsForUser).toHaveBeenCalledWith({
      userId: 'u1',
      opts: expect.objectContaining({
        query: 'launch',
        modes: ['plan', 'chat'],
        outcomes: ['done'],
        dateFrom: '2026-04-01T00:00:00.000Z',
        dateTo: '2026-04-30T23:59:59.999Z',
        tokenMin: 100,
        tokenMax: 2000,
        cursor: '2026-04-15T12:00:00Z',
        limit: 25,
      }),
    });
  });

  it('silently drops invalid filter values rather than hard-failing', async () => {
    await renderPage({
      searchParams: {
        q: '   ',
        mode: 'bogus',
        outcome: ['done', 'nonsense'],
        from: 'not-a-date',
        // Day-overflow: V8 silently normalises this to 2026-03-02 via
        // `Date.parse`; our round-trip check must reject it so the
        // bad value never reaches PostgREST.
        to: '2026-02-30',
        tokenMin: '-5',
        tokenMax: 'abc',
      },
    });
    expect(searchSessionsForUser).toHaveBeenCalledWith({
      userId: 'u1',
      opts: expect.objectContaining({
        query: undefined,
        modes: undefined, // every mode invalid → empty → undefined
        outcomes: ['done'], // one valid outcome survives
        dateFrom: undefined,
        dateTo: undefined,
        tokenMin: undefined,
        tokenMax: undefined,
      }),
    });
  });

  it('also rejects out-of-range month/day combinations', async () => {
    await renderPage({
      searchParams: { from: '2026-13-40', to: '2026-00-00' },
    });
    expect(searchSessionsForUser).toHaveBeenCalledWith({
      userId: 'u1',
      opts: expect.objectContaining({
        dateFrom: undefined,
        dateTo: undefined,
      }),
    });
  });

  it('renders an "Older sessions" link preserving active filters when the page is full', async () => {
    const sessions = Array.from({ length: 25 }, (_, i) =>
      statsRow({
        id: `s-${i}`,
        started_at: `2026-04-21T12:${String(i).padStart(2, '0')}:00Z`,
      }),
    );
    searchSessionsForUser.mockResolvedValueOnce(sessions);
    const html = await renderPage({
      searchParams: { q: 'launch', mode: 'plan' },
    });
    expect(html).toContain('Older sessions');
    // Cursor is last row's started_at; filters ride along.
    expect(html).toContain('cursor=');
    expect(html).toContain('q=launch');
    expect(html).toContain('mode=plan');
  });

  it('does NOT render the pagination link when the page is short', async () => {
    searchSessionsForUser.mockResolvedValueOnce([statsRow()]);
    const html = await renderPage();
    expect(html).not.toContain('Older sessions');
  });

  it('renders the filter form with every control', async () => {
    const html = await renderPage();
    expect(html).toContain('data-history-filters=""');
    expect(html).toContain('data-history-filter="q"');
    expect(html).toContain('data-history-filter="mode"');
    expect(html).toContain('data-history-filter="outcome"');
    expect(html).toContain('data-history-filter="from"');
    expect(html).toContain('data-history-filter="to"');
    expect(html).toContain('data-history-filter="tokenMin"');
    expect(html).toContain('data-history-filter="tokenMax"');
    // The reset link goes back to a bare /history.
    expect(html).toContain('data-history-filter-reset=""');
  });

  // F29 — per-row delete button + post-action banner.
  describe('delete button + banner (F29)', () => {
    it('renders a Delete form with a hidden sessionId per row', async () => {
      searchSessionsForUser.mockResolvedValueOnce([
        statsRow({ id: 's-del-1' }),
      ]);
      const html = await renderPage();
      expect(html).toContain('data-history-row-delete="s-del-1"');
      expect(html).toContain('name="sessionId"');
      expect(html).toContain('value="s-del-1"');
    });

    it('emits an accessible aria-label mentioning the session timestamp', async () => {
      searchSessionsForUser.mockResolvedValueOnce([
        statsRow({
          id: 's-del-2',
          started_at: '2026-04-21T12:00:00Z',
        }),
      ]);
      const html = await renderPage();
      // The exact timestamp formatting is locale-sensitive, but the
      // aria-label must at least reference the session and be delete-
      // intent.
      expect(html).toMatch(/aria-label="Delete session from [^"]+"/);
    });

    it('shows a success banner on ?deleted=1', async () => {
      const html = await renderPage({ searchParams: { deleted: '1' } });
      expect(html).toContain('data-history-delete-notice="success"');
      expect(html).toContain('Session deleted.');
    });

    it('shows an error banner for each recognised deleteError code', async () => {
      for (const code of ['invalid', 'missing', 'failed'] as const) {
        const html = await renderPage({
          searchParams: { deleteError: code },
        });
        expect(html).toContain('data-history-delete-notice="error"');
      }
    });

    it('does NOT render the banner when the params are absent', async () => {
      const html = await renderPage();
      expect(html).not.toContain('data-history-delete-notice');
    });

    it('does NOT render the banner for an unknown deleteError code', async () => {
      const html = await renderPage({
        searchParams: { deleteError: 'nonsense' },
      });
      expect(html).not.toContain('data-history-delete-notice');
    });
  });
});
