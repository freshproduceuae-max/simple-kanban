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
import { userRequestedPlanHandoff } from '@/lib/council/shared/handoff-request';
import { userRequestedWeb } from '@/lib/council/shared/web-request';
import {
  getTaskRepository,
  getSessionRepository,
  getCouncilMemoryRepository,
  getMetricsRepository,
  getUserPreferencesRepository,
} from '@/lib/persistence/server';
import type { TaskRow } from '@/lib/persistence/types';

/**
 * POST /api/council/advise  (F17 — Advise mode)
 *
 * Read-only reflection on the user's current board. The Researcher
 * gets the board snapshot so it can reason over pending work without a
 * fresh fetch. Web stays OFF by default and only flips on when the
 * client echoes back `confirmWebFetch: true` — the two-step confirm
 * that PRD §7 requires for Advise mode specifically.
 *
 * Critic runs on the risk threshold (no force) — Advise often doesn't
 * need the second pass, and forcing it would burn budget on casual
 * "what do you think?" exchanges.
 *
 * The Council Write Gate is sacred: Advise MUST NOT create proposal
 * rows. When the user signals they want to move from reflecting to
 * drafting ("draft this", "turn this into tasks"), we emit a
 * `{handoff: 'plan'}` trailer frame and the client re-POSTs the same
 * input to /api/council/plan (CD pick #3).
 *
 * Request body:
 *   { sessionId?: string, userInput: string, confirmWebFetch?: boolean }
 *
 * Response:
 *   200 text/plain streamed Consolidator reply, optionally followed by
 *   a JSON trailer on a fresh line. The trailer may carry:
 *     - `handoff: 'plan'`  — user asked to pivot from reflection to drafting
 *     - `criticAudit: { risk, review, preDraft }` — F23 reveal fragment,
 *        present only when the Critic fired (risk ≥ threshold)
 *     - `memoryRecall: { recalls: [...] }` — F24 reveal fragment,
 *        present when the Researcher surfaced prior-session summaries
 *   All fragments merge into one payload when multiple apply.
 *   Headers:
 *     x-council-mode: advise
 *     x-council-session-id: <resolved session id>
 *     x-council-has-proposals: true — ONLY when the handoff is signaled
 *       pre-stream. Critic-only trailers (F23) do NOT set this header,
 *       because Advise cannot predict pre-stream whether the Critic
 *       will fire. Clients must always attempt to peel the last LF-
 *       delimited line regardless of the header.
 *
 * Errors:
 *   401 not-authenticated
 *   400 userInput missing/empty/non-string
 *   400 invalid-json
 */

type AdviseRequest = {
  sessionId?: unknown;
  userInput?: unknown;
  confirmWebFetch?: unknown;
};

/**
 * Advise board snapshot — matches
 * `RunCouncilTurnInput['boardSnapshot']` exactly. Kept as a local
 * projection so we never leak extra columns (description, position,
 * timestamps) into the Researcher's prompt surface.
 */
function projectBoardSnapshot(
  rows: TaskRow[],
): Pick<TaskRow, 'id' | 'title' | 'board_column' | 'overdue_at'>[] {
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    board_column: r.board_column,
    overdue_at: r.overdue_at,
  }));
}

export async function POST(request: Request) {
  let userId: string;
  let authSessionId: string;
  try {
    ({ userId, authSessionId } = await getAuthedIdentity());
  } catch {
    return NextResponse.json({ error: 'not-authenticated' }, { status: 401 });
  }

  let body: AdviseRequest;
  try {
    body = ((await request.json()) as AdviseRequest) ?? {};
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
  // F25 — resolve the transparency pref in parallel with the session.
  // Fail-quiet to B inside the resolver so a Supabase wobble never
  // blocks the stream.
  const transparencyModePromise = resolveTransparencyMode(
    userId,
    preferencesRepo,
  );
  const sessionId = await resolveSessionId({
    userId,
    authSessionId,
    mode: 'advise',
    clientProvided:
      typeof body.sessionId === 'string' ? body.sessionId : undefined,
    sessionRepo,
    memoryRepo,
  });

  // Two-step web confirm (PRD §6.3 / §7): web is only allowed when
  // BOTH conditions are met simultaneously:
  //   1. The user's own turn text asks for it (phrase-match via
  //      `userRequestedWeb`).
  //   2. The client echoes `confirmWebFetch: true` — the user-tap
  //      confirmation that follows the first step.
  // Relying on the client flag alone would let stale/buggy callers
  // flip web on for ordinary advice turns, burning the 5-call budget
  // on requests the server should have kept memory-only.
  const webEnabled =
    body.confirmWebFetch === true && userRequestedWeb(userInput);

  // Plan-handoff phrase match — decided up front so the trailer shape
  // is known before the stream starts. No LLM call is required; the
  // handoff is a client-routing cue, not a judgement.
  const planHandoff = userRequestedPlanHandoff(userInput);

  // Fetch the board snapshot. A failure here is fail-visible: the user
  // still gets a reply, just without the board context.
  let boardSnapshot:
    | Pick<TaskRow, 'id' | 'title' | 'board_column' | 'overdue_at'>[]
    | undefined;
  try {
    const taskRepo = getTaskRepository();
    const rows = await taskRepo.listForUser(userId);
    boardSnapshot = projectBoardSnapshot(rows);
  } catch (err) {
    console.error('advise: board snapshot failed', err);
    boardSnapshot = undefined;
  }

  const { stream, done } = await runCouncilTurn(
    {
      userId,
      sessionId,
      mode: 'advise',
      userInput,
      webEnabled,
      boardSnapshot,
      forceCritic: false,
    },
    {
      sessionRepo,
      memoryRepo,
      metricsRepo,
    },
  );

  // Trailer: emit when any of (a) the handoff is signalled, (b) the
  // Critic fired (F23), or (c) the Researcher surfaced prior-session
  // summaries (F24). Advise doesn't force-critique (it often doesn't
  // need the second pass), so the Critic only appears on drafts the
  // risk heuristic flags — but when it does, the "How I got here"
  // reveal should be available here too. All fragments share one JSON
  // line. F25 attaches the user's resolved transparency mode whenever
  // a reveal artifact is present; mode A short-circuits the reveal
  // artifacts (handoff still ships — it's a routing cue, not a reveal).
  const trailer = async (): Promise<Record<string, unknown> | null> => {
    // Make sure the consolidator has finished persisting before the
    // client pivots to Plan mode.
    const final = await done;
    const transparencyMode = await transparencyModePromise;
    const emitReveals = transparencyMode !== 'A';
    const criticAudit = emitReveals ? buildCriticAudit(final) : null;
    const memoryRecall = emitReveals
      ? buildMemoryRecallAudit(final.researcher.recalledSummaries)
      : null;
    const payload: Record<string, unknown> = {};
    if (planHandoff) payload.handoff = 'plan';
    if (criticAudit) payload.criticAudit = criticAudit;
    if (memoryRecall) payload.memoryRecall = memoryRecall;
    // F25 — mode ships alongside reveals (not handoff-only trailers).
    if (criticAudit || memoryRecall) payload.transparencyMode = transparencyMode;
    return Object.keys(payload).length > 0 ? payload : null;
  };

  const res = streamCouncilReply({
    chunks: stream,
    done,
    mode: 'advise',
    trailer,
  });
  res.headers.set('x-council-session-id', sessionId);
  // Advise knows pre-stream whether a trailer will be emitted (handoff
  // is decided on the user input, not the Consolidator output), so
  // the header can be advertised honestly here.
  if (planHandoff) {
    res.headers.set('x-council-has-proposals', 'true');
  }
  return res;
}
