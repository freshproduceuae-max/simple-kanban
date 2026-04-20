'use client';

import type { ReactNode } from 'react';

/**
 * F07 — Council shelf body.
 *
 * Editorial flow per design-system.md §8.3: Council turns render
 * directly on the shelf surface, separated by spacing and typography,
 * never wrapped in bubble chrome. Body is a scroll container so long
 * sessions do not push the board off-screen.
 *
 * Collapse/expand motion lives on the grid wrapper (see CouncilShelf):
 *   transition grid-template-rows 0fr <-> 1fr,
 *   duration 300ms, easing var(--motion-ease-standard), per §9.3.
 */
export function ShelfBody({
  id,
  isOpen,
  children,
}: {
  id: string;
  isOpen: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      id={id}
      data-shelf="body"
      role="region"
      aria-label="Council conversation"
      aria-hidden={!isOpen}
      className={[
        'grid transition-[grid-template-rows]',
        'duration-duration-medium ease-ease-standard',
        isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
      ].join(' ')}
    >
      <div className="overflow-hidden">
        <div
          className={[
            'px-space-4 pb-space-4 pt-space-2',
            'max-h-[60vh] overflow-y-auto',
            // Editorial flow: vertical rhythm via spacing + leading,
            // no borders or backgrounds around individual turns.
            'space-y-space-3',
            'font-family-body text-size-md leading-relaxed text-ink-900',
          ].join(' ')}
        >
          {children ?? (
            <p className="text-ink-500 italic">
              The Council is quiet. Open a session to begin.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
