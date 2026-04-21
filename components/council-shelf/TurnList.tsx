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
