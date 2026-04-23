import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const getUser = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: () => ({
    auth: {
      getUser: (...a: unknown[]) => getUser(...a),
    },
  }),
}));

import { getAuthedAdmin, isAdminEmail } from '../admin';

describe('isAdminEmail (F26)', () => {
  const originalEnv = process.env.ADMIN_EMAIL;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.ADMIN_EMAIL;
    } else {
      process.env.ADMIN_EMAIL = originalEnv;
    }
  });

  it('is false when ADMIN_EMAIL is unset', () => {
    delete process.env.ADMIN_EMAIL;
    expect(isAdminEmail('a@b.com')).toBe(false);
  });

  it('is false when ADMIN_EMAIL is empty', () => {
    process.env.ADMIN_EMAIL = '';
    expect(isAdminEmail('a@b.com')).toBe(false);
  });

  it('matches a single configured address', () => {
    process.env.ADMIN_EMAIL = 'cd@example.com';
    expect(isAdminEmail('cd@example.com')).toBe(true);
    expect(isAdminEmail('someone-else@example.com')).toBe(false);
  });

  it('matches case-insensitively and trims whitespace', () => {
    process.env.ADMIN_EMAIL = '  CD@Example.com ';
    expect(isAdminEmail('cd@example.com')).toBe(true);
    expect(isAdminEmail('CD@EXAMPLE.COM')).toBe(true);
    expect(isAdminEmail('  cd@example.com  ')).toBe(true);
  });

  it('accepts a comma-separated list', () => {
    process.env.ADMIN_EMAIL = 'a@x.com, b@x.com ,c@x.com';
    expect(isAdminEmail('a@x.com')).toBe(true);
    expect(isAdminEmail('b@x.com')).toBe(true);
    expect(isAdminEmail('c@x.com')).toBe(true);
    expect(isAdminEmail('d@x.com')).toBe(false);
  });

  it('is false for null / undefined / empty input', () => {
    process.env.ADMIN_EMAIL = 'cd@example.com';
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
    expect(isAdminEmail('')).toBe(false);
  });
});

describe('getAuthedAdmin (F26)', () => {
  const originalEnv = process.env.ADMIN_EMAIL;

  beforeEach(() => {
    getUser.mockReset();
    process.env.ADMIN_EMAIL = 'cd@example.com';
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.ADMIN_EMAIL;
    } else {
      process.env.ADMIN_EMAIL = originalEnv;
    }
  });

  it('throws "not-authenticated" when Supabase returns no user', async () => {
    getUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'no session' },
    });
    await expect(getAuthedAdmin()).rejects.toThrow('not-authenticated');
  });

  it('throws "not-authenticated" when getUser errors', async () => {
    getUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'boom' },
    });
    await expect(getAuthedAdmin()).rejects.toThrow('not-authenticated');
  });

  it('throws "not-admin" when the user has no email on record', async () => {
    getUser.mockResolvedValueOnce({
      data: { user: { id: 'u1', email: null } },
      error: null,
    });
    await expect(getAuthedAdmin()).rejects.toThrow('not-admin');
  });

  it('throws "not-admin" when the email does not match ADMIN_EMAIL', async () => {
    getUser.mockResolvedValueOnce({
      data: { user: { id: 'u1', email: 'someone-else@example.com' } },
      error: null,
    });
    await expect(getAuthedAdmin()).rejects.toThrow('not-admin');
  });

  it('throws "not-admin" when ADMIN_EMAIL is unset', async () => {
    delete process.env.ADMIN_EMAIL;
    getUser.mockResolvedValueOnce({
      data: { user: { id: 'u1', email: 'cd@example.com' } },
      error: null,
    });
    await expect(getAuthedAdmin()).rejects.toThrow('not-admin');
  });

  it('returns { userId, email } on a clean match', async () => {
    getUser.mockResolvedValueOnce({
      data: { user: { id: 'u1', email: 'cd@example.com' } },
      error: null,
    });
    const got = await getAuthedAdmin();
    expect(got).toEqual({ userId: 'u1', email: 'cd@example.com' });
  });

  it('matches case-insensitively', async () => {
    process.env.ADMIN_EMAIL = 'CD@Example.com';
    getUser.mockResolvedValueOnce({
      data: { user: { id: 'u1', email: 'cd@example.com' } },
      error: null,
    });
    const got = await getAuthedAdmin();
    expect(got.userId).toBe('u1');
  });
});
