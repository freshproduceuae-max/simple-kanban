/**
 * F17 — Plan-handoff phrase detector.
 *
 * Advise is a read-only mode: it never drafts proposal rows. When the
 * user signals they want to move from "let's look at this" to "let's
 * turn it into tasks," the Advise route surfaces a `{handoff: 'plan'}`
 * trailer frame and the client re-POSTs the same input to
 * /api/council/plan (CD pick #3 — client re-POST).
 *
 * We use the same phrase-match shape as `web-request.ts` so both
 * detectors feel consistent and tunable per environment.
 */

export const DEFAULT_PLAN_HANDOFF_PHRASES: readonly string[] = [
  'draft this',
  'draft these',
  'plan this',
  'plan these',
  'turn this into tasks',
  'turn these into tasks',
  'make tasks',
  'create tasks',
  'start planning',
  'kick off the plan',
  "let's plan",
  "let's draft",
];

function loadPhrases(): readonly string[] {
  const raw = process.env.COUNCIL_PLAN_HANDOFF_PHRASES;
  if (!raw) return DEFAULT_PLAN_HANDOFF_PHRASES;
  const parts = raw
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  return parts.length > 0 ? parts : DEFAULT_PLAN_HANDOFF_PHRASES;
}

export function userRequestedPlanHandoff(userInput: string): boolean {
  if (typeof userInput !== 'string' || userInput.length === 0) return false;
  const text = userInput.toLowerCase();
  return loadPhrases().some((phrase) => text.includes(phrase));
}
