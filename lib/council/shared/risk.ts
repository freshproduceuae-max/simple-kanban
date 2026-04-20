import type { RiskLevel } from '../../persistence/types';

/**
 * Risk-tagging helpers. The Critic (F11) uses these to decide whether
 * to dispatch a full Anthropic review pass or let the draft pass
 * through unreviewed. Heuristic-only, no SDK call — classification is
 * on the hot path of every Consolidator draft and must stay cheap.
 *
 * Per PRD §9.2:
 *   - low    → stylistic / ordinary chat
 *   - medium → definitive claims, commitments, factual assertions
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

export function classifyDraftRisk(draft: string): RiskLevel {
  if (!draft || !draft.trim()) return 'low';
  if (HIGH_RISK_PATTERNS.some((re) => re.test(draft))) return 'high';
  if (MEDIUM_RISK_PATTERNS.some((re) => re.test(draft))) return 'medium';
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
