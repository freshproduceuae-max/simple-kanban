'use client';

/**
 * F07 — Council shelf toggle button.
 *
 * Text-led, reassuring. Not a loud filled primary. Exposes aria-expanded
 * and aria-controls so the header strip is a proper disclosure widget.
 * Keeps a small caret glyph that rotates when open; rotation is driven
 * by --motion-duration-fast + --motion-ease-standard.
 */
export function ShelfToggle({
  isOpen,
  onToggle,
  controlsId,
}: {
  isOpen: boolean;
  onToggle: () => void;
  controlsId: string;
}) {
  return (
    <button
      type="button"
      data-shelf="toggle"
      onClick={onToggle}
      aria-expanded={isOpen}
      aria-controls={controlsId}
      // F32 — min-h-tap enforces the 44px mobile hit area (design-
      // system §6.2). Visual padding stays compact; only the tap
      // zone expands.
      className={[
        'inline-flex items-center gap-space-2',
        'min-h-tap min-w-tap px-space-2 py-space-1',
        'font-family-body text-size-sm font-weight-medium text-ink-700',
        'hover:text-ink-900',
        'focus:outline-none focus:shadow-ring-focus',
        'rounded',
      ].join(' ')}
    >
      <span>{isOpen ? 'Close' : 'Open'}</span>
      <span
        aria-hidden="true"
        className={[
          'inline-block transition-transform duration-duration-fast ease-ease-standard',
          isOpen ? 'rotate-180' : 'rotate-0',
        ].join(' ')}
      >
        ▾
      </span>
    </button>
  );
}
