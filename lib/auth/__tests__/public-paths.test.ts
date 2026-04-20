import { describe, it, expect } from 'vitest';
import { isPublicPath } from '../public-paths';

describe('isPublicPath (F03 route-gating)', () => {
  it('allows the sign-in + auth-callback routes', () => {
    expect(isPublicPath('/sign-in')).toBe(true);
    expect(isPublicPath('/auth/callback')).toBe(true);
  });

  it('allows Next.js internals and favicon', () => {
    expect(isPublicPath('/_next/static/chunk.js')).toBe(true);
    expect(isPublicPath('/_next/image')).toBe(true);
    expect(isPublicPath('/favicon.ico')).toBe(true);
  });

  it('blocks every v0.4 app surface without a session', () => {
    for (const path of [
      '/',
      '/history',
      '/settings',
      '/settings/council',
      '/admin/metrics',
      '/api/council/chat',
      '/api/council/proposals',
      '/api/council/proposals/abc/approve',
    ]) {
      expect(isPublicPath(path), `${path} must require auth`).toBe(false);
    }
  });

  it('rejects paths that merely look like /sign-in but aren\'t', () => {
    // Exact-match only; no prefix smuggling.
    expect(isPublicPath('/sign-in-evil')).toBe(false);
    expect(isPublicPath('/sign-in/foo')).toBe(false);
    expect(isPublicPath('/auth/callback/foo')).toBe(false);
  });
});
