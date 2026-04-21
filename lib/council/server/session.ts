import { randomUUID } from 'node:crypto';

/**
 * F18 replaces this.
 *
 * Temporary session-id bridge so F15/F16/F17 mode routes have a stable
 * session handle without depending on the full F18 session lifecycle
 * (start row, end row, idle detection, summary scheduling).
 *
 * Contract (deliberately narrow — matches what the three mode routes
 * actually need and nothing more):
 *
 *   - `findOrCreateSessionId({ userId })` returns a string session id.
 *   - Same user within 30 minutes of idle → same id.
 *   - Different user, OR same user past 30 min idle → new id.
 *
 * In-memory Map is fine for v0.4 alpha (single-process Vercel
 * serverless; state is per-invocation). A cold start produces a fresh
 * session id; that's acceptable because the client's shelf also starts
 * fresh on every page load. F18 will replace this with a Supabase-
 * backed `council_sessions` row + proper idle detection + end-of-
 * session summary scheduling.
 *
 * Every call to this helper is a candidate for F18 migration — grep
 * `F18 replaces this` to find them all when F18 lands.
 */

export const SESSION_IDLE_WINDOW_MS = 30 * 60 * 1000; // 30 min

type SessionEntry = { sessionId: string; lastTouchedAt: number };

const sessionByUser = new Map<string, SessionEntry>();

export function __resetSessionCacheForTests(): void {
  sessionByUser.clear();
}

/**
 * Pure helper so tests can drive the clock. Production uses Date.now().
 */
export function findOrCreateSessionId(args: {
  userId: string;
  now?: number;
}): string {
  const now = args.now ?? Date.now();
  const existing = sessionByUser.get(args.userId);
  if (existing && now - existing.lastTouchedAt <= SESSION_IDLE_WINDOW_MS) {
    existing.lastTouchedAt = now;
    return existing.sessionId;
  }
  const fresh: SessionEntry = {
    sessionId: randomUUID(),
    lastTouchedAt: now,
  };
  sessionByUser.set(args.userId, fresh);
  return fresh.sessionId;
}

/**
 * Escape hatch for callers that already hold a client-provided session
 * id (e.g. the shelf remembers the id across consecutive turns). If the
 * id is non-empty we trust it; otherwise we fall through to find-or-
 * create. This is how the route accepts an optional `sessionId` in the
 * request body without hard-coding client-server assumptions.
 */
export function resolveSessionId(args: {
  userId: string;
  clientProvided?: string;
  now?: number;
}): string {
  const trimmed = args.clientProvided?.trim();
  if (trimmed && trimmed.length > 0) {
    // Refresh the cache so subsequent calls without an explicit id stay
    // aligned with the client's view of the session.
    sessionByUser.set(args.userId, {
      sessionId: trimmed,
      lastTouchedAt: args.now ?? Date.now(),
    });
    return trimmed;
  }
  return findOrCreateSessionId({ userId: args.userId, now: args.now });
}
