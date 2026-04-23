'use client';

import { useId, useState } from 'react';
import type { CriticAudit } from '@/lib/council/server/critic-audit';

/**
 * F23 — "How I got here" reveal.
 *
 * The Council speaks as one voice; backstage, the Critic reviews each
 * draft for commitments the user might act on, risky advice, or
 * factual overreach. When the Critic runs (always on Plan, above the
 * risk threshold on Chat/Advise), the turn carries a small
 * `criticAudit` trailer. This component renders it as a disclosure:
 *
 *   1. A quiet trigger ("How I got here") under the Council reply.
 *   2. On tap, an inline panel opens with three sections —
 *      "Draft I reviewed", the risk tag, and "What I flagged".
 *
 * Design constraints:
 *   - One-voice rule (design-system.md §10.1): the label is "How I
 *     got here", never "Critic notes" or "Council members". The panel
 *     text stays in first-person, matching the Consolidator's voice.
 *   - Editorial quiet (§8.3): no card chrome, just a top rule; labels
 *     at font-size-xs ink-500; body at font-size-sm ink-700.
 *   - Motion (§9.1): panel fades in with duration-fast + ease-standard.
 *     We don't animate height — that would require measuring and is
 *     not worth the JS for something the user already asked to see.
 *   - Keyboard accessibility: native <button> with aria-expanded +
 *     aria-controls so assistive tech announces the relationship;
 *     the panel is unmounted when collapsed to keep the DOM small on
 *     long threads.
 *
 * Transparency-mode gating (F25) will later wrap this component with
 * an auto-open prop — A/B/C/D select whether to always open, open
 * only when the Critic fires, open on-tap, or never render at all.
 * For F23 the component is always on-tap; F25 adds `defaultOpen` and
 * `suppressed` props to the same surface.
 */

const RISK_LABEL: Record<CriticAudit['risk'], string> = {
  low: 'Low risk',
  medium: 'Medium risk',
  high: 'High risk',
};

// Dot colors map the risk tag to the accent palette (§4.2):
//   low    → moss-300 (calm)
//   medium → ink-500 (neutral weight)
//   high   → terra-500 (signal without alarming)
const RISK_DOT: Record<CriticAudit['risk'], string> = {
  low: 'bg-accent-moss-300',
  medium: 'bg-ink-500',
  high: 'bg-accent-terra-500',
};

export type HowIGotHereRevealProps = {
  audit: CriticAudit;
  /**
   * Optional test-only override of the initial open state. Kept for
   * existing F23 tests that pre-open the panel to exercise the panel
   * markup; the F25 production path uses `defaultOpen` instead.
   */
  initialOpen?: boolean;
  /**
   * F25 — open the reveal by default. Mode D ("Critic surfaces only
   * on unresolved dissent") always renders the reveal expanded so the
   * Critic's review is immediately visible; modes A/B/C leave it
   * closed and wait for the user's tap. A `true` value acts the same
   * as `initialOpen: true` — we coerce both into a single initial
   * state below so the component has one source of truth per mount.
   */
  defaultOpen?: boolean;
  /**
   * F25 — attach a small `[C]` source glyph to the trigger label.
   * Mode C ("specialists inline") flags every reveal with a glyph
   * that names its source without changing the voice; the Council
   * still speaks as one. Defaults to false so non-C modes render as
   * before.
   */
  showSourceGlyph?: boolean;
};

export function HowIGotHereReveal({
  audit,
  initialOpen = false,
  defaultOpen = false,
  showSourceGlyph = false,
}: HowIGotHereRevealProps) {
  const [open, setOpen] = useState(initialOpen || defaultOpen);
  const panelId = useId();

  return (
    <div
      data-how-i-got-here=""
      data-open={open ? 'true' : 'false'}
      className="flex flex-col gap-space-1"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        data-how-i-got-here-trigger=""
        onClick={() => setOpen((v) => !v)}
        // F32 — the "How I got here" reveal trigger is a text-led
        // disclosure; `min-h-tap` raises its hit area to the 44px
        // mobile floor without loudening the xs-sized label.
        className={[
          'self-start',
          'rounded-sm min-h-tap',
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
          // on the label (the audit section headings already name the
          // Critic); the glyph is decorative for sighted users only.
          <span
            aria-hidden="true"
            data-how-i-got-here-glyph="C"
            className="text-ink-500 not-italic font-weight-medium"
          >
            [C]
          </span>
        ) : null}
        {open ? 'Hide how I got here' : 'How I got here'}
      </button>
      {open ? (
        <div
          id={panelId}
          data-how-i-got-here-panel=""
          className={[
            'mt-space-1 pt-space-2',
            'border-t border-border-default',
            'flex flex-col gap-space-3',
            'text-size-sm font-family-body text-ink-700',
            'animate-in fade-in duration-duration-fast ease-ease-standard',
          ].join(' ')}
        >
          <section data-how-i-got-here-section="draft">
            <h4 className="text-size-xs font-weight-medium text-ink-500 uppercase tracking-wide">
              Draft I reviewed
            </h4>
            <p className="mt-space-1 whitespace-pre-wrap leading-relaxed">
              {audit.preDraft}
            </p>
            {audit.preDraftTruncated ? (
              <p
                data-how-i-got-here-truncation=""
                className="mt-space-1 text-size-xs italic text-ink-500"
              >
                (truncated — the full draft is in the reply above)
              </p>
            ) : null}
          </section>
          <section
            data-how-i-got-here-section="risk"
            className="flex items-center gap-space-2"
          >
            <h4 className="text-size-xs font-weight-medium text-ink-500 uppercase tracking-wide">
              Risk
            </h4>
            <span
              data-how-i-got-here-risk={audit.risk}
              className="inline-flex items-center gap-space-1 text-size-sm text-ink-700"
            >
              <span
                aria-hidden="true"
                className={`inline-block h-2 w-2 rounded-full ${RISK_DOT[audit.risk]}`}
              />
              {RISK_LABEL[audit.risk]}
            </span>
          </section>
          <section data-how-i-got-here-section="review">
            <h4 className="text-size-xs font-weight-medium text-ink-500 uppercase tracking-wide">
              What I flagged
            </h4>
            <p className="mt-space-1 whitespace-pre-wrap leading-relaxed">
              {audit.review}
            </p>
          </section>
        </div>
      ) : null}
    </div>
  );
}
