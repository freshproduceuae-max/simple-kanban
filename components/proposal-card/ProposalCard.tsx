'use client';

import { useState } from 'react';
import { markOnce } from '@/lib/observability/client-marks';

/**
 * F13 — Proposal card + tap-to-approve flow.
 *
 * Visual contract (design-system.md §8.4 + §7):
 *   - `--color-surface-card` body, `1px dashed var(--color-border-default)`
 *   - `var(--shadow-proposal)` resting elevation
 *   - no left-edge priority bar (that belongs to committed tasks)
 *
 * Approval affordance (§8.6):
 *   - text-led, not a loud filled primary button
 *   - moss-tinted confirmation cue on hover/focus
 *
 * Approval motion (§9.3 "Proposal approval feedback"):
 *   - scale(0.98) + moss-tinted flash for 150ms on tap
 *   - then hand off: POST /api/council/proposals/:id/approve
 *   - success → fade the card into its "accepted" archived state
 *   - failure → calm inline sentence, button re-enabled
 *   - expired (410) → archive-with-explanation fade
 *
 * The card owns its own approve/fail/expire state so the shelf can
 * render a list of proposals without lifting per-card state. The
 * `onApproved` callback lets the caller (F16 Plan mode later) insert
 * the returned task into the board snapshot without a refetch.
 */

export type ProposalCardProps = {
  proposalId: string;
  title: string;
  summary?: string;
  /** Server-issued ISO timestamp (24h TTL per PRD §8.3). */
  expiresAt?: string;
  /** Called with the approved task (when the server returned one). */
  onApproved?: (task: unknown) => void;
  /** Called whenever the card transitions into an archived state. */
  onArchived?: (reason: 'approved' | 'expired' | 'rejected') => void;
  /** Override the approve endpoint; tests inject a fetch double. */
  approveFetch?: (url: string, init: RequestInit) => Promise<Response>;
};

type UiState =
  | { kind: 'pending' }
  | { kind: 'approving' }
  | { kind: 'approved' }
  | { kind: 'expired' }
  | { kind: 'failed'; message: string };

const APPROVE_FLASH_MS = 150;

export function ProposalCard({
  proposalId,
  title,
  summary,
  expiresAt,
  onApproved,
  onArchived,
  approveFetch,
}: ProposalCardProps) {
  const [state, setState] = useState<UiState>(() => {
    if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
      return { kind: 'expired' };
    }
    return { kind: 'pending' };
  });

  const doApprove = async () => {
    if (state.kind !== 'pending') return;
    // F31 — fire the terminal beacon in the first-run path. The gap
    // between `council:first-user-submit` and this mark is "time the
    // Council needed to produce a tappable, trusted proposal" — the
    // core 60-second onboarding KPI per vision §6.
    markOnce('council:first-proposal-tap');
    setState({ kind: 'approving' });
    const fetcher = approveFetch ?? fetch;
    try {
      const res = await fetcher(`/api/council/proposals/${proposalId}/approve`, {
        method: 'POST',
      });
      if (res.status === 410) {
        setState({ kind: 'expired' });
        onArchived?.('expired');
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setState({
          kind: 'failed',
          message: body.error ?? "I couldn't log that approval. Try again in a moment.",
        });
        return;
      }
      const body = (await res.json()) as { task?: unknown };
      // Brief moss-tinted flash handled by CSS class transition;
      // the approved state resolves after the flash window so the
      // scale(0.98) doesn't abort before it lands.
      await new Promise((r) => setTimeout(r, APPROVE_FLASH_MS));
      setState({ kind: 'approved' });
      onApproved?.(body.task);
      onArchived?.('approved');
    } catch (err) {
      setState({
        kind: 'failed',
        message: err instanceof Error ? err.message : 'Approval failed.',
      });
    }
  };

  const isBusy = state.kind === 'approving';
  const isArchived = state.kind === 'approved' || state.kind === 'expired';

  return (
    <article
      data-proposal-card
      data-state={state.kind}
      aria-busy={isBusy}
      className={[
        'relative rounded-md bg-[var(--color-surface-card)] p-4',
        'border border-dashed border-[var(--color-border-default)]',
        'shadow-[var(--shadow-proposal)]',
        'transition-[transform,opacity,background-color] duration-[var(--motion-duration-fast)]',
        'ease-[var(--motion-ease-standard)]',
        state.kind === 'approving'
          ? 'scale-[0.98] bg-[var(--color-accent-moss-300)]/25'
          : '',
        isArchived ? 'opacity-70' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <h3 className="font-display text-base leading-snug text-[var(--color-ink-900)]">
        {title}
      </h3>
      {summary ? (
        <p className="mt-1 text-sm leading-snug text-[var(--color-ink-700)]">
          {summary}
        </p>
      ) : null}

      {state.kind === 'pending' ? (
        <button
          type="button"
          onClick={doApprove}
          // F32 — the terminal tap in the onboarding stopwatch path
          // (vision §6 / F31). `min-h-tap` + `min-w-tap` guarantee the
          // 44px mobile hit area the design-system mandates (§6.2)
          // without loudening the text-led affordance (§8.6).
          className={[
            'mt-3 inline-flex items-center justify-center gap-1',
            'min-h-tap min-w-tap text-sm',
            'text-[var(--color-accent-moss-700)] underline underline-offset-4',
            'hover:text-[var(--color-ink-900)] focus-visible:outline-none',
            'focus-visible:ring-[var(--ring-focus)]',
          ].join(' ')}
          data-testid="proposal-approve"
        >
          Approve
        </button>
      ) : null}

      {state.kind === 'approving' ? (
        <p className="mt-3 text-sm text-[var(--color-ink-700)]">Adding…</p>
      ) : null}

      {state.kind === 'approved' ? (
        <p className="mt-3 text-sm text-[var(--color-accent-moss-700)]">Added.</p>
      ) : null}

      {state.kind === 'expired' ? (
        <p className="mt-3 text-sm italic text-[var(--color-ink-500)]">
          This one timed out before a tap. I can redraft it.
        </p>
      ) : null}

      {state.kind === 'failed' ? (
        <div className="mt-3 flex items-center gap-3">
          <p className="text-sm text-[var(--color-ink-700)]">{state.message}</p>
          <button
            type="button"
            onClick={() => setState({ kind: 'pending' })}
            // F32 — 44px tap floor on the recovery path, same contract
            // as the Approve affordance above.
            className={[
              'inline-flex items-center justify-center min-h-tap min-w-tap',
              'text-sm text-[var(--color-accent-moss-700)]',
              'underline underline-offset-4',
            ].join(' ')}
          >
            Try again
          </button>
        </div>
      ) : null}
    </article>
  );
}
