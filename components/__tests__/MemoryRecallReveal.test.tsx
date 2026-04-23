import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  MemoryRecallReveal,
  formatRecallDate,
} from '@/components/council-shelf/MemoryRecallReveal';
import type { MemoryRecallAudit } from '@/lib/council/server/memory-recall-audit';

/**
 * F24 — MemoryRecallReveal contract.
 *
 * The reveal sits under a Council reply when memory surfaced anything
 * into the Consolidator's prompt. Tests guard:
 *   1. Collapsed by default — the panel is NOT in the DOM.
 *   2. Trigger label uses first-person one-voice copy (design-system
 *      §10.1), singular vs. plural.
 *   3. On open: aria relationship announced, one entry per recall with
 *      a date header, snippet, and optional truncation hint.
 *   4. Keyboard activation (Enter/Space via native <button>).
 *   5. `formatRecallDate` helper covers the common relative buckets.
 */

const ONE: MemoryRecallAudit = {
  recalls: [
    {
      id: 'sum-1',
      sessionId: 'sess-1',
      createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
      snippet: 'You said the vendor SLA was the limiting factor last Friday.',
    },
  ],
};

const THREE: MemoryRecallAudit = {
  recalls: [
    {
      id: 'sum-1',
      sessionId: 'sess-1',
      createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      snippet: 'first note',
    },
    {
      id: 'sum-2',
      sessionId: 'sess-2',
      createdAt: new Date(Date.now() - 5 * 86_400_000).toISOString(),
      snippet: 'second note',
      snippetTruncated: true,
    },
    {
      id: 'sum-3',
      sessionId: 'sess-3',
      createdAt: new Date(Date.now() - 10 * 86_400_000).toISOString(),
      snippet: 'third note',
    },
  ],
};

describe('MemoryRecallReveal', () => {
  it('renders a collapsed trigger by default with singular copy for one recall', () => {
    render(<MemoryRecallReveal audit={ONE} />);
    const trigger = screen.getByRole('button', {
      name: /i remembered something from earlier \(1\)/i,
    });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    // Panel must be unmounted when collapsed.
    expect(
      document.querySelector('[data-memory-recall-panel]'),
    ).toBeNull();
  });

  it('renders plural copy when more than one recall is surfaced', () => {
    render(<MemoryRecallReveal audit={THREE} />);
    expect(
      screen.getByRole('button', {
        name: /i remembered a few things from earlier \(3\)/i,
      }),
    ).toBeInTheDocument();
  });

  it('opens the panel on click and surfaces one entry per recall', async () => {
    const user = userEvent.setup();
    render(<MemoryRecallReveal audit={THREE} />);
    await user.click(
      screen.getByRole('button', {
        name: /i remembered a few things from earlier/i,
      }),
    );
    const trigger = screen.getByRole('button', {
      name: /hide what i remembered \(3\)/i,
    });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const panelId = trigger.getAttribute('aria-controls');
    expect(panelId).toBeTruthy();
    expect(document.getElementById(panelId as string)).not.toBeNull();

    // One list item per recall, with snippets rendered.
    expect(
      document.querySelectorAll('[data-memory-recall-item]'),
    ).toHaveLength(3);
    expect(screen.getByText('first note')).toBeInTheDocument();
    expect(screen.getByText('second note')).toBeInTheDocument();
    expect(screen.getByText('third note')).toBeInTheDocument();
  });

  it('toggles back to collapsed on a second click and unmounts the panel', async () => {
    const user = userEvent.setup();
    render(<MemoryRecallReveal audit={ONE} initialOpen />);
    expect(
      document.querySelector('[data-memory-recall-panel]'),
    ).not.toBeNull();
    await user.click(
      screen.getByRole('button', { name: /hide what i remembered/i }),
    );
    expect(
      document.querySelector('[data-memory-recall-panel]'),
    ).toBeNull();
  });

  it('activates from the keyboard via Enter', async () => {
    const user = userEvent.setup();
    render(<MemoryRecallReveal audit={ONE} />);
    const trigger = screen.getByRole('button', {
      name: /i remembered something from earlier/i,
    });
    trigger.focus();
    await user.keyboard('{Enter}');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows a truncation hint when snippetTruncated is set', () => {
    render(<MemoryRecallReveal audit={THREE} initialOpen />);
    // Only one recall in THREE has snippetTruncated=true.
    const hints = document.querySelectorAll(
      '[data-memory-recall-truncation]',
    );
    expect(hints).toHaveLength(1);
    expect(hints[0].textContent).toMatch(/truncated/i);
  });

  it('does not show a truncation hint when no entries are truncated', () => {
    render(<MemoryRecallReveal audit={ONE} initialOpen />);
    expect(
      document.querySelector('[data-memory-recall-truncation]'),
    ).toBeNull();
  });
});

describe('formatRecallDate', () => {
  // A stable "now" pin so diffs are deterministic across machines.
  const NOW = new Date('2026-04-23T12:00:00Z');

  it('returns "earlier today" for times within the last 24 hours', () => {
    const twoHoursAgo = new Date(NOW.getTime() - 2 * 3_600_000).toISOString();
    expect(formatRecallDate(twoHoursAgo, NOW)).toBe('earlier today');
  });

  it('returns "yesterday" for the previous day bucket', () => {
    const yesterday = new Date(NOW.getTime() - 28 * 3_600_000).toISOString();
    expect(formatRecallDate(yesterday, NOW)).toBe('yesterday');
  });

  it('returns "N days ago" for 2-6 days back', () => {
    const threeDaysAgo = new Date(
      NOW.getTime() - 3 * 86_400_000,
    ).toISOString();
    expect(formatRecallDate(threeDaysAgo, NOW)).toBe('3 days ago');
  });

  it('returns "about a week ago" near the 7-14 day range', () => {
    const tenDaysAgo = new Date(NOW.getTime() - 10 * 86_400_000).toISOString();
    expect(formatRecallDate(tenDaysAgo, NOW)).toBe('about a week ago');
  });

  it('returns "a few weeks ago" in the 14-30 day range', () => {
    const twentyDaysAgo = new Date(
      NOW.getTime() - 20 * 86_400_000,
    ).toISOString();
    expect(formatRecallDate(twentyDaysAgo, NOW)).toBe('a few weeks ago');
  });

  it('returns "last month" in the 30-90 day range', () => {
    const fortyDaysAgo = new Date(
      NOW.getTime() - 40 * 86_400_000,
    ).toISOString();
    expect(formatRecallDate(fortyDaysAgo, NOW)).toBe('last month');
  });

  it('returns a month/day label beyond 90 days', () => {
    const sixMonthsAgo = new Date(
      NOW.getTime() - 180 * 86_400_000,
    ).toISOString();
    // We do not pin a locale here — the label shape is locale-dependent.
    // What matters is that the fallback path did NOT return a relative
    // bucket.
    const label = formatRecallDate(sixMonthsAgo, NOW);
    expect(label).not.toBe('earlier today');
    expect(label).not.toBe('yesterday');
    expect(label).not.toMatch(/days ago/i);
  });

  it('falls back to the raw ISO on a malformed input', () => {
    expect(formatRecallDate('not-a-date', NOW)).toBe('not-a-date');
  });

  it('handles a future-stamped row honestly (server clock skew)', () => {
    const future = new Date(NOW.getTime() + 3_600_000).toISOString();
    expect(formatRecallDate(future, NOW)).toBe('from a recent session');
  });
});
