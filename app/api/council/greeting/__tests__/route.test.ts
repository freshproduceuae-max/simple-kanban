import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * F14 route coverage. The greeting composer is mocked at the module
 * boundary so we assert the request-handling shape only: auth, tz,
 * first-of-day vs re-entry, and the streaming response headers.
 */

const getAuthedUserId = vi.fn();
const listForUser = vi.fn();
const composeFullGreeting = vi.fn();
const lastSessionStartedAt = vi.fn();

vi.mock('@/lib/auth/current-user', () => ({
  getAuthedUserId: () => getAuthedUserId(),
}));

vi.mock('@/lib/persistence/server', () => ({
  getTaskRepository: () => ({
    listForUser: (...a: unknown[]) => listForUser(...a),
  }),
}));

vi.mock('@/lib/council/greeting/last-session', () => ({
  lastSessionStartedAt: (...a: unknown[]) => lastSessionStartedAt(...a),
}));

vi.mock('@/lib/council/greeting', async () => {
  const actual = await vi.importActual<typeof import('@/lib/council/greeting')>(
    '@/lib/council/greeting',
  );
  return {
    ...actual,
    composeFullGreeting: (...a: unknown[]) => composeFullGreeting(...a),
  };
});

import { POST as greetingRoute } from '../route';

function req(body: unknown = {}): Request {
  return new Request('https://plan.example.com/api/council/greeting', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

function fakeStreamResult(text: string) {
  async function* gen() {
    yield text;
  }
  return {
    stream: { [Symbol.asyncIterator]: () => gen() } as AsyncIterable<string>,
    done: Promise.resolve({ text, tokensIn: 0, tokensOut: 0 }),
  };
}

describe('POST /api/council/greeting (F14)', () => {
  beforeEach(() => {
    getAuthedUserId.mockReset();
    listForUser.mockReset();
    composeFullGreeting.mockReset();
    lastSessionStartedAt.mockReset();
    getAuthedUserId.mockResolvedValue('u1');
    listForUser.mockResolvedValue([]);
    lastSessionStartedAt.mockResolvedValue(null);
  });

  it('returns 401 when not authenticated', async () => {
    getAuthedUserId.mockRejectedValue(new Error('not-authenticated'));
    const res = await greetingRoute(req());
    expect(res.status).toBe(401);
  });

  it('first-of-day: streams text/plain with x-greeting-kind: full', async () => {
    lastSessionStartedAt.mockResolvedValue(null); // no prior session
    composeFullGreeting.mockResolvedValue(fakeStreamResult('Good morning.'));
    const res = await greetingRoute(req({ tz: 'UTC' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/plain/);
    expect(res.headers.get('x-greeting-kind')).toBe('full');
    const text = await res.text();
    expect(text).toBe('Good morning.');
    expect(composeFullGreeting).toHaveBeenCalled();
  });

  it('subsequent same-day open: returns JSON re-entry line (no SDK call)', async () => {
    // Last session was 1 minute ago, well after "today midnight UTC".
    lastSessionStartedAt.mockResolvedValue(
      new Date(Date.now() - 60_000).toISOString(),
    );
    const res = await greetingRoute(req({ tz: 'UTC' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
    const body = await res.json();
    expect(body.kind).toBe('reentry');
    expect(typeof body.text).toBe('string');
    expect(composeFullGreeting).not.toHaveBeenCalled();
  });

  it('previous-day session: treated as first-of-day (streams full)', async () => {
    // 2 days ago.
    lastSessionStartedAt.mockResolvedValue(
      new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    );
    composeFullGreeting.mockResolvedValue(fakeStreamResult('Good morning.'));
    const res = await greetingRoute(req({ tz: 'UTC' }));
    expect(res.headers.get('x-greeting-kind')).toBe('full');
    expect(composeFullGreeting).toHaveBeenCalled();
  });

  it('tolerates a missing body (defaults to UTC, still streams)', async () => {
    lastSessionStartedAt.mockResolvedValue(null);
    composeFullGreeting.mockResolvedValue(fakeStreamResult('Good morning.'));
    const res = await greetingRoute(
      new Request('https://plan.example.com/api/council/greeting', { method: 'POST' }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('x-greeting-kind')).toBe('full');
  });

  it('still responds if the task list read fails (greeting from empty signals)', async () => {
    lastSessionStartedAt.mockResolvedValue(null);
    listForUser.mockRejectedValue(new Error('db down'));
    composeFullGreeting.mockResolvedValue(fakeStreamResult('Good morning.'));
    const res = await greetingRoute(req({ tz: 'UTC' }));
    expect(res.status).toBe(200);
  });
});
