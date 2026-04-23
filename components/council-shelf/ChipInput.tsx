'use client';

import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';

/**
 * F16 — Chip input.
 *
 * Design-system §8.5: appears inline within the shelf conversation,
 * starts compact (label only), expands into a single-line input when
 * activated, fires `onSubmit` with the trimmed value, and collapses
 * back to the compact state.
 *
 * Rendered below a Council Plan reply to offer short follow-up
 * prompts the Consolidator itself requested (scope? audience? by
 * when?). The chip is NOT a free-form input — it's a suggested
 * clarifier with a one-line answer.
 *
 * This is a scoped F07-retrofit component living alongside ShelfInput
 * and TurnList to keep the council-shelf surface consistent. It does
 * not talk to any network — the parent decides what to do with the
 * submitted value (typically re-POSTs to /api/council/plan with the
 * clarification appended to the prior draft).
 */

export interface ChipInputProps {
  /**
   * Short label shown in the compact state (e.g. "scope?"). Also used
   * as the expanded input's placeholder.
   */
  label: string;
  /** Fires with the trimmed submitted value. */
  onSubmit: (value: string) => void;
  /** Disable both the compact button and the expanded input. */
  disabled?: boolean;
}

export function ChipInput({ label, onSubmit, disabled }: ChipInputProps) {
  const [expanded, setExpanded] = useState(false);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const inputId = useId();

  const expand = () => {
    if (disabled) return;
    setExpanded(true);
    // Focus the input once it has been rendered.
    queueMicrotask(() => inputRef.current?.focus());
  };

  const collapse = () => {
    setExpanded(false);
    setValue('');
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    collapse();
  };

  const handleKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      collapse();
    }
  };

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={expand}
        disabled={disabled}
        data-chip-state="compact"
        className={
          // F32 — min-h-tap keeps the 44px mobile hit area; visual
          // padding stays compact to honour the editorial-quiet shelf.
          'inline-flex items-center justify-center min-h-tap rounded-full ' +
          'border border-dashed border-border-default px-space-3 py-space-1 ' +
          'text-size-sm text-ink-700 transition-colors ' +
          'hover:border-ink-700 hover:text-ink-900 focus-visible:outline-none ' +
          'focus-visible:shadow-ring-focus disabled:opacity-50'
        }
      >
        {label}
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      data-chip-state="expanded"
      className="inline-flex items-center gap-space-2"
    >
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKey}
        onBlur={() => {
          // If the user didn't type anything, collapse back. Otherwise
          // keep the chip expanded so a subsequent Enter still works.
          if (value.trim().length === 0) collapse();
        }}
        disabled={disabled}
        placeholder={label}
        className={
          // F32 — min-h-tap for 44px tap floor on the inline input too.
          'min-w-[10rem] min-h-tap rounded-full border border-border-default ' +
          'bg-transparent px-space-3 py-space-1 text-size-sm text-ink-900 ' +
          'placeholder:text-ink-500 focus-visible:outline-none ' +
          'focus-visible:shadow-ring-focus disabled:opacity-50'
        }
      />
    </form>
  );
}
