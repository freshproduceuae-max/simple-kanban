import { NextResponse } from 'next/server';
import { getAuthedUserId } from '@/lib/auth/current-user';
import { runCouncilTurn } from '@/lib/council/server/dispatch';
import { streamCouncilReply } from '@/lib/council/server/stream-response';
import { resolveSessionId } from '@/lib/council/server/session';
import { extractPlanFrame } from '@/lib/council/server/plan-extract';
import { getProposalRepository } from '@/lib/persistence/server';
import { SessionRepositoryNotImplemented } from '@/lib/persistence/session-repository';
import { CouncilMemoryRepositoryNotImplemented } from '@/lib/persistence/council-memory-repository';

/**
 * POST /api/council/plan  (F16 — Plan mode)
 *
 * The drafting exchange. Web is ON by default (Plan mode always looks
 * outward when it helps), Critic is forced (the Plan draft is the one
 * time we always want a second opinion), and the Council Write Gate is
 * respected: we create pending `council_proposals` rows here but the
 * user still has to tap each card to commit the task.
 *
 * Request body:
 *   { sessionId?: string, userInput: string }
 *
 * Response:
 *   200 text/plain streamed Consolidator reply, followed by a JSON
 *   trailer frame on a fresh line:
 *       { "proposals": ["<id>", ...], "chips": ["scope?", ...] }
 *   Headers:
 *     x-council-mode: plan
 *     x-council-session-id: <resolved session id>
 *   (No `x-council-has-proposals` header — Plan cannot promise a
 *   trailer pre-stream, so the client should always attempt to
 *   JSON.parse the last LF-delimited line and fall back to treating
 *   the whole body as text on failure.)
 *
 * Errors:
 *   401 not-authenticated
 *   400 userInput missing/empty/non-string
 *   400 invalid-json
 */

type PlanRequest = {
  sessionId?: unknown;
  userInput?: unknown;
};

export async function POST(request: Request) {
  let userId: string;
  try {
    userId = await getAuthedUserId();
  } catch {
    return NextResponse.json({ error: 'not-authenticated' }, { status: 401 });
  }

  let body: PlanRequest;
  try {
    body = ((await request.json()) as PlanRequest) ?? {};
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

  const { stream, done } = await runCouncilTurn(
    {
      userId,
      sessionId,
      mode: 'plan',
      userInput,
      webEnabled: true,
      forceCritic: true,
    },
    {
      sessionRepo: new SessionRepositoryNotImplemented(),
      memoryRepo: new CouncilMemoryRepositoryNotImplemented(),
    },
  );

  // The trailer runs after the stream drains and the consolidator's
  // final `done` resolves. We parse the JSON-plan frame, create one
  // proposal row per draft task, and emit the id list + any
  // Consolidator-requested chips as the response trailer.
  const trailer = async (): Promise<Record<string, unknown> | null> => {
    const final = await done;
    const frame = extractPlanFrame(final.text);
    if (frame.tasks.length === 0 && frame.chips.length === 0) {
      return null;
    }

    const proposalIds: string[] = [];
    if (frame.tasks.length > 0) {
      const repo = getProposalRepository();
      for (const title of frame.tasks) {
        try {
          const row = await repo.create({
            user_id: userId,
            // F18 bridge: council_proposals.session_id is a FK to
            // council_sessions(id), and F18 is the phase that starts
            // inserting those rows. Until F18 lands we persist
            // proposal rows with a null session linkage; the response
            // header `x-council-session-id` still threads the
            // synthetic session id to the client for conversation
            // stitching. Do NOT flip this back to `sessionId` without
            // first shipping F18's session-lifecycle writes.
            session_id: null,
            kind: 'task',
            payload: { title },
          } as Parameters<typeof repo.create>[0]);
          proposalIds.push(row.id);
        } catch (err) {
          // Per PRD §9: a proposal-create failure inside Plan is
          // fail-visible but should not truncate the user-visible reply
          // or swallow successful siblings.
          console.error('plan: proposal create failed', err);
        }
      }
    }

    const payload: Record<string, unknown> = {};
    if (proposalIds.length > 0) payload.proposals = proposalIds;
    if (frame.chips.length > 0) payload.chips = frame.chips;
    return Object.keys(payload).length > 0 ? payload : null;
  };

  const res = streamCouncilReply({
    chunks: stream,
    done,
    mode: 'plan',
    trailer,
  });
  res.headers.set('x-council-session-id', sessionId);
  return res;
}
