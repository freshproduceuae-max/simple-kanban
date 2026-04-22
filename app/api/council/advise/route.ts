import { NextResponse } from 'next/server';
import { getAuthedUserId } from '@/lib/auth/current-user';

// Pin to the Node runtime: the Anthropic SDK is Node-only. Advise
// runs the Critic only on the fast-path risk threshold, so it's
// usually faster than Plan — same 60s ceiling for headroom when
// the board snapshot is large.
export const runtime = 'nodejs';
export const maxDuration = 60;
import { runCouncilTurn } from '@/lib/council/server/dispatch';
import { streamCouncilReply } from '@/lib/council/server/stream-response';
import { resolveSessionId } from '@/lib/council/server/session';
import { userRequestedPlanHandoff } from '@/lib/council/shared/handoff-request';
import { userRequestedWeb } from '@/lib/council/shared/web-request';
import { getTaskRepository } from '@/lib/persistence/server';
import type { TaskRow } from '@/lib/persistence/types';
import { SessionRepositoryNotImplemented } from '@/lib/persistence/session-repository';
import { CouncilMemoryRepositoryNotImplemented } from '@/lib/persistence/council-memory-repository';

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
 *   a JSON trailer `{ "handoff": "plan" }` on a fresh line.
 *   Headers:
 *     x-council-mode: advise
 *     x-council-session-id: <resolved session id>
 *     x-council-has-proposals: true (only when a trailer will be emitted)
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
  try {
    userId = await getAuthedUserId();
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

  const sessionId = resolveSessionId({
    userId,
    clientProvided:
      typeof body.sessionId === 'string' ? body.sessionId : undefined,
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
      sessionRepo: new SessionRepositoryNotImplemented(),
      memoryRepo: new CouncilMemoryRepositoryNotImplemented(),
    },
  );

  // Trailer: only emit when handoff is signalled. Advise otherwise has
  // no structured frame — the reply is the entire response body.
  const trailer = planHandoff
    ? async (): Promise<Record<string, unknown> | null> => {
        // Make sure the consolidator has finished persisting before the
        // client pivots to Plan mode.
        await done;
        return { handoff: 'plan' };
      }
    : undefined;

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
