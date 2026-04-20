import { describe, it, expect } from 'vitest';
import { signInErrorMessage } from '../sign-in-error';

describe('signInErrorMessage (F04 — rejection copy)', () => {
  it('returns null when no error is set', () => {
    expect(signInErrorMessage(null)).toBeNull();
    expect(signInErrorMessage(undefined)).toBeNull();
    expect(signInErrorMessage('')).toBeNull();
  });

  it('translates not_on_allowlist into a calm, honest sentence', () => {
    const msg = signInErrorMessage('not_on_allowlist');
    expect(msg).not.toBeNull();
    // Calm, first-person, no emoji, no blame — per design-system voice.
    expect(msg).toContain('beta list');
    expect(msg).toMatch(/reply to the invite/i);
    // No emoji: every character in the message must be plain ASCII (voice rule).
    const str = msg ?? '';
    let allAscii = true;
    for (let i = 0; i < str.length; i++) {
      if (str.charCodeAt(i) >= 128) {
        allAscii = false;
        break;
      }
    }
    expect(allAscii).toBe(true);
  });

  it('translates missing_code helpfully', () => {
    const msg = signInErrorMessage('missing_code');
    expect(msg).toMatch(/sign-in link/i);
    expect(msg).toMatch(/request a new one/i);
  });

  it('passes through unknown / provider-native error text unchanged', () => {
    // Supabase messages are already written for end users; don't swallow.
    expect(signInErrorMessage('Email rate limit exceeded')).toBe(
      'Email rate limit exceeded',
    );
    expect(signInErrorMessage('Invalid login credentials')).toBe(
      'Invalid login credentials',
    );
  });
});
