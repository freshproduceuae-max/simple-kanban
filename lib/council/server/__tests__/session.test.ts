import { describe, it, expect, beforeEach } from 'vitest';
import {
  findOrCreateSessionId,
  resolveSessionId,
  SESSION_IDLE_WINDOW_MS,
  __resetSessionCacheForTests,
} from '../session';

describe('findOrCreateSessionId — F18 bridge', () => {
  beforeEach(() => {
    __resetSessionCacheForTests();
  });

  it('returns the same id for the same user within the idle window', () => {
    const t0 = 1_000_000;
    const id1 = findOrCreateSessionId({ userId: 'u1', now: t0 });
    const id2 = findOrCreateSessionId({
      userId: 'u1',
      now: t0 + SESSION_IDLE_WINDOW_MS - 1,
    });
    expect(id1).toBe(id2);
  });

  it('returns a fresh id once the idle window elapses', () => {
    const t0 = 1_000_000;
    const id1 = findOrCreateSessionId({ userId: 'u1', now: t0 });
    const id2 = findOrCreateSessionId({
      userId: 'u1',
      now: t0 + SESSION_IDLE_WINDOW_MS + 1,
    });
    expect(id1).not.toBe(id2);
  });

  it('scopes per-user (two users never share a session id)', () => {
    const t0 = 1_000_000;
    const idU1 = findOrCreateSessionId({ userId: 'u1', now: t0 });
    const idU2 = findOrCreateSessionId({ userId: 'u2', now: t0 });
    expect(idU1).not.toBe(idU2);
  });

  it('touching refreshes the idle window', () => {
    const t0 = 1_000_000;
    const id1 = findOrCreateSessionId({ userId: 'u1', now: t0 });
    // Half-way through the window, touch again.
    findOrCreateSessionId({
      userId: 'u1',
      now: t0 + SESSION_IDLE_WINDOW_MS / 2,
    });
    // Now ~ 3/4 from original t0; should still be the same id because
    // the touch refreshed lastTouchedAt.
    const id2 = findOrCreateSessionId({
      userId: 'u1',
      now: t0 + SESSION_IDLE_WINDOW_MS / 2 + SESSION_IDLE_WINDOW_MS - 1,
    });
    expect(id1).toBe(id2);
  });
});

describe('resolveSessionId', () => {
  beforeEach(() => {
    __resetSessionCacheForTests();
  });

  it('trusts a non-empty client-provided id', () => {
    const got = resolveSessionId({
      userId: 'u1',
      clientProvided: 'client-owned-session-123',
    });
    expect(got).toBe('client-owned-session-123');
  });

  it('falls through to find-or-create on empty / whitespace client id', () => {
    const a = resolveSessionId({ userId: 'u1', clientProvided: '   ' });
    const b = resolveSessionId({ userId: 'u1', clientProvided: undefined });
    expect(a).toBe(b);
  });

  it('subsequent unspecified calls align with the last client-provided id', () => {
    resolveSessionId({ userId: 'u1', clientProvided: 'client-id-9' });
    const follow = resolveSessionId({ userId: 'u1' });
    expect(follow).toBe('client-id-9');
  });
});
