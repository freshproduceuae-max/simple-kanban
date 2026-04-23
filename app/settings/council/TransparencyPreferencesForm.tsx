'use client';

import {
  useId,
  useMemo,
  useState,
  useTransition,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { HowIGotHereReveal } from '@/components/council-shelf/HowIGotHereReveal';
import { MemoryRecallReveal } from '@/components/council-shelf/MemoryRecallReveal';
import type { TransparencyMode } from '@/lib/persistence';
import {
  updateTransparencyMode,
  type UpdateTransparencyModeResult,
} from './actions';

/**
 * F25 — transparency-mode selector with live preview.
 *
 * Shows the four modes as a radio group (A/B/C/D), each paired with a
 * one-line description. On change we fire the Server Action inside a
 * React transition so the UI stays responsive even while the upsert
 * is in flight, and the local state is immediately reflected in the
 * preview panel — the user sees the effect of their choice before the
 * round-trip completes. If the action fails, we fall back to the
 * last-saved mode and surface an inline error.
 *
 * The preview is a fake Council turn wired to the same F23/F24 reveal
 * components the real shelf uses, so the settings page is honest
 * about what each mode changes. Mode A strips the reveals; B leaves
 * them collapsed on-tap; C adds [R]/[C] source glyphs; D opens the
 * "How I got here" reveal by default and surfaces a dissent banner
 * above the reply when risk is high.
 */

type Props = {
  initialMode: TransparencyMode;
};

type ModeOption = {
  value: TransparencyMode;
  label: string;
  hint: string;
};

const OPTIONS: readonly ModeOption[] = [
  {
    value: 'A',
    label: 'A — Clean voice only',
    hint: 'Just the Council reply. No reveals, no glyphs.',
  },
  {
    value: 'B',
    label: 'B — Reveal on demand',
    hint: 'Default. Tap "How I got here" to see what the Critic flagged.',
  },
  {
    value: 'C',
    label: 'C — Source glyphs',
    hint: '[R] when memory fired, [C] when the Critic weighed in. Still one voice.',
  },
  {
    value: 'D',
    label: 'D — Critic surfaces on dissent',
    hint: 'The "How I got here" reveal opens by default; unresolved dissent surfaces above the reply.',
  },
];

// Sample artifacts powering the live preview. Both are static — the
// preview is honest about the shape of a real reveal (same components,
// same copy conventions) without spinning up a Council round-trip.
const SAMPLE_PREDRAFT =
  'I\u2019d just go ahead and deploy on Friday afternoon \u2014 the rollback is quick if anything breaks.';
const SAMPLE_REVIEW =
  'Friday deploys are a classic foot-gun. Monday ships have more on-call coverage and less chance of weekend firefighting.';
const SAMPLE_MEMORY_ID = 'sample-memory';
const SAMPLE_SESSION_ID = 'sample-session';
const SAMPLE_MEMORY_CREATED_AT = '2026-04-18T00:00:00Z';
const SAMPLE_MEMORY_SNIPPET =
  'We talked about moving the cold-start fix to Monday so the on-call rotation has full coverage.';

export function TransparencyPreferencesForm({ initialMode }: Props) {
  const [mode, setMode] = useState<TransparencyMode>(initialMode);
  const [status, setStatus] = useState<
    | { kind: 'idle' }
    | { kind: 'saving' }
    | { kind: 'saved'; mode: TransparencyMode }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' });
  const [, startTransition] = useTransition();
  const groupLabelId = useId();

  // Stable sample audits — memoised so passing them to the reveal
  // components doesn't create a new object every render and trigger
  // their internal useMemo resets.
  const sampleCriticAudit = useMemo(
    () => ({
      risk: 'high' as const,
      preDraft: SAMPLE_PREDRAFT,
      review: SAMPLE_REVIEW,
    }),
    [],
  );
  const sampleMemoryAudit = useMemo(
    () => ({
      recalls: [
        {
          id: SAMPLE_MEMORY_ID,
          sessionId: SAMPLE_SESSION_ID,
          createdAt: SAMPLE_MEMORY_CREATED_AT,
          snippet: SAMPLE_MEMORY_SNIPPET,
        },
      ],
    }),
    [],
  );

  const commit = (next: TransparencyMode) => {
    if (next === mode) return;
    const previous = mode;
    setMode(next);
    setStatus({ kind: 'saving' });
    startTransition(() => {
      void (async () => {
        let result: UpdateTransparencyModeResult;
        try {
          result = await updateTransparencyMode(next);
        } catch (err) {
          // Revert the local pick if the action threw. A network /
          // runtime error must not leave the UI showing a value the
          // server never stored.
          setMode(previous);
          setStatus({
            kind: 'error',
            message:
              err instanceof Error
                ? err.message
                : 'Something went wrong saving your choice.',
          });
          return;
        }
        if (result.ok) {
          setStatus({ kind: 'saved', mode: result.mode });
        } else {
          setMode(previous);
          setStatus({
            kind: 'error',
            message: errorCopy(result.error),
          });
        }
      })();
    });
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    // ARIA radiogroup arrow-key navigation (WAI-ARIA Authoring
    // Practices). Keeps keyboard users from tabbing through every
    // option and reflects selection on arrow move.
    const idx = OPTIONS.findIndex((o) => o.value === mode);
    let nextIdx = idx;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIdx = (idx + 1) % OPTIONS.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIdx = (idx - 1 + OPTIONS.length) % OPTIONS.length;
    } else if (event.key === 'Home') {
      nextIdx = 0;
    } else if (event.key === 'End') {
      nextIdx = OPTIONS.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    commit(OPTIONS[nextIdx].value);
  };

  const showReveals = mode !== 'A';
  const showCriticGlyph = mode === 'C';
  const showMemoryGlyph = mode === 'C';
  const defaultCriticOpen = mode === 'D';
  const showDissentBanner = mode === 'D';

  return (
    <form
      data-transparency-form=""
      className="flex flex-col gap-space-6"
      onSubmit={(e) => e.preventDefault()}
    >
      {/*
        WAI-ARIA Authoring Practices radiogroup pattern: a single
        role="radiogroup" with aria-labelledby pointing at a hidden
        label. We deliberately avoid wrapping this in a <fieldset>
        because fieldset carries an implicit role="group" and NVDA /
        VoiceOver would announce the label twice from the nested
        grouping. See WAI-ARIA APG "Radio Group Example Using Roving
        tabindex".
      */}
      <div className="flex flex-col gap-space-3">
        <span id={groupLabelId} className="sr-only">
          Transparency mode
        </span>
        <div
          role="radiogroup"
          aria-labelledby={groupLabelId}
          data-transparency-options=""
          className="flex flex-col gap-space-2"
          onKeyDown={onKeyDown}
        >
          {OPTIONS.map((opt) => {
            const selected = mode === opt.value;
            return (
              <label
                key={opt.value}
                data-transparency-option={opt.value}
                data-selected={selected ? 'true' : 'false'}
                className={[
                  'flex cursor-pointer items-start gap-space-3',
                  'rounded-sm border border-border-default',
                  'px-space-3 py-space-3',
                  'transition-colors duration-duration-fast ease-ease-standard',
                  selected
                    ? 'bg-surface-card'
                    : 'hover:bg-surface-card/70',
                ].join(' ')}
              >
                <input
                  type="radio"
                  name="transparency-mode"
                  value={opt.value}
                  checked={selected}
                  // Roving tabindex pattern: only the selected option
                  // is tabbable; arrow keys move within the group.
                  tabIndex={selected ? 0 : -1}
                  onChange={() => commit(opt.value)}
                  className="mt-1"
                  aria-describedby={`${groupLabelId}-${opt.value}-hint`}
                />
                <span className="flex flex-col gap-space-1">
                  <span className="font-weight-medium text-ink-900">
                    {opt.label}
                  </span>
                  <span
                    id={`${groupLabelId}-${opt.value}-hint`}
                    className="text-size-sm text-ink-700"
                  >
                    {opt.hint}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        <p
          role="status"
          aria-live="polite"
          data-transparency-status={status.kind}
          className="text-size-xs text-ink-500"
        >
          {status.kind === 'saving' && 'Saving…'}
          {status.kind === 'saved' && `Saved — mode ${status.mode}.`}
          {status.kind === 'error' && `Couldn\u2019t save: ${status.message}`}
          {status.kind === 'idle' && '\u00a0'}
        </p>
      </div>

      <section
        data-transparency-preview=""
        aria-label="Live preview of the selected mode"
        className="flex flex-col gap-space-3 rounded-sm border border-border-default p-space-4"
      >
        <h2 className="text-size-xs font-weight-medium text-ink-500 uppercase tracking-wide">
          Preview — mode {mode}
        </h2>
        {showDissentBanner ? (
          <div
            data-dissent-banner=""
            className={[
              'rounded-sm border border-border-default',
              'bg-surface-card px-space-3 py-space-2',
              'text-size-sm font-family-body text-ink-700',
              'flex flex-col gap-space-1',
            ].join(' ')}
          >
            <span className="text-size-xs font-weight-medium text-ink-500 uppercase tracking-wide">
              The Critic wasn&rsquo;t convinced
            </span>
            <p className="leading-relaxed whitespace-pre-wrap">
              {SAMPLE_REVIEW}
            </p>
          </div>
        ) : null}
        <p className="text-ink-900 text-size-md leading-relaxed">
          Monday morning feels like a better ship window. The on-call
          rotation is thinnest on Fridays, and a rollback at 3 a.m. is
          a tax nobody should pay on principle.
        </p>
        {showReveals ? (
          <div className="flex flex-col gap-space-3">
            <MemoryRecallReveal
              audit={sampleMemoryAudit}
              showSourceGlyph={showMemoryGlyph}
            />
            <HowIGotHereReveal
              audit={sampleCriticAudit}
              defaultOpen={defaultCriticOpen}
              showSourceGlyph={showCriticGlyph}
            />
          </div>
        ) : (
          <p
            data-transparency-preview-empty=""
            className="text-size-xs italic text-ink-500"
          >
            No reveals under mode A. The Council reply stands on its own.
          </p>
        )}
      </section>
    </form>
  );
}

function errorCopy(code: string): string {
  switch (code) {
    case 'invalid-mode':
      return 'That mode isn\u2019t one of the four.';
    case 'not-authenticated':
      return 'Your session ended. Please sign in again.';
    case 'persistence-failed':
      return 'The server couldn\u2019t save your choice.';
    default:
      return code;
  }
}
