import type { RiskLevel } from '@/lib/persistence/types';
import type { SessionRepository } from '@/lib/persistence/session-repository';
import { COUNCIL_MODEL, getAnthropicClient, type AnthropicLike } from '../shared/client';
import {
  classifyDraftRisk,
  readConfiguredThreshold,
  shouldDispatchCritic,
} from '../shared/risk';

/**
 * F11 — Critic agent.
 *
 * Reviews Consolidator drafts post-hoc for commitments the user might
 * act on. Risk-threshold dispatched: heuristic tags every draft, but we
 * only spend a real Anthropic call when risk >= threshold (default
 * 'medium', overridable via COUNCIL_CRITIC_RISK_THRESHOLD).
 *
 * Fail-quiet: if the Critic errors, the user sees nothing different —
 * we call the injected errorHook (which F20 will wire to the Resend
 * pipeline) and return a no-review result. The transparency layer
 * simply omits the review block for that turn.
 *
 * Persists a critic turn via SessionRepository when a review is
 * produced. Write failures are swallowed so the user-facing path
 * (which is already done streaming by the time we're here) is never
 * blocked.
 */

export type CriticInput = {
  userId: string;
  sessionId: string;
  /** Consolidator's final reply text (the stream text joined). */
  draft: string;
  /** Optional threshold override. Defaults to env / 'medium'. */
  threshold?: RiskLevel;
};

export type CriticResult = {
  /** True when risk >= threshold and the Anthropic review succeeded. */
  ran: boolean;
  /** Heuristic-tagged risk of the draft. Always populated. */
  risk: RiskLevel;
  /** Critic review text. Null when ran=false or on failure. */
  review: string | null;
  tokensIn: number;
  tokensOut: number;
};

export type CriticDeps = {
  client?: AnthropicLike;
  sessionRepo: SessionRepository;
  /** Optional fail-quiet error hook. F20 wires this to Resend. */
  errorHook?: (info: {
    failureClass: 'anthropic_error' | 'anthropic_429' | 'unknown';
    message: string;
    cause?: unknown;
  }) => void;
  /** Optional logger (defaults to console.error). */
  log?: (msg: string, err: unknown) => void;
};

const CRITIC_SYSTEM_PROMPT = [
  'You are the Council\'s Critic, backstage.',
  'Review the draft below for commitments the user might act on, factual overreach,',
  'or risky advice. Be brief — one short paragraph, no headings, no emoji.',
  'If the draft is fine, say so plainly. If not, name the specific concern and what',
  'could be toned down. Never refer to yourself as "the critic" or rewrite the draft.',
].join(' ');

/**
 * Maps a rejected Anthropic call into a best-effort failureClass tag.
 * Very lightweight — F20 will upgrade with its own classifier.
 */
function classifyError(err: unknown): 'anthropic_429' | 'anthropic_error' | 'unknown' {
  const message = err instanceof Error ? err.message : String(err);
  if (/429|rate/i.test(message)) return 'anthropic_429';
  if (/anthropic|claude|overloaded|\b5\d\d\b/i.test(message)) return 'anthropic_error';
  return 'unknown';
}

/** Pull plain text out of an Anthropic non-streaming response. */
function extractText(response: {
  content: Array<{ type: string; text?: string }>;
}): string {
  return response.content
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text as string)
    .join('')
    .trim();
}

export async function critique(
  input: CriticInput,
  deps: CriticDeps
): Promise<CriticResult> {
  const threshold = input.threshold ?? readConfiguredThreshold();
  const risk = classifyDraftRisk(input.draft);

  // Below threshold: fast path. No Anthropic call, no log row.
  if (!shouldDispatchCritic(risk, threshold)) {
    return { ran: false, risk, review: null, tokensIn: 0, tokensOut: 0 };
  }

  const client = deps.client ?? getAnthropicClient();
  const log = deps.log ?? ((msg, err) => console.error(msg, err));

  try {
    const response = await client.messages.create({
      model: COUNCIL_MODEL,
      max_tokens: 512,
      system: CRITIC_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Draft to review:\n${input.draft}` }],
    });

    const review = extractText(response);
    const tokensIn = response.usage?.input_tokens ?? 0;
    const tokensOut = response.usage?.output_tokens ?? 0;

    // Persist the critic turn. Swallow write failures: by this point
    // the user has already seen their reply — there's nothing to block.
    try {
      await deps.sessionRepo.appendTurn({
        session_id: input.sessionId,
        user_id: input.userId,
        agent: 'critic',
        role: 'assistant',
        content: review,
        tool_calls: null,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
      });
    } catch (writeErr) {
      log('critic: turn write failed', writeErr);
    }

    return { ran: true, risk, review, tokensIn, tokensOut };
  } catch (err) {
    // Fail-quiet: no UI impact, but a loud server alert.
    const failureClass = classifyError(err);
    const message = err instanceof Error ? err.message : String(err);
    log('critic: dispatch failed (fail-quiet)', err);
    deps.errorHook?.({ failureClass, message, cause: err });
    return { ran: false, risk, review: null, tokensIn: 0, tokensOut: 0 };
  }
}

// Re-exports so callers can import everything from the critic module.
export { classifyDraftRisk, readConfiguredThreshold, shouldDispatchCritic };
