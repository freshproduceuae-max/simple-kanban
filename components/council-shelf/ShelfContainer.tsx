'use client';

import type { ReactNode } from 'react';

/**
 * F07 — Council shelf container.
 *
 * A sticky bottom drawer layered over the board. Never routes the user
 * away from their work (design-system.md §6.2). Full-width at 375px;
 * bounded to the board frame (~1216px = 3×320 + 2×gutters per §6.3) and
 * centered at 1280px so it does not span the entire browser canvas.
 *
 * Surface contract per §7.1:
 *   --color-surface-shelf, 1px top border on --color-border-default,
 *   no floating card chrome around the full shelf.
 */
export function ShelfContainer({ children }: { children?: ReactNode }) {
  return (
    <aside
      data-shelf="container"
      aria-label="Council shelf"
      className={[
        'fixed inset-x-0 bottom-0 z-40',
        'mx-auto w-full max-w-[1216px]',
        'border-t border-border-default bg-surface-shelf',
        'text-ink-900 font-family-body',
      ].join(' ')}
    >
      {children}
    </aside>
  );
}
