import { describe, expect, it } from 'vitest';
import config from '../../tailwind.config';

/**
 * F32 — regression guard for the mobile tap-target floor.
 *
 * design-system.md §6.2 requires 44px minimum on every user tap
 * target at the iPhone SE width. That value lives in one place —
 * `theme.extend.minHeight.tap` in `tailwind.config.ts` — and is
 * consumed as `min-h-tap` / `min-w-tap` across the shelf, proposal
 * cards, task dialog, sign-in form, settings, and history surfaces.
 *
 * If this token is deleted or re-valued, every consumer silently
 * falls below the 44px bar with no compile-time feedback (unknown
 * Tailwind utility classes are stripped, not errored). This test is
 * the canary: it fails loudly at CI time if the bar drifts.
 *
 * Not a visual test — we're not asserting the classes are applied to
 * specific components here. The component tests (ShelfInput,
 * ProposalCard, etc.) cover that. This file guards the source of
 * truth itself.
 */

describe('tailwind config — F32 mobile tap token', () => {
  it('exposes `minHeight.tap` at 44px (design-system.md §6.2)', () => {
    const extend = config.theme?.extend as
      | { minHeight?: Record<string, string> }
      | undefined;
    expect(extend?.minHeight?.tap).toBe('44px');
  });

  it('exposes `minWidth.tap` at 44px (square hit area for icon-only buttons)', () => {
    const extend = config.theme?.extend as
      | { minWidth?: Record<string, string> }
      | undefined;
    expect(extend?.minWidth?.tap).toBe('44px');
  });
});
