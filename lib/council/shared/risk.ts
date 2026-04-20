import type { RiskLevel } from '../../persistence/types';

/**
 * Risk-tagging helpers. F11 fills in the real classifier; this stub
 * returns `low` so Critic dispatch can be wired end-to-end at scaffold time.
 */
export function classifyDraftRisk(_draft: string): RiskLevel {
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
