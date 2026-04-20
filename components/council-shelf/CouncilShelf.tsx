'use client';

import { useId, useState, type ReactNode } from 'react';
import { ShelfContainer } from './ShelfContainer';
import { ShelfHeader } from './ShelfHeader';
import { ShelfBody } from './ShelfBody';

/**
 * F07 — Composite Council shelf.
 *
 * Holds the open/closed state and wires the header disclosure to the
 * body region. Renders in `app/page.tsx` under the board. Actual
 * Council turn rendering arrives at F08 (thinking-stream) and F10
 * (Consolidator streams). Today, children is the integration seam.
 */
export function CouncilShelf({
  initialOpen = false,
  children,
}: {
  initialOpen?: boolean;
  children?: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const bodyId = useId();

  return (
    <ShelfContainer>
      <ShelfHeader
        isOpen={isOpen}
        onToggle={() => setIsOpen((v) => !v)}
        controlsId={bodyId}
      />
      <ShelfBody id={bodyId} isOpen={isOpen}>
        {children}
      </ShelfBody>
    </ShelfContainer>
  );
}
