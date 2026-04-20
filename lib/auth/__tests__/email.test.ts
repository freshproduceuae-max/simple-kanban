import { describe, it, expect } from 'vitest';
import { normalizeEmail } from '../email';

describe('normalizeEmail (F03 sign-in validation)', () => {
  it('accepts a plain address and lowercases + trims', () => {
    expect(normalizeEmail('  Alice@Example.com ')).toEqual({
      ok: true,
      email: 'alice@example.com',
    });
  });

  it('accepts plus-aliases and subdomains', () => {
    expect(normalizeEmail('alice+tag@mail.example.co.uk')).toEqual({
      ok: true,
      email: 'alice+tag@mail.example.co.uk',
    });
  });

  it('rejects missing / non-string input', () => {
    expect(normalizeEmail(null).ok).toBe(false);
    expect(normalizeEmail(undefined).ok).toBe(false);
    expect(normalizeEmail(42).ok).toBe(false);
    expect(normalizeEmail('').ok).toBe(false);
    expect(normalizeEmail('   ').ok).toBe(false);
  });

  it('rejects shapes that are obviously not emails', () => {
    expect(normalizeEmail('notanemail').ok).toBe(false);
    expect(normalizeEmail('missing@tld').ok).toBe(false);
    expect(normalizeEmail('two@@at.com').ok).toBe(false);
    expect(normalizeEmail('spa ces@example.com').ok).toBe(false);
  });
});
