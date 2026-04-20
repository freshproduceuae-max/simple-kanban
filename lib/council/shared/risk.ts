import type { RiskLevel } from '../../persistence/types';

/**
 * Risk-tagging helpers. The Critic (F11) uses these to decide whether
 * to dispatch a full Anthropic review pass or let the draft pass
 * through unreviewed. Heuristic-only, no SDK call — classification is
 * on the hot path of every Consolidator draft and must stay cheap.
 *
 * Per PRD §9.2 the risk tagger must account for:
 *   - low    → stylistic / ordinary chat
 *   - medium → definitive claims, commitments, factual assertions, OR
 *              drafts longer than ~200 tokens (even without magic
 *              words — length alone is a surface-area signal)
 *   - high   → irreversible actions, destructive language, strong
 *              commitments the user may act on
 */

const HIGH_RISK_PATTERNS: RegExp[] = [
  /\b(delete|remove|drop|wipe|purge|destroy|erase)\b/i,
  /\b(cancel|terminate|shut down|shutdown)\b/i,
  /\b(will do|i'll ship|shipping (tonight|today|now)|committing to)\b/i,
  /\b(guarantee|guaranteed|definitely will|certain(ly)?)\b/i,
  /\b(never|always) (do|ship|work|fail)/i,
];

const MEDIUM_RISK_PATTERNS: RegExp[] = [
  /\b(should|must|need to|have to|ought to)\b/i,
  /\b(recommend|suggest strongly|advise)\b/i,
  /\b\d{1,2}[:/.]\d{1,2}([:/.]\d{2,4})?\b/, // dates / times
  /\$\d/, // dollar amounts
  /\b\d+%/, // percentages
  /\b(first|second|third|next step|step \d)\b/i,
];

/**
 * Anthropic's rule-of-thumb is ~4 characters per English token. We use
 * that as a cheap local estimate so the heuristic stays SDK-free — the
 * Critic dispatcher then pays for real tokens only when the estimate
 * crosses threshold.
 */
export const CHARS_PER_TOKEN_ESTIMATE = 4;

/** PRD §9.2 explicit escalation floor: drafts above this go to medium. */
export const LONG_DRAFT_TOKEN_THRESHOLD = 200;

export function estimateTokenCount(draft: string): number {
  if (!draft) return 0;
  return Math.ceil(draft.length / CHARS_PER_TOKEN_ESTIMATE);
}

export function classifyDraftRisk(draft: string): RiskLevel {
  if (!draft || !draft.trim()) return 'low';
  if (HIGH_RISK_PATTERNS.some((re) => re.test(draft))) return 'high';
  if (MEDIUM_RISK_PATTERNS.some((re) => re.test(draft))) return 'medium';
  // Length-based escalation (PRD §9.2): a long draft has enough
  // surface area for a claim to slip through even without trigger
  // words, so the Critic should review it.
  if (estimateTokenCount(draft) > LONG_DRAFT_TOKEN_THRESHOLD) return 'medium';
  return 'low';
}

export function shouldDispatchCritic(risk: RiskLevel, threshold: RiskLevel): boolean {
  const order: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };
  return order[risk] >= order[threshold];
}

export function readConfiguredThreshold(): RiskLevel {
  const raw = process.env.COUNCIL_CRITIC_RISK_THRESHOLD;
  if (raw === 'low' || raw === 'medium' || raw === 'high') return raw;
  return 'medium';
}
