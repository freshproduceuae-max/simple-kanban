import { describe, it, expect, vi, beforeEach } from 'vitest';

const getUser = vi.fn();
const getSession = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: () => ({
    auth: {
      getUser: (...a: unknown[]) => getUser(...a),
      getSession: (...a: unknown[]) => getSession(...a),
    },
  }),
}));

import { getAuthedIdentity } from '../current-user';

/**
 * Builds a fake JWT access token with the given payload object. Only
 * the middle (payload) segment needs to decode cleanly — the header
 * and signature are opaque to us.
 */
function fakeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.sig`;
}

describe('getAuthedIdentity', () => {
  beforeEach(() => {
    getUser.mockReset();
    getSession.mockReset();
  });

  it('throws when getUser rejects or returns no user', async () => {
    getUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'no' },
    });
    await expect(getAuthedIdentity()).rejects.toThrow(/not-authenticated/);
  });

  it('returns the JWT session_id claim as the auth fingerprint', async () => {
    // This is the round-4 fix: the fingerprint must be per-session,
    // not per-user. `session_id` is stable across token refreshes and
    // different for each concurrent sign-in on the account.
    getUser.mockResolvedValueOnce({
      data: { user: { id: 'u1', last_sign_in_at: '2026-04-22T00:00:00Z' } },
      error: null,
    });
    getSession.mockResolvedValueOnce({
      data: {
        session: {
          access_token: fakeJwt({ sub: 'u1', session_id: 'sess-abc-123' }),
        },
      },
      error: null,
    });
    const got = await getAuthedIdentity();
    expect(got).toEqual({ userId: 'u1', authSessionId: 'sess-abc-123' });
  });

  it('does not move the fingerprint when last_sign_in_at changes but session_id is stable', async () => {
    // Regression for the Codex round-4 finding: signing in on a
    // second device bumps `last_sign_in_at` for the account, but the
    // first device's JWT still carries the original `session_id`.
    // The resolver must treat device A's session as still live.
    getUser.mockResolvedValueOnce({
      data: {
        user: { id: 'u1', last_sign_in_at: '2026-04-22T10:00:00Z' },
      },
      error: null,
    });
    getSession.mockResolvedValueOnce({
      data: {
        session: { access_token: fakeJwt({ session_id: 'sess-deviceA' }) },
      },
      error: null,
    });
    const a = await getAuthedIdentity();

    // Simulate device B signing in: `last_sign_in_at` bumps on the
    // user record, but device A's cookie still holds device A's JWT.
    getUser.mockResolvedValueOnce({
      data: {
        user: { id: 'u1', last_sign_in_at: '2026-04-22T11:00:00Z' },
      },
      error: null,
    });
    getSession.mockResolvedValueOnce({
      data: {
        session: { access_token: fakeJwt({ session_id: 'sess-deviceA' }) },
      },
      error: null,
    });
    const aAfterDeviceB = await getAuthedIdentity();

    expect(aAfterDeviceB.authSessionId).toBe(a.authSessionId);
  });

  it('falls back to userId when the JWT has no session_id claim', async () => {
    getUser.mockResolvedValueOnce({
      data: { user: { id: 'u1' } },
      error: null,
    });
    getSession.mockResolvedValueOnce({
      data: { session: { access_token: fakeJwt({ sub: 'u1' }) } },
      error: null,
    });
    const got = await getAuthedIdentity();
    expect(got).toEqual({ userId: 'u1', authSessionId: 'u1' });
  });

  it('falls back to userId when there is no session on the cookie', async () => {
    getUser.mockResolvedValueOnce({
      data: { user: { id: 'u1' } },
      error: null,
    });
    getSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });
    const got = await getAuthedIdentity();
    expect(got.authSessionId).toBe('u1');
  });

  it('falls back to userId when the access token is malformed', async () => {
    getUser.mockResolvedValueOnce({
      data: { user: { id: 'u1' } },
      error: null,
    });
    getSession.mockResolvedValueOnce({
      data: { session: { access_token: 'not-a-jwt' } },
      error: null,
    });
    const got = await getAuthedIdentity();
    expect(got.authSessionId).toBe('u1');
  });
});
