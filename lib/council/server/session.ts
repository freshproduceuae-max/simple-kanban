import type { SessionRepository } from '@/lib/persistence/session-repository';
import type { CouncilMemoryRepository } from '@/lib/persistence/council-memory-repository';
import type { CouncilMode } from '@/lib/persistence/types';

/**
 * F18 — DB-backed session resolver.
 *
 * The Council-facing routes (chat / plan / advise / greeting) each need
 * a real `council_sessions.id` so the agent trio's `appendTurn` writes
 * satisfy the FK on `council_turns.session_id`. This module owns the
 * find-or-create policy:
 *
 *   - Same user, same idle window (30 min) → reuse the cached id.
 *   - New user, OR same user past the idle window → start a fresh
 *     `council_sessions` row and cache the new id.
 *   - Client-provided id (UUID) → validated before trust. If it
 *     matches the cache entry within the idle window we skip the DB
 *     entirely; otherwise we ask the repo for a `findResumableSession`
 *     lookup (owned by user, still open, activity within idle cutoff).
 *     Anything stale or unknown is dropped and we fall through as if
 *     no id had been echoed.
 *
 * When the idle window closes we fire-and-forget a cold-path end-of-
 * session pass: stamp `ended_at` on the previous row and write a
 * session-end summary (PRD §10.2 / §11.1). The pass runs in the
 * background so the incoming turn never waits on it; errors are
 * swallowed with a log because the user should not see persistence
 * flakes as route failures.
 *
 * In-memory cache is deliberate. Vercel serverless instances are
 * per-invocation warm; on a cold start we fall through to a fresh
 * `startSession`, which produces a new row and a new id. The shelf
 * persists its sessionId across page loads, so a returning user will
 * usually echo the prior id back via `clientProvided` and we'll trust
 * it without touching the DB.
 *
 * This module replaces the F15-F17 bridge that stored a randomUUID()
 * keyed only by userId. The old bridge never wrote to the DB; F18
 * closes that gap so turns and proposals can FK to real session rows.
 */

export const SESSION_IDLE_WINDOW_MS = 30 * 60 * 1000; // 30 min

type SessionEntry = {
  sessionId: string;
  lastTouchedAt: number;
  mode: CouncilMode;
};

const sessionByUser = new Map<string, SessionEntry>();

export function __resetSessionCacheForTests(): void {
  sessionByUser.clear();
}

/**
 * UUID guard — trust a client-provided id only if it looks like a real
 * `gen_random_uuid()` value. Prevents a stale/garbage shelf state from
 * poisoning the cache with an id that will then fail the FK when the
 * agent trio tries to `appendTurn`.
 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(maybe: string): boolean {
  return UUID_REGEX.test(maybe);
}

export type ResolveSessionInput = {
  userId: string;
  mode: CouncilMode;
  clientProvided?: string;
  now?: number;
  sessionRepo: SessionRepository;
  memoryRepo: CouncilMemoryRepository;
  log?: (msg: string, err: unknown) => void;
};

/**
 * Returns a real `council_sessions.id` for this turn. Async: may hit
 * the DB. Callers await it before invoking the agent trio so every
 * subsequent `appendTurn` has a valid FK target.
 */
export async function resolveSessionId(
  input: ResolveSessionInput,
): Promise<string> {
  const now = input.now ?? Date.now();
  const log = input.log ?? ((msg, err) => console.error(msg, err));

  // Client echoed an id back. A well-formed UUID is necessary but not
  // sufficient — we must prove it's still a live session this user
  // owns before we cache it, otherwise stale shelf state pins the
  // user to a dead session forever (and causes FK failures on the
  // next appendTurn / proposal insert).
  const trimmed = input.clientProvided?.trim();
  if (trimmed && isUuid(trimmed)) {
    const cached = sessionByUser.get(input.userId);
    if (
      cached &&
      cached.sessionId === trimmed &&
      now - cached.lastTouchedAt <= SESSION_IDLE_WINDOW_MS
    ) {
      cached.lastTouchedAt = now;
      return trimmed;
    }

    const idleCutoffIso = new Date(now - SESSION_IDLE_WINDOW_MS).toISOString();
    try {
      const row = await input.sessionRepo.findResumableSession({
        sessionId: trimmed,
        userId: input.userId,
        idleCutoffIso,
      });
      if (row) {
        sessionByUser.set(input.userId, {
          sessionId: row.id,
          lastTouchedAt: now,
          mode: row.mode,
        });
        return row.id;
      }
      // Row came back null — stale, unknown, or past idle. Fall
      // through to the cache/startSession flow below.
    } catch (err) {
      log('session: findResumableSession failed (falling through)', err);
    }
  }

  const existing = sessionByUser.get(input.userId);
  if (existing && now - existing.lastTouchedAt <= SESSION_IDLE_WINDOW_MS) {
    existing.lastTouchedAt = now;
    return existing.sessionId;
  }

  // Idle window closed (or first-ever turn) — finalize the prior
  // session as a cold-path pass, then start a fresh one.
  if (existing) {
    const toFinalize = existing;
    void finalizeSession(
      {
        userId: input.userId,
        sessionId: toFinalize.sessionId,
        mode: toFinalize.mode,
      },
      {
        sessionRepo: input.sessionRepo,
        memoryRepo: input.memoryRepo,
        log,
      },
    );
  }

  const row = await input.sessionRepo.startSession({
    userId: input.userId,
    mode: input.mode,
  });
  sessionByUser.set(input.userId, {
    sessionId: row.id,
    lastTouchedAt: now,
    mode: input.mode,
  });
  return row.id;
}

/**
 * Cold-path session finalizer. Stamps `ended_at` on the session row
 * and writes a minimal end-of-session summary. Errors are swallowed —
 * a background write must never surface as a route failure.
 *
 * The content here is deliberately boilerplate for v0.4 alpha. A
 * proper LLM-driven summary ("what was discussed, what got decided")
 * is a later enhancement; the row being present is what the
 * Researcher / greeting read paths need today.
 */
async function finalizeSession(
  args: { userId: string; sessionId: string; mode: CouncilMode },
  deps: {
    sessionRepo: SessionRepository;
    memoryRepo: CouncilMemoryRepository;
    log: (msg: string, err: unknown) => void;
  },
): Promise<void> {
  try {
    await deps.sessionRepo.endSession({
      sessionId: args.sessionId,
      userId: args.userId,
    });
  } catch (err) {
    deps.log('session: endSession failed (swallowed)', err);
  }
  try {
    await deps.memoryRepo.writeSummary({
      user_id: args.userId,
      session_id: args.sessionId,
      kind: 'session-end',
      content: `Session closed after 30 min idle. Mode: ${args.mode}.`,
    });
  } catch (err) {
    deps.log('session: writeSummary failed (swallowed)', err);
  }
}
