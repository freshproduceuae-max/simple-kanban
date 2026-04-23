import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CouncilMetricRow } from '@/lib/persistence/types';

const getAuthedAdmin = vi.fn();
const listForUser = vi.fn();
const redirectMock = vi.fn((_: string) => {
  // Next's redirect() throws to short-circuit the render; emulate.
  throw new Error('NEXT_REDIRECT');
});

vi.mock('@/lib/auth/admin', () => ({
  getAuthedAdmin: () => getAuthedAdmin(),
}));

vi.mock('@/lib/persistence/server', () => ({
  getMetricsRepository: () => ({
    record: vi.fn(),
    listForUser: (...a: unknown[]) => listForUser(...a),
    dailyTokenTotalForUser: vi.fn(),
  }),
}));

vi.mock('next/navigation', () => ({
  redirect: (p: string) => redirectMock(p),
}));

import AdminMetricsPage from '../page';

function row(overrides: Partial<CouncilMetricRow> = {}): CouncilMetricRow {
  return {
    id: overrides.id ?? 'm-1',
    user_id: overrides.user_id ?? 'u-admin',
    session_id: overrides.session_id ?? null,
    agent: overrides.agent ?? 'consolidator',
    call_started_at: overrides.call_started_at ?? '2026-04-23T12:00:00Z',
    first_token_ms: overrides.first_token_ms ?? 200,
    full_reply_ms: overrides.full_reply_ms ?? 2000,
    tokens_in: overrides.tokens_in ?? 100,
    tokens_out: overrides.tokens_out ?? 400,
    outcome: overrides.outcome ?? 'ok',
  };
}

async function renderPage(
  props: Parameters<typeof AdminMetricsPage>[0] = {},
): Promise<string> {
  const element = await AdminMetricsPage(props);
  return renderToStaticMarkup(element);
}

describe('AdminMetricsPage (F26)', () => {
  beforeEach(() => {
    getAuthedAdmin.mockReset();
    listForUser.mockReset();
    redirectMock.mockClear();
    getAuthedAdmin.mockResolvedValue({
      userId: 'u-admin',
      email: 'cd@example.com',
    });
    listForUser.mockResolvedValue([]);
  });

  it('redirects unauthed visitors to /sign-in', async () => {
    getAuthedAdmin.mockRejectedValueOnce(new Error('not-authenticated'));
    await expect(renderPage()).rejects.toThrow(/NEXT_REDIRECT/);
    expect(redirectMock).toHaveBeenCalledWith('/sign-in');
  });

  it('redirects authed-but-non-admin visitors to /', async () => {
    getAuthedAdmin.mockRejectedValueOnce(new Error('not-admin'));
    await expect(renderPage()).rejects.toThrow(/NEXT_REDIRECT/);
    expect(redirectMock).toHaveBeenCalledWith('/');
  });

  it('redirects on any unexpected auth error to /', async () => {
    // Defense-in-depth: whatever the helper throws, non-admin users
    // must never see the page.
    getAuthedAdmin.mockRejectedValueOnce(new Error('weird'));
    await expect(renderPage()).rejects.toThrow(/NEXT_REDIRECT/);
    expect(redirectMock).toHaveBeenCalledWith('/');
  });

  // Pins the `sinceIso` the page computed against a window measured
  // around the render call — no dependency on how long the test
  // itself took to run. `toleranceMs` absorbs only the render
  // duration plus a small CI clock jitter budget.
  async function expectWindowHours(
    searchParams: Parameters<typeof renderPage>[0],
    expectedHours: number,
  ) {
    const before = Date.now();
    await renderPage(searchParams);
    const after = Date.now();
    const call = listForUser.mock.calls.at(-1)?.[0];
    const sinceMs = new Date(call.sinceIso).getTime();
    const expectedMs = before - expectedHours * 3_600_000;
    const toleranceMs = after - before + 1000;
    expect(sinceMs).toBeGreaterThanOrEqual(expectedMs - toleranceMs);
    expect(sinceMs).toBeLessThanOrEqual(expectedMs + toleranceMs);
  }

  it('reads metrics for the admin’s user_id with the default 24h window', async () => {
    await expectWindowHours({}, 24);
    expect(listForUser).toHaveBeenCalledTimes(1);
    const call = listForUser.mock.calls[0][0];
    expect(call.userId).toBe('u-admin');
    expect(call.limit).toBe(2000);
  });

  it('respects a valid ?window= override and clamps an invalid one', async () => {
    await expectWindowHours({ searchParams: { window: '1' } }, 1);
    listForUser.mockClear();
    // Unknown values fall back to 24h.
    await expectWindowHours({ searchParams: { window: '9999' } }, 24);
  });

  it('renders the heading, the admin email, and the F26 scope caveat', async () => {
    const html = await renderPage();
    expect(html).toContain('Admin metrics');
    expect(html).toContain('cd@example.com');
    // Scope note referencing F27 should be present.
    expect(html).toContain('F27');
  });

  it('renders the empty-state message when there are no rows', async () => {
    const html = await renderPage();
    expect(html).toContain('data-admin-metrics-empty');
    expect(html).toContain('No metrics rows in this window');
  });

  it('renders the totals + per-agent tables when rows exist', async () => {
    listForUser.mockResolvedValueOnce([
      row({
        agent: 'consolidator',
        outcome: 'ok',
        tokens_in: 100,
        tokens_out: 400,
        first_token_ms: 150,
        full_reply_ms: 1500,
      }),
      row({
        agent: 'consolidator',
        outcome: 'ok',
        tokens_in: 200,
        tokens_out: 800,
        first_token_ms: 200,
        full_reply_ms: 2500,
      }),
      row({
        agent: 'researcher',
        outcome: 'rate_limited',
        tokens_in: 0,
        tokens_out: 0,
        first_token_ms: null,
        full_reply_ms: null,
      }),
      row({
        agent: 'critic',
        outcome: 'error',
        tokens_in: 20,
        tokens_out: 0,
        first_token_ms: null,
        full_reply_ms: null,
      }),
    ]);
    const html = await renderPage();
    expect(html).toContain('data-admin-metrics-totals');
    expect(html).toContain('data-admin-metrics-per-agent');
    // All three agent rows present.
    expect(html).toContain('data-admin-metrics-agent="researcher"');
    expect(html).toContain('data-admin-metrics-agent="consolidator"');
    expect(html).toContain('data-admin-metrics-agent="critic"');
    // Token totals should be rendered (1,200 tokens out from consolidator).
    expect(html).toContain('1,200');
    // 429 count of 1 should appear somewhere.
    expect(html).toMatch(/429/);
  });

  it('marks the currently-selected window in the switcher and leaves the others as links', async () => {
    const html = await renderPage({ searchParams: { window: '24' } });
    // 24h should carry the -selected marker; 1h and 168h should be links.
    expect(html).toMatch(
      /data-admin-metrics-window="24"[^>]*data-admin-metrics-window-selected|data-admin-metrics-window-selected[^>]*data-admin-metrics-window="24"/,
    );
    expect(html).toContain('href="/admin/metrics?window=1"');
    expect(html).toContain('href="/admin/metrics?window=168"');
  });
});
