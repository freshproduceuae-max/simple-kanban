'use client';

import type { ReactNode } from 'react';

/**
 * Bottom shelf container — F07.
 * Real implementation (collapsible, design-token-driven) lands at Phase 11.
 */
export function ShelfContainer({ children }: { children?: ReactNode }) {
  return (
    <aside
      data-shelf="container"
      className="fixed inset-x-0 bottom-0 border-t bg-white"
    >
      {children}
    </aside>
  );
}
