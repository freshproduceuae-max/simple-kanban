'use client';

import type { MouseEvent } from 'react';
import { ShelfToggle } from './ShelfToggle';

/**
 * F07 — Council shelf header strip.
 *
 * Always visible. Hosts the "Council" label in Fraunces display (one
 * voice, not three — design-system.md §10.1) and the disclosure toggle.
 *
 * The whole strip is a hit target for pointer/touch so mobile users
 * don't have to aim for the small "Open" button at 375px (§6.2). The
 * disclosure button remains the accessible control (keyboard + screen
 * reader with aria-expanded); the strip onClick is the extra tap area.
 * A click that originates on the toggle itself fires the button handler
 * only — the strip handler guards against double-fire via a closest()
 * check on the event target.
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
  const handleStripClick = (event: MouseEvent<HTMLElement>) => {
    // If the click originated inside the nested toggle button, its own
    // onClick already invoked onToggle — bail so we don't double-fire.
    if ((event.target as HTMLElement).closest('[data-shelf="toggle"]')) return;
    onToggle();
  };

  return (
    <header
      data-shelf="header"
      onClick={handleStripClick}
      className={[
        'flex items-center justify-between',
        'px-space-4 py-space-3',
        'select-none cursor-pointer',
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
