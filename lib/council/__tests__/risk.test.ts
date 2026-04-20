import { describe, it, expect } from 'vitest';
import { shouldDispatchCritic, readConfiguredThreshold } from '../shared/risk';
import { budgetOutcome, readDailyCap, SESSION_BUDGETS } from '../shared/token-budget';

describe('council shared helpers', () => {
  it('dispatches Critic only at/above threshold', () => {
    expect(shouldDispatchCritic('low', 'medium')).toBe(false);
    expect(shouldDispatchCritic('medium', 'medium')).toBe(true);
    expect(shouldDispatchCritic('high', 'medium')).toBe(true);
  });

  it('defaults threshold to medium when env missing', () => {
    const original = process.env.COUNCIL_CRITIC_RISK_THRESHOLD;
    delete process.env.COUNCIL_CRITIC_RISK_THRESHOLD;
    try {
      expect(readConfiguredThreshold()).toBe('medium');
    } finally {
      if (original !== undefined) process.env.COUNCIL_CRITIC_RISK_THRESHOLD = original;
    }
  });

  it('budget outcome warns at 80% and cuts at 100%', () => {
    expect(budgetOutcome(0, 10_000)).toBe('ok');
    expect(budgetOutcome(8_000, 10_000)).toBe('warn');
    expect(budgetOutcome(10_000, 10_000)).toBe('cut');
  });

  it('session budgets match vision soft ceilings', () => {
    expect(SESSION_BUDGETS.greeting).toBe(5_000);
    expect(SESSION_BUDGETS.plan).toBe(40_000);
    expect(SESSION_BUDGETS.chat).toBe(10_000);
  });

  it('daily cap defaults to 500k', () => {
    const original = process.env.COUNCIL_TOKEN_CAP_DAILY;
    delete process.env.COUNCIL_TOKEN_CAP_DAILY;
    try {
      expect(readDailyCap()).toBe(500_000);
    } finally {
      if (original !== undefined) process.env.COUNCIL_TOKEN_CAP_DAILY = original;
    }
  });
});
