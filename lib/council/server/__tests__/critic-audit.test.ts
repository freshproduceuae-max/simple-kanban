import { describe, expect, it } from 'vitest';
import {
  buildCriticAudit,
  CRITIC_AUDIT_DRAFT_CAP,
} from '@/lib/council/server/critic-audit';

/**
 * F23 — `buildCriticAudit` is the single decision point for whether
 * a turn gets a reveal fragment. It must emit only when the Critic
 * actually produced something worth showing.
 */

describe('buildCriticAudit', () => {
  it('returns null when the Critic did not run', () => {
    const out = buildCriticAudit({
      preCriticText: 'hello',
      critic: { ran: false, risk: 'low', review: null, tokensIn: 0, tokensOut: 0 },
    });
    expect(out).toBeNull();
  });

  it('returns null when the Critic ran but returned an empty review', () => {
    // Guards against an Anthropic response that drops the content array.
    // The audit panel cannot render a zero-state well.
    const out = buildCriticAudit({
      preCriticText: 'hello',
      critic: { ran: true, risk: 'medium', review: '', tokensIn: 0, tokensOut: 0 },
    });
    expect(out).toBeNull();
  });

  it('returns the audit object when the Critic produced a review', () => {
    const out = buildCriticAudit({
      preCriticText: 'ship it thursday.',
      critic: {
        ran: true,
        risk: 'medium',
        review: 'The draft commits without a buffer.',
        tokensIn: 120,
        tokensOut: 40,
      },
    });
    expect(out).toEqual({
      risk: 'medium',
      review: 'The draft commits without a buffer.',
      preDraft: 'ship it thursday.',
    });
  });

  it('truncates preDraft beyond the cap and flags preDraftTruncated', () => {
    // Must keep the trailer inside the client's 4 KiB tail-reserve
    // window; a long Plan draft would otherwise escape the peel and
    // leak JSON into display text.
    const long = 'a'.repeat(CRITIC_AUDIT_DRAFT_CAP + 500);
    const out = buildCriticAudit({
      preCriticText: long,
      critic: {
        ran: true,
        risk: 'low',
        review: 'fine.',
        tokensIn: 0,
        tokensOut: 0,
      },
    });
    expect(out).not.toBeNull();
    expect(out!.preDraftTruncated).toBe(true);
    expect(out!.preDraft.length).toBeLessThanOrEqual(
      CRITIC_AUDIT_DRAFT_CAP + 1,
    );
    expect(out!.preDraft.endsWith('…')).toBe(true);
  });

  it('does not set preDraftTruncated when preDraft fits under the cap', () => {
    const out = buildCriticAudit({
      preCriticText: 'short.',
      critic: {
        ran: true,
        risk: 'low',
        review: 'fine.',
        tokensIn: 0,
        tokensOut: 0,
      },
    });
    expect(out!.preDraftTruncated).toBeUndefined();
  });
});
