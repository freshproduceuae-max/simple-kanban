import { describe, it, expect, afterEach } from 'vitest';
import { userRequestedPlanHandoff } from '../handoff-request';

const originalEnv = process.env.COUNCIL_PLAN_HANDOFF_PHRASES;

describe('userRequestedPlanHandoff', () => {
  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.COUNCIL_PLAN_HANDOFF_PHRASES;
    } else {
      process.env.COUNCIL_PLAN_HANDOFF_PHRASES = originalEnv;
    }
  });

  it('returns true for core default phrases (case-insensitive)', () => {
    expect(userRequestedPlanHandoff('please draft this for me')).toBe(true);
    expect(userRequestedPlanHandoff('Turn This Into Tasks')).toBe(true);
    expect(userRequestedPlanHandoff('Create tasks from the board')).toBe(true);
    expect(userRequestedPlanHandoff("let's plan the rollout")).toBe(true);
  });

  it('returns false when no handoff phrase is present', () => {
    expect(userRequestedPlanHandoff('what do you think of this?')).toBe(false);
    expect(userRequestedPlanHandoff('should I ship tonight?')).toBe(false);
  });

  it('returns false for empty or non-string input', () => {
    expect(userRequestedPlanHandoff('')).toBe(false);
    // @ts-expect-error — explicit non-string for guard coverage
    expect(userRequestedPlanHandoff(null)).toBe(false);
  });

  it('honors COUNCIL_PLAN_HANDOFF_PHRASES env override', () => {
    process.env.COUNCIL_PLAN_HANDOFF_PHRASES = 'flip it,spin up';
    expect(userRequestedPlanHandoff('go ahead and flip it')).toBe(true);
    expect(userRequestedPlanHandoff('draft this')).toBe(false);
  });

  it('falls back to defaults when the env override is empty/whitespace', () => {
    process.env.COUNCIL_PLAN_HANDOFF_PHRASES = '   ,  ';
    expect(userRequestedPlanHandoff('draft this please')).toBe(true);
  });
});
