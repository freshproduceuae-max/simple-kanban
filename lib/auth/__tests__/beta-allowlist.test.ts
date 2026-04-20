import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isAllowed, readAllowlist } from '../beta-allowlist';

describe('beta allowlist', () => {
  const original = process.env.COUNCIL_BETA_ALLOWLIST;
  beforeEach(() => {
    delete process.env.COUNCIL_BETA_ALLOWLIST;
  });
  afterEach(() => {
    if (original !== undefined) process.env.COUNCIL_BETA_ALLOWLIST = original;
    else delete process.env.COUNCIL_BETA_ALLOWLIST;
  });

  it('rejects everyone when env is unset', () => {
    expect(isAllowed('a@example.com')).toBe(false);
    expect(readAllowlist()).toEqual([]);
  });

  it('accepts listed emails (case-insensitive, trimmed)', () => {
    process.env.COUNCIL_BETA_ALLOWLIST = '  A@Example.com, b@example.com  ';
    expect(isAllowed('a@example.com')).toBe(true);
    expect(isAllowed('B@EXAMPLE.COM')).toBe(true);
    expect(isAllowed('c@example.com')).toBe(false);
  });

  it('handles null/undefined email', () => {
    process.env.COUNCIL_BETA_ALLOWLIST = 'a@example.com';
    expect(isAllowed(null)).toBe(false);
    expect(isAllowed(undefined)).toBe(false);
  });
});
