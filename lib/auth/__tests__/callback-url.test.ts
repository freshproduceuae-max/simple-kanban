import { describe, it, expect } from 'vitest';
import { buildEmailRedirectTo } from '../callback-url';

const ORIGIN = 'https://plan.example.com';

describe('buildEmailRedirectTo (F03 — magic-link round-trip)', () => {
  it('returns the bare callback when next is missing or the default', () => {
    expect(buildEmailRedirectTo(ORIGIN, null)).toBe(`${ORIGIN}/auth/callback`);
    expect(buildEmailRedirectTo(ORIGIN, undefined)).toBe(`${ORIGIN}/auth/callback`);
    expect(buildEmailRedirectTo(ORIGIN, '')).toBe(`${ORIGIN}/auth/callback`);
    expect(buildEmailRedirectTo(ORIGIN, '/')).toBe(`${ORIGIN}/auth/callback`);
  });

  it('preserves a sanitized same-origin next', () => {
    expect(buildEmailRedirectTo(ORIGIN, '/history')).toBe(
      `${ORIGIN}/auth/callback?next=%2Fhistory`,
    );
    expect(buildEmailRedirectTo(ORIGIN, '/settings/council')).toBe(
      `${ORIGIN}/auth/callback?next=%2Fsettings%2Fcouncil`,
    );
  });

  it('strips open-redirect payloads before they reach the mail body', () => {
    // safeNext applies — anything unsafe collapses to `/`, and we then
    // emit the bare callback (no `next=`) rather than a poisoned link.
    expect(buildEmailRedirectTo(ORIGIN, '//evil.com')).toBe(`${ORIGIN}/auth/callback`);
    expect(buildEmailRedirectTo(ORIGIN, 'https://evil.com')).toBe(
      `${ORIGIN}/auth/callback`,
    );
    expect(buildEmailRedirectTo(ORIGIN, 'javascript:alert(1)')).toBe(
      `${ORIGIN}/auth/callback`,
    );
    expect(buildEmailRedirectTo(ORIGIN, '/\\evil.com')).toBe(`${ORIGIN}/auth/callback`);
  });

  it('URL-encodes query + fragment characters in next', () => {
    expect(buildEmailRedirectTo(ORIGIN, '/search?q=one two&tag=a%2Fb')).toBe(
      `${ORIGIN}/auth/callback?next=%2Fsearch%3Fq%3Done+two%26tag%3Da%252Fb`,
    );
  });
});
