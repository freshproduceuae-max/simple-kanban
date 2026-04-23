'use client';

import { useId, useMemo, useState } from 'react';
import type { MemoryRecallAudit } from '@/lib/council/server/memory-recall-audit';

/**
 * F24 — "I remembered from earlier" reveal.
 *
 * The Council carries memory across sessions via small per-session
 * summaries (F18). When the Researcher surfaces any of those summaries
 * into the Consolidator's system prompt, this component renders a
 * quiet disclosure under the reply:
 *
 *   1. A trigger ("I remembered from earlier") with a soft brain-heart
 *      dot on the left.
 *   2. On tap, an inline list opens with one entry per recalled
 *      summary — a relative date ("three days ago") followed by the
 *      snippet content in first-person Council voice.
 *
 * Design constraints:
 *   - One-voice rule (design-system.md §10.1): the header and
 *     per-entry prefix stay in first-person ("I remembered from
 *     earlier", "From …"). No mention of the Researcher or backstage
 *     agents — the Council speaks as one.
 *   - Editorial quiet (§8.3): no card chrome, just a top rule;
 *     matches the F23 "How I got here" reveal so the two can sit side-
 *     by-side on a turn without clashing.
 *   - Motion (§9.1): panel fades in with duration-fast + ease-standard;
 *     height is not animated (would require measuring and is not worth
 *     the JS for a user-initiated toggle).
 *   - Keyboard accessibility: native <button> with aria-expanded +
 *     aria-controls so screen readers announce the relationship; the
 *     list is unmounted when collapsed so long threads don't balloon
 *     the DOM with memory entries nobody opened.
 *
 * Transparency-mode gating (F25) will later wrap this component with
 * an auto-open prop — A/B/C/D select whether to always open, open only
 * when memory fired, open on-tap, or never render at all. For F24 the
 * component is always on-tap; F25 adds `defaultOpen` and `suppressed`
 * props to the same surface.
 */

export type MemoryRecallRevealProps = {
  audit: MemoryRecallAudit;
  /**
   * Optional test-only override of the initial open state. Kept for
   * existing F24 tests that pre-open the panel to exercise the panel
   * markup; the F25 production path uses `defaultOpen`.
   */
  initialOpen?: boolean;
  /**
   * F25 — open the reveal by default. Not currently driven by any
   * transparency mode (PRD §12.3 opens only the "How I got here"
   * reveal by default under mode D; memory recall stays on-tap), but
   * the prop matches the sibling `HowIGotHereReveal` API so the two
   * components have the same F25 surface for future extensions.
   */
  defaultOpen?: boolean;
  /**
   * F25 — attach a small `[R]` source glyph to the trigger label.
   * Mode C ("specialists inline") flags every reveal with a glyph
   * that names its source without changing the voice; the Council
   * still speaks as one. Defaults to false so non-C modes render as
   * before.
   */
  showSourceGlyph?: boolean;
};

/**
 * Format an ISO timestamp into a calm, editorial relative label —
 * "earlier today", "yesterday", "three days ago", "a few weeks ago",
 * "on Jan 4". The exact clock time is deliberately dropped: the user
 * cares whether this came from a recent session or a distant one, not
 * whether it was 2:14 PM vs 2:36 PM. Falls back to the raw ISO string
 * on parse failure so a malformed server value never crashes the
 * render.
 */
export function formatRecallDate(
  iso: string,
  now: Date = new Date(),
): string {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return iso;
  const diffMs = now.getTime() - when.getTime();
  const diffMinutes = Math.round(diffMs / 60_000);
  const diffHours = Math.round(diffMs / 3_600_000);
  const diffDays = Math.round(diffMs / 86_400_000);

  if (diffMinutes < 0) {
    // Future-stamped summary — shouldn't happen, but render honestly.
    return 'from a recent session';
  }
  if (diffMinutes < 60) return 'earlier today';
  if (diffHours < 24) return 'earlier today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return 'about a week ago';
  if (diffDays < 30) return 'a few weeks ago';
  if (diffDays < 90) return 'last month';
  // Older than ~3 months: fall back to a concrete month/day label so
  // the user gets real context instead of a vague "ages ago".
  try {
    return when.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function MemoryRecallReveal({
  audit,
  initialOpen = false,
  defaultOpen = false,
  showSourceGlyph = false,
}: MemoryRecallRevealProps) {
  const [open, setOpen] = useState(initialOpen || defaultOpen);
  const panelId = useId();
  const count = audit.recalls.length;

  // Resolve date labels once per render — cheap, but memoized so
  // repeated toggles don't re-parse the ISO strings.
  const labeled = useMemo(
    () =>
      audit.recalls.map((r) => ({
        ...r,
        dateLabel: formatRecallDate(r.createdAt),
      })),
    [audit.recalls],
  );

  const triggerLabel =
    count === 1 ? 'I remembered something from earlier' : 'I remembered a few things from earlier';

  return (
    <div
      data-memory-recall=""
      data-open={open ? 'true' : 'false'}
      className="flex flex-col gap-space-1"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        data-memory-recall-trigger=""
        onClick={() => setOpen((v) => !v)}
        className={[
          'self-start',
          'rounded-sm',
          'text-size-xs font-family-body text-ink-500',
          'underline underline-offset-2 decoration-dotted',
          'transition-colors duration-duration-fast ease-ease-standard',
          'hover:text-ink-700',
          'focus-visible:outline-none focus-visible:shadow-ring-focus',
          'inline-flex items-center gap-space-1',
        ].join(' ')}
      >
        {showSourceGlyph ? (
          // Mode C source glyph. `aria-hidden` so screen readers stay
          // on the label (the panel's per-entry dates already carry
          // the memory attribution); decorative for sighted users.
          <span
            aria-hidden="true"
            data-memory-recall-glyph="R"
            className="text-ink-500 not-italic font-weight-medium"
          >
            [R]
          </span>
        ) : null}
        {open ? `Hide what I remembered (${count})` : `${triggerLabel} (${count})`}
      </button>
      {open ? (
        <div
          id={panelId}
          data-memory-recall-panel=""
          className={[
            'mt-space-1 pt-space-2',
            'border-t border-border-default',
            'flex flex-col gap-space-3',
            'text-size-sm font-family-body text-ink-700',
            'animate-in fade-in duration-duration-fast ease-ease-standard',
          ].join(' ')}
        >
          <ul
            data-memory-recall-list=""
            className="flex flex-col gap-space-3 list-none p-0 m-0"
          >
            {labeled.map((recall) => (
              <li
                key={recall.id}
                data-memory-recall-item=""
                data-memory-recall-id={recall.id}
                className="flex flex-col gap-space-1"
              >
                <span
                  data-memory-recall-date=""
                  className="text-size-xs font-weight-medium text-ink-500 uppercase tracking-wide"
                >
                  From {recall.dateLabel}
                </span>
                <p className="whitespace-pre-wrap leading-relaxed">
                  {recall.snippet}
                </p>
                {recall.snippetTruncated ? (
                  <p
                    data-memory-recall-truncation=""
                    className="text-size-xs italic text-ink-500"
                  >
                    (truncated — I kept the shorter version for this reveal)
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
