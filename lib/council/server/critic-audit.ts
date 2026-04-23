import type { CriticResult } from '@/lib/council/critic';
import type { RiskLevel } from '@/lib/persistence/types';

/**
 * F23 — Critic-audit trailer shape.
 *
 * The three user-facing mode routes (chat/plan/advise) each emit a
 * JSON trailer on the last line of their streamed response. When the
 * Critic actually ran, the route merges this fragment into that
 * trailer so the shelf composer can render the "How I got here"
 * reveal next to the reply.
 *
 * `preDraft` is the raw Consolidator text the Critic reviewed — no
 * warn banner, no plan-fence stripping. Showing it next to the
 * review text is the whole point of the reveal: the user sees what
 * the Council drafted and what the Critic flagged on the same turn.
 *
 * When `critic.ran === false` we emit nothing — there's no audit
 * material to reveal. That rule keeps the trailer small on the
 * below-threshold fast-path (the common case) and avoids a dead
 * reveal trigger on the card.
 */
export type CriticAudit = {
  risk: RiskLevel;
  review: string;
  preDraft: string;
  /**
   * True when `preDraft` was truncated from the raw Consolidator text.
   * The reveal panel renders an "… (truncated)" hint when this is set,
   * so the user knows they're seeing a condensed view rather than the
   * full draft.
   */
  preDraftTruncated?: boolean;
};

/**
 * Upper bound on the `preDraft` we embed in the audit. The client's
 * `openCouncilStream` holds a 4 KiB tail-reserve window to detect the
 * trailing JSON frame; if the trailer exceeds that window, it gets
 * partially pumped to the consumer before the stream closes and the
 * peeler misses it. A conversational Council reply is typically a few
 * hundred bytes, but a long Plan draft can run 2-3 KiB — on top of
 * the JSON structural overhead + proposals + chips + the review
 * itself, that can push the trailer past the window. Capping here
 * keeps the trailer comfortably inside the peel window regardless of
 * draft length.
 *
 * 1500 chars ≈ 250-300 words — enough for the reveal to show the
 * context of what the Council actually drafted without dragging in
 * every word. If the user wants the full version, they can scroll the
 * displayed reply; the reveal is a transparency aid, not a verbatim
 * transcript.
 */
export const CRITIC_AUDIT_DRAFT_CAP = 1500;

/**
 * Build the `criticAudit` trailer fragment from a run-turn `done`
 * result. Returns `null` when the Critic did not run or produced no
 * review text — in either case there is nothing to reveal.
 */
export function buildCriticAudit(
  done: { preCriticText: string; critic: CriticResult },
): CriticAudit | null {
  if (!done.critic.ran) return null;
  const review = done.critic.review;
  if (!review) return null;

  const raw = done.preCriticText ?? '';
  const truncated = raw.length > CRITIC_AUDIT_DRAFT_CAP;
  const preDraft = truncated
    ? raw.slice(0, CRITIC_AUDIT_DRAFT_CAP).trimEnd() + '…'
    : raw;

  const audit: CriticAudit = {
    risk: done.critic.risk,
    review,
    preDraft,
  };
  if (truncated) audit.preDraftTruncated = true;
  return audit;
}
