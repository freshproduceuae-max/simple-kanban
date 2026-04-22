import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CouncilSessionRow } from '@/lib/persistence/types';

const getAuthedIdentity = vi.fn();
const endSessionsForAuthSession = vi.fn();
const writeSummary = vi.fn();
const supabaseSignOut = vi.fn(async () => ({}));
const redirectMock = vi.fn((_to: string) => {
  throw new Error(`NEXT_REDIRECT:${_to}`);
});

vi.mock('next/navigation', () => ({
  redirect: (to: string) => redirectMock(to),
}));
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: () => ({ auth: { signOut: supabaseSignOut } }),
}));
vi.mock('@/lib/auth/current-user', () => ({
  getAuthedIdentity: () => getAuthedIdentity(),
}));
vi.mock('@/lib/persistence/server', () => ({
  getSessionRepository: () => ({
    endSessionsForAuthSession: (...a: unknown[]) =>
      endSessionsForAuthSession(...a),
  }),
  getCouncilMemoryRepository: () => ({
    writeSummary: (...a: unknown[]) => writeSummary(...a),
  }),
}));

import { signOut } from '../actions';

const sessionRow: CouncilSessionRow = {
  id: 'session-live',
  user_id: 'u1',
  mode: 'chat',
  auth_session_id: 'auth-1',
  started_at: '2026-04-22T00:00:00Z',
  ended_at: null,
  summary_written_at: null,
};

describe('signOut Server Action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('closes open Council rows for the current auth session, writes a summary, clears cookies, redirects', async () => {
    getAuthedIdentity.mockResolvedValueOnce({
      userId: 'u1',
      authSessionId: 'auth-1',
    });
    endSessionsForAuthSession.mockResolvedValueOnce([sessionRow]);
    writeSummary.mockResolvedValueOnce(undefined);

    await expect(signOut()).rejects.toThrow(/NEXT_REDIRECT:\/sign-in/);

    expect(endSessionsForAuthSession).toHaveBeenCalledWith({
      userId: 'u1',
      authSessionId: 'auth-1',
    });
    expect(writeSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'u1',
        session_id: 'session-live',
        kind: 'session-end',
      }),
    );
    expect(supabaseSignOut).toHaveBeenCalledTimes(1);
    expect(redirectMock).toHaveBeenCalledWith('/sign-in');
  });

  it('still signs out and redirects if identity lookup fails', async () => {
    getAuthedIdentity.mockRejectedValueOnce(new Error('no cookie'));

    await expect(signOut()).rejects.toThrow(/NEXT_REDIRECT:\/sign-in/);

    expect(endSessionsForAuthSession).not.toHaveBeenCalled();
    expect(writeSummary).not.toHaveBeenCalled();
    expect(supabaseSignOut).toHaveBeenCalledTimes(1);
  });

  it('swallows endSessionsForAuthSession errors and still signs out', async () => {
    getAuthedIdentity.mockResolvedValueOnce({
      userId: 'u1',
      authSessionId: 'auth-1',
    });
    endSessionsForAuthSession.mockRejectedValueOnce(new Error('db blip'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(signOut()).rejects.toThrow(/NEXT_REDIRECT:\/sign-in/);

    expect(supabaseSignOut).toHaveBeenCalledTimes(1);
    expect(writeSummary).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('swallows writeSummary errors per row and still signs out', async () => {
    getAuthedIdentity.mockResolvedValueOnce({
      userId: 'u1',
      authSessionId: 'auth-1',
    });
    endSessionsForAuthSession.mockResolvedValueOnce([sessionRow]);
    writeSummary.mockRejectedValueOnce(new Error('db blip'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(signOut()).rejects.toThrow(/NEXT_REDIRECT:\/sign-in/);

    expect(supabaseSignOut).toHaveBeenCalledTimes(1);
    errSpy.mockRestore();
  });

  it('does not call writeSummary when no rows were open for this auth session', async () => {
    getAuthedIdentity.mockResolvedValueOnce({
      userId: 'u1',
      authSessionId: 'auth-1',
    });
    endSessionsForAuthSession.mockResolvedValueOnce([]);

    await expect(signOut()).rejects.toThrow(/NEXT_REDIRECT:\/sign-in/);

    expect(endSessionsForAuthSession).toHaveBeenCalledTimes(1);
    expect(writeSummary).not.toHaveBeenCalled();
    expect(supabaseSignOut).toHaveBeenCalledTimes(1);
  });
});
