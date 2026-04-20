import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the Supabase server client so we can script its responses
// without a real Supabase project. Hoisted above the route import.
const exchangeCodeForSession = vi.fn();
const getUser = vi.fn();
const signOut = vi.fn(async () => ({ error: null }));

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: () => ({
    auth: {
      exchangeCodeForSession: (...args: unknown[]) => exchangeCodeForSession(...args),
      getUser: () => getUser(),
      signOut: () => signOut(),
    },
  }),
}));

import { GET } from '../route';

function req(url: string): NextRequest {
  return new NextRequest(new URL(url));
}

describe('/auth/callback (F03 exchange + F04 allowlist)', () => {
  const originalAllowlist = process.env.COUNCIL_BETA_ALLOWLIST;

  beforeEach(() => {
    exchangeCodeForSession.mockReset();
    getUser.mockReset();
    signOut.mockClear();
    // Happy-path defaults; individual tests override.
    exchangeCodeForSession.mockResolvedValue({ error: null });
    getUser.mockResolvedValue({ data: { user: { email: 'ok@example.com' } } });
    process.env.COUNCIL_BETA_ALLOWLIST = 'ok@example.com';
  });

  afterEach(() => {
    if (originalAllowlist !== undefined) {
      process.env.COUNCIL_BETA_ALLOWLIST = originalAllowlist;
    } else {
      delete process.env.COUNCIL_BETA_ALLOWLIST;
    }
  });

  it('redirects to /sign-in?error=missing_code when no ?code=', async () => {
    const res = await GET(req('https://plan.example.com/auth/callback'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(
      'https://plan.example.com/sign-in?error=missing_code',
    );
    // Exchange never happens.
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('redirects to /sign-in with the provider error when exchange fails', async () => {
    exchangeCodeForSession.mockResolvedValueOnce({
      error: { message: 'Email rate limit exceeded' },
    });
    const res = await GET(req('https://plan.example.com/auth/callback?code=abc'));
    expect(res.headers.get('location')).toBe(
      'https://plan.example.com/sign-in?error=Email%20rate%20limit%20exceeded',
    );
    expect(signOut).not.toHaveBeenCalled();
  });

  it('F04: rejects emails not on COUNCIL_BETA_ALLOWLIST and tears the session down', async () => {
    getUser.mockResolvedValueOnce({ data: { user: { email: 'stranger@example.com' } } });
    const res = await GET(req('https://plan.example.com/auth/callback?code=abc'));
    expect(res.headers.get('location')).toBe(
      'https://plan.example.com/sign-in?error=not_on_allowlist',
    );
    // Session must be cleared — otherwise the cookie survives the redirect.
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('F04: rejects when the allowlist env is unset (deny-by-default)', async () => {
    delete process.env.COUNCIL_BETA_ALLOWLIST;
    const res = await GET(req('https://plan.example.com/auth/callback?code=abc'));
    expect(res.headers.get('location')).toBe(
      'https://plan.example.com/sign-in?error=not_on_allowlist',
    );
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('redirects to / (default next) when the email is on the allowlist', async () => {
    const res = await GET(req('https://plan.example.com/auth/callback?code=abc'));
    expect(res.headers.get('location')).toBe('https://plan.example.com/');
    expect(signOut).not.toHaveBeenCalled();
  });

  it('honors a sanitized ?next= on successful sign-in', async () => {
    const res = await GET(
      req('https://plan.example.com/auth/callback?code=abc&next=%2Fhistory'),
    );
    expect(res.headers.get('location')).toBe('https://plan.example.com/history');
  });

  it('strips open-redirect payloads from ?next=', async () => {
    const res = await GET(
      req('https://plan.example.com/auth/callback?code=abc&next=%2F%2Fevil.com'),
    );
    expect(res.headers.get('location')).toBe('https://plan.example.com/');
  });
});
