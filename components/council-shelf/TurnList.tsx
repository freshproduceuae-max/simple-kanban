'use client';

import type { ReactNode } from 'react';

/**
 * F15/F16/F17 — Shelf turn list.
 *
 * Renders a flat sequence of user turns and Council replies on the
 * editorial surface per design-system.md §8.3. No bubble chrome; the
 * distinction between user and Council comes from typography + ink
 * weight, not from borders/backgrounds.
 *
 * Scoped retrofit note: this is the minimum rendering seam the mode
 * routes need. It ships in the F15 commit rather than reopening F07.
 *
 * Turn shape is deliberately small. A turn carries either a plain
 * `text` block (user messages, completed Council replies), a live
 * `stream` node (the F08 ThinkingStream in progress), or a `node`
 * slot for mode-specific surfaces (F16 chips, F16 proposal cards,
 * F17 web-confirm prompt). Callers choose which to fill.
 */

/**
 * F30 — soft-pause summary attached to a Council turn when the server
 * backed off one or more Anthropic 429s before starting to stream. The
 * shelf accumulates each `onSoftPause` callback into this shape:
 *   - `attempts` counts how many 429s fired for this turn (1 ≤ n ≤ 5)
 *   - `totalSeconds` is the cumulative server-side wait across retries
 *
 * Rendered as a small muted line ABOVE the turn body so the user can
 * see why a reply took longer than feels normal without having to
 * guess. Undefined on the common happy-path turn.
 */
export type ShelfTurnSoftPause = {
  attempts: number;
  totalSeconds: number;
};

export type ShelfTurn =
  | {
      kind: 'user';
      id: string;
      text: string;
    }
  | {
      kind: 'council';
      id: string;
      /** Finished text — shown when the stream has completed. */
      text?: string;
      /** Live stream surface, e.g. <ThinkingStream ... />. */
      stream?: ReactNode;
      /** Mode-specific affordance below the reply (chips, cards…). */
      extras?: ReactNode;
      /**
       * F25 — optional pre-body banner. Transparency mode D renders a
       * short "the Critic wasn't convinced" line ABOVE the reply so the
       * user reads the dissent before the reply — matches PRD §12.3.
       * Undefined on every other mode/turn; the slot is nullable by
       * design so the absence of a banner leaves the body layout
       * unchanged.
       */
      dissentBanner?: ReactNode;
      /**
       * F30 — soft-pause note rendered above the body when the server
       * backed off one or more 429s for this turn. Accumulates across
       * retries inside the shelf; undefined on turns that streamed
       * without needing any retry.
       */
      softPause?: ShelfTurnSoftPause;
    };

export function TurnList({ turns }: { turns: readonly ShelfTurn[] }) {
  if (turns.length === 0) {
    return (
      <p data-turn-list="empty" className="text-ink-500 italic">
        The Council is quiet. Ask something to begin.
      </p>
    );
  }

  return (
    <ol data-turn-list="root" className="space-y-space-4 list-none p-0 m-0">
      {turns.map((turn) => (
        <li key={turn.id} data-turn-kind={turn.kind}>
          {turn.kind === 'user' ? (
            <p
              data-turn-role="user"
              className="text-ink-700 font-family-body text-size-md"
            >
              {turn.text}
            </p>
          ) : (
            <div data-turn-role="council" className="space-y-space-2">
              {turn.softPause ? (
                <SoftPauseNote softPause={turn.softPause} />
              ) : null}
              {turn.dissentBanner ? (
                <div data-turn-dissent="">{turn.dissentBanner}</div>
              ) : null}
              <div
                data-turn-body
                className="text-ink-900 font-family-body text-size-md leading-relaxed"
              >
                {turn.stream ?? turn.text ?? null}
              </div>
              {turn.extras ? (
                <div data-turn-extras>{turn.extras}</div>
              ) : null}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

/**
 * F30 — soft-pause note. Quiet single-line notice above the turn body
 * explaining the reply took longer than it otherwise would. Uses the
 * editorial-quiet chrome (§8.3): no card, no icon, just ink-500 micro-
 * copy. We pluralise consciously — "retried after 3s" on a single
 * retry reads more naturally than "retried 1×".
 */
function SoftPauseNote({ softPause }: { softPause: ShelfTurnSoftPause }) {
  const { attempts, totalSeconds } = softPause;
  const seconds = Math.max(1, totalSeconds);
  const text =
    attempts <= 1
      ? `Rate-limited — retried after ${seconds}s.`
      : `Rate-limited — retried ${attempts}× after ${seconds}s.`;
  return (
    <p
      data-turn-soft-pause=""
      data-soft-pause-attempts={attempts}
      data-soft-pause-total-seconds={seconds}
      role="status"
      aria-live="polite"
      className="text-ink-500 font-family-body text-size-xs leading-relaxed"
    >
      {text}
    </p>
  );
}
