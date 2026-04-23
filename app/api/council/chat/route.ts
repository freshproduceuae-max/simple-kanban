import { NextResponse } from 'next/server';
import { getAuthedIdentity } from '@/lib/auth/current-user';

// F22a — Vercel runtime pins for the Council streaming routes.
// See app/api/council/plan/route.ts for the rationale.
export const runtime = 'nodejs';
export const maxDuration = 60;

import { runCouncilTurn } from '@/lib/council/server/dispatch';
import { streamCouncilReply } from '@/lib/council/server/stream-response';
import { resolveSessionId } from '@/lib/council/server/session';
import { buildCriticAudit } from '@/lib/council/server/critic-audit';
import { buildMemoryRecallAudit } from '@/lib/council/server/memory-recall-audit';
import { resolveTransparencyMode } from '@/lib/council/server/transparency';
import { userRequestedWeb } from '@/lib/council/shared/web-request';
import {
  getSessionRepository,
  getCouncilMemoryRepository,
  getMetricsRepository,
  getUserPreferencesRepository,
} from '@/lib/persistence/server';

/**
 * POST /api/council/chat  (F15 — Chat mode)
 *
 * Ordinary Council exchange. Memory-only by default; public web fires
 * only when the user explicitly asks ("look this up", "search", etc.
 * — see lib/council/shared/web-request.ts). Critic runs on the risk-
 * threshold fast path (no force). No proposal cards — Chat is not a
 * path to board mutations; Plan owns that.
 *
 * Request body:
 *   { sessionId?: string, userInput: string }
 *
 * Response:
 *   200 text/plain streamed Consolidator reply.
 *   Headers: `x-council-mode: chat` (+ `x-council-session-id` so the
 *   client can remember it for the next turn without asking the
 *   server again).
 *
 * Errors:
 *   401 not-authenticated
 *   400 userInput missing/empty/non-string
 *
 * F18 landed: sessionId is now a real `council_sessions.id` and the
 * agent trio writes turn logs against it synchronously. The resolver
 * will start a fresh session on the first turn of a new user /
 * expired idle window.
 */

type ChatRequest = {
  sessionId?: unknown;
  userInput?: unknown;
};

export async function POST(request: Request) {
  let userId: string;
  let authSessionId: string;
  try {
    ({ userId, authSessionId } = await getAuthedIdentity());
  } catch {
    return NextResponse.json({ error: 'not-authenticated' }, { status: 401 });
  }

  let body: ChatRequest;
  try {
    body = ((await request.json()) as ChatRequest) ?? {};
  } catch {
    return NextResponse.json({ error: 'bad-json' }, { status: 400 });
  }

  const userInput =
    typeof body.userInput === 'string' ? body.userInput.trim() : '';
  if (!userInput) {
    return NextResponse.json(
      { error: 'userInput required' },
      { status: 400 },
    );
  }

  const sessionRepo = getSessionRepository();
  const memoryRepo = getCouncilMemoryRepository();
  const metricsRepo = getMetricsRepository();
  const preferencesRepo = getUserPreferencesRepository();
  // F25 — fire the preference lookup in parallel with the session
  // resolution. Neither depends on the other, and the resolver is
  // fail-quiet so a Supabase wobble never blocks the stream.
  const transparencyModePromise = resolveTransparencyMode(
    userId,
    preferencesRepo,
  );
  const sessionId = await resolveSessionId({
    userId,
    authSessionId,
    mode: 'chat',
    clientProvided:
      typeof body.sessionId === 'string' ? body.sessionId : undefined,
    sessionRepo,
    memoryRepo,
  });

  const webEnabled = userRequestedWeb(userInput);

  const { stream, done } = await runCouncilTurn(
    {
      userId,
      sessionId,
      mode: 'chat',
      userInput,
      webEnabled,
      forceCritic: false,
    },
    {
      sessionRepo,
      memoryRepo,
      metricsRepo,
    },
  );

  // F23 + F24 + F25 — the Chat route has no structured trailer of its
  // own, but it still carries the Critic audit when the Critic fired
  // on the draft (F23), a memory-recall artifact when the Researcher
  // surfaced prior-session summaries (F24), and the user's resolved
  // transparency mode (F25) so the shelf knows whether to render the
  // reveals inline (B), collapse on-tap (default), open-by-default
  // (D), add source glyphs (C), or suppress entirely (A).
  //
  // Under mode A we short-circuit the reveal artifacts server-side —
  // no point shipping kilobytes of criticAudit/memoryRecall only for
  // the client to discard them. Emitting an empty trailer on a turn
  // with nothing would be a net loss (adds a stray newline to the
  // body for zero benefit), so the helper returns `null` and the
  // wrapper skips the line entirely when nothing applies.
  const trailer = async (): Promise<Record<string, unknown> | null> => {
    const final = await done;
    const transparencyMode = await transparencyModePromise;
    const emitReveals = transparencyMode !== 'A';
    const criticAudit = emitReveals ? buildCriticAudit(final) : null;
    const memoryRecall = emitReveals
      ? buildMemoryRecallAudit(final.researcher.recalledSummaries)
      : null;
    if (!criticAudit && !memoryRecall) return null;
    const payload: Record<string, unknown> = {};
    if (criticAudit) payload.criticAudit = criticAudit;
    if (memoryRecall) payload.memoryRecall = memoryRecall;
    // Mode always ships alongside reveals so the client renders them
    // correctly (open-by-default for D, glyphs for C, collapsed for B).
    payload.transparencyMode = transparencyMode;
    return payload;
  };

  const res = streamCouncilReply({
    chunks: stream,
    done,
    mode: 'chat',
    trailer,
  });
  res.headers.set('x-council-session-id', sessionId);
  return res;
}
