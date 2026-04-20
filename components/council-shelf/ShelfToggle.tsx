'use client';
/** F07 stub. */
export function ShelfToggle({ onToggle }: { onToggle?: () => void }) {
  return (
    <button type="button" data-shelf="toggle" onClick={onToggle} className="p-2 text-sm">
      Toggle
    </button>
  );
}
