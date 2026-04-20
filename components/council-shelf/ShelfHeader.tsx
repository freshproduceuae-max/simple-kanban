'use client';

import { ShelfToggle } from './ShelfToggle';

/**
 * F07 — Council shelf header strip.
 *
 * Always visible. Hosts the "Council" label in Fraunces display (one
 * voice, not three — design-system.md §10.1) and the disclosure toggle.
 * Pressing the whole strip also fires the toggle for a larger tap
 * target at 375px.
 */
export function ShelfHeader({
  isOpen,
  onToggle,
  controlsId,
}: {
  isOpen: boolean;
  onToggle: () => void;
  controlsId: string;
}) {
  return (
    <header
      data-shelf="header"
      className={[
        'flex items-center justify-between',
        'px-space-4 py-space-3',
        'select-none',
      ].join(' ')}
    >
      <span
        className={[
          'font-family-display text-size-md font-weight-semibold text-ink-900',
        ].join(' ')}
      >
        Council
      </span>
      <ShelfToggle isOpen={isOpen} onToggle={onToggle} controlsId={controlsId} />
    </header>
  );
}
