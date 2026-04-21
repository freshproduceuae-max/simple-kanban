import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type {
  CouncilSessionRow,
  CouncilTurnRow,
} from '@/lib/persistence/types';

const getAuthedUserId = vi.fn();
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
  }),
}));

vi.mock('next/navigation', () => ({
  redirect: (p: string) => redirectMock(p),
}));

import HistoryPage from '../page';

function sessionRow(overrides: Partial<CouncilSessionRow> = {}): CouncilSessionRow {
  return {
    id: 'session-1',
    user_id: 'u1',
    mode: 'chat',
    started_at: '2026-04-21T12:00:00Z',
    ended_at: '2026-04-21T12:10:00Z',
    summary_written_at: null,
    ...overrides,
  };
}

function turnRow(overrides: Partial<CouncilTurnRow> = {}): CouncilTurnRow {
  return {
    id: 't',
    session_id: 'session-1',
    user_id: 'u1',
    agent: 'user',
    role: 'user',
    content: 'plan the launch',
    tool_calls: null,
    tokens_in: 12,
    tokens_out: 34,
    created_at: '2026-04-21T12:00:05Z',
    ...overrides,
  };
}

async function renderPage(
  props: Parameters<typeof HistoryPage>[0] = {},
): Promise<string> {
  const element = await HistoryPage(props);
  return renderToStaticMarkup(element);
}

describe('HistoryPage (F19)', () => {
  beforeEach(() => {
    getAuthedUserId.mockReset();
    listSessionsForUser.mockReset();
    listTurns.mockReset();
    redirectMock.mockClear();
    getAuthedUserId.mockResolvedValue('u1');
    listSessionsForUser.mockResolvedValue([]);
    listTurns.mockResolvedValue([]);
  });

  it('redirects to /sign-in when unauthenticated', async () => {
    getAuthedUserId.mockRejectedValueOnce(new Error('not-authenticated'));
    await expect(renderPage()).rejects.toThrow(/NEXT_REDIRECT/);
    expect(redirectMock).toHaveBeenCalledWith('/sign-in');
  });

  it('renders an empty-state message when the user has no sessions', async () => {
    const html = await renderPage();
    expect(html).toContain('No sessions yet');
    expect(listSessionsForUser).toHaveBeenCalledWith('u1', {
      limit: 25,
      cursor: undefined,
    });
  });

  it('renders one row per session with derived columns', async () => {
    listSessionsForUser.mockResolvedValueOnce([
      sessionRow({ id: 's-a', mode: 'plan' }),
    ]);
    listTurns.mockResolvedValueOnce([turnRow()]);
    const html = await renderPage();
    expect(html).toContain('plan'); // mode
    expect(html).toContain('plan the launch'); // title
    expect(html).toContain('10m 0s'); // duration
    expect(html).toContain('done'); // outcome
    expect(html).toContain('46'); // token cost (12 + 34)
  });

  it('passes the cursor through to the repo when one is provided', async () => {
    await renderPage({ searchParams: { cursor: '2026-04-20T00:00:00Z' } });
    expect(listSessionsForUser).toHaveBeenCalledWith('u1', {
      limit: 25,
      cursor: '2026-04-20T00:00:00Z',
    });
  });

  it('renders an "Older sessions" link when the page is full', async () => {
    const sessions = Array.from({ length: 25 }, (_, i) =>
      sessionRow({ id: `s-${i}`, started_at: `2026-04-21T12:${String(i).padStart(2, '0')}:00Z` }),
    );
    listSessionsForUser.mockResolvedValueOnce(sessions);
    listTurns.mockResolvedValue([]);
    const html = await renderPage();
    expect(html).toContain('Older sessions');
    expect(html).toContain('cursor=');
  });

  it('does NOT render the pagination link when the page is short', async () => {
    listSessionsForUser.mockResolvedValueOnce([sessionRow()]);
    const html = await renderPage();
    expect(html).not.toContain('Older sessions');
  });
});
