'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';

/**
 * F15/F16/F17 — Shelf input affordance.
 *
 * F07 shipped the shelf scaffold (container + header + body + toggle)
 * but the user-input pathway was left for the modes. All three mode
 * PRs need the same input shape — a single-line text field that
 * submits on Enter, disables while a turn is in flight, and reports
 * back to the host component which calls the right `/api/council/*`
 * endpoint.
 *
 * Scoped retrofit note: this lives in `components/council-shelf/` next
 * to the other F07 primitives, but is landing in the F15 commit — not
 * as a reopened F07 design pass but as the smallest bit of shelf
 * plumbing the mode routes cannot be tested without. Design-system.md
 * §7.2 (focus) and §8.3 (editorial surfaces) are the only style refs.
 */

export function ShelfInput({
  onSubmit,
  disabled = false,
  placeholder = 'Ask the Council…',
  autoFocus = false,
}: {
  /** Fires with the trimmed user text. Empty strings are filtered here. */
  onSubmit: (userInput: string) => void;
  /** True while a prior turn is still streaming. */
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  // F31 — late autofocus. `autoFocus` starts false (we don't steal focus
  // on mount; a brand-new user is still reading the greeting as it
  // streams). When the parent flips it to true, we imperatively focus
  // because the native `autoFocus` attribute only fires on mount.
  // Empty dep-list intentional: we re-run whenever `autoFocus` flips
  // AND when `disabled` releases (so focus lands once the busy gate
  // opens, not in the middle of a stream).
  useEffect(() => {
    if (!autoFocus || disabled) return;
    const el = inputRef.current;
    if (!el) return;
    // Avoid stealing focus if the user already clicked elsewhere.
    if (document.activeElement && document.activeElement !== document.body) {
      if (document.activeElement === el) return;
      // Another input/button has focus — respect the user.
      return;
    }
    el.focus();
  }, [autoFocus, disabled]);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    setValue('');
    onSubmit(trimmed);
  }

  return (
    <form
      data-shelf="input"
      onSubmit={handleSubmit}
      className="flex items-center gap-space-2 px-space-4 py-space-3 border-t border-border-default"
    >
      <label htmlFor="shelf-input-field" className="sr-only">
        Message to the Council
      </label>
      <input
        ref={inputRef}
        id="shelf-input-field"
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        enterKeyHint="send"
        // F32 — `rounded` (Tailwind default) replaces the previously
        // undefined `rounded-radius-sm` utility; `min-h-tap` enforces
        // the 44px mobile tap floor on the input itself.
        className={[
          'flex-1 bg-transparent outline-none',
          'text-size-md font-family-body text-ink-900',
          'placeholder:text-ink-500',
          'focus-visible:shadow-ring-focus rounded min-h-tap px-space-2 py-space-1',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        ].join(' ')}
        aria-disabled={disabled}
      />
      <button
        type="submit"
        disabled={disabled || value.trim().length === 0}
        // F32 — inline-flex + min-h-tap for the 44px bar; `rounded`
        // replaces the undefined `rounded-radius-sm` utility.
        className={[
          'inline-flex items-center justify-center',
          'text-size-sm font-family-body text-ink-700',
          'rounded min-h-tap min-w-tap px-space-3 py-space-1',
          'hover:text-ink-900 focus-visible:shadow-ring-focus',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        ].join(' ')}
      >
        Send
      </button>
    </form>
  );
}
