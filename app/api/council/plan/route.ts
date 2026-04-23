import { NextResponse } from 'next/server';
import { getAuthedIdentity } from '@/lib/auth/current-user';

// F22a — Vercel runtime pins for the Council streaming routes.
// `edge` cannot satisfy our current deps (Supabase service-key calls +
// @anthropic-ai/sdk) and hits a 25s hard ceiling; `nodejs` + a 60s max
// duration matches a long Plan turn (Researcher tool use + Critic
// pass + Consolidator stream) without risking a 504 mid-stream.
// See PR #32 — this file is the reapplied intent of that stale PR.
export const runtime = 'nodejs';
export const maxDuration = 60;

import { runCouncilTurn } from '@/lib/council/server/dispatch';
import { streamCouncilReply } from '@/lib/council/server/stream-response';
import { resolveSessionId } from '@/lib/council/server/session';
import { extractPlanFrame } from '@/lib/council/server/plan-extract';
import { buildCriticAudit } from '@/lib/council/server/critic-audit';
import { buildMemoryRecallAudit } from '@/lib/council/server/memory-recall-audit';
import {
  getProposalRepository,
  getSessionRepository,
  getCouncilMemoryRepository,
  getMetricsRepository,
} from '@/lib/persistence/server';

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
 *       { "proposals": [{"id": "<uuid>", "title": "<draft title>"}, ...],
 *         "chips": ["scope?", ...] }
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
  let authSessionId: string;
  try {
    ({ userId, authSessionId } = await getAuthedIdentity());
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

  const sessionRepo = getSessionRepository();
  const memoryRepo = getCouncilMemoryRepository();
  const metricsRepo = getMetricsRepository();
  const sessionId = await resolveSessionId({
    userId,
    authSessionId,
    mode: 'plan',
    clientProvided:
      typeof body.sessionId === 'string' ? body.sessionId : undefined,
    sessionRepo,
    memoryRepo,
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
      sessionRepo,
      memoryRepo,
      metricsRepo,
    },
  );

  // The trailer runs after the stream drains and the consolidator's
  // final `done` resolves. We parse the JSON-plan frame, create one
  // proposal row per draft task, and emit the id list + any
  // Consolidator-requested chips as the response trailer. F23 also
  // merges a `criticAudit` fragment so the shelf composer can render
  // the "How I got here" reveal next to proposal cards — Plan force-
  // critiques every draft (forceCritic=true above), so this is the
  // mode where the reveal is most likely to appear. F24 adds a
  // `memoryRecall` fragment whenever the Researcher surfaced prior-
  // session summaries into the system prompt, so the shelf can render
  // the "I remembered from earlier" reveal alongside the Critic one.
  const trailer = async (): Promise<Record<string, unknown> | null> => {
    const final = await done;
    const criticAudit = buildCriticAudit(final);
    const memoryRecall = buildMemoryRecallAudit(
      final.researcher.recalledSummaries,
    );
    const frame = extractPlanFrame(final.text);
    if (
      frame.tasks.length === 0 &&
      frame.chips.length === 0 &&
      criticAudit === null &&
      memoryRecall === null
    ) {
      return null;
    }

    // `proposals` carries the shape the shelf composer needs to
    // render <ProposalCard> directly: an id (for the approve POST)
    // and a title (for the card heading). Zipping id+title on the
    // client via a second `extractPlanFrame` call would duplicate
    // the parse that already happened here — the server is the
    // single source of truth for "what did we actually persist?".
    const proposals: { id: string; title: string }[] = [];
    if (frame.tasks.length > 0) {
      const repo = getProposalRepository();
      for (const title of frame.tasks) {
        try {
          const row = await repo.create({
            user_id: userId,
            // F18 landed: sessionId is now a real council_sessions.id,
            // so the proposal row links back to the session that
            // produced it. The history view (F19) uses this linkage
            // to reconstruct "what did the Council actually draft in
            // this session?" without replaying the full turn log.
            session_id: sessionId,
            kind: 'task',
            payload: { title },
          } as Parameters<typeof repo.create>[0]);
          proposals.push({ id: row.id, title });
        } catch (err) {
          // Per PRD §9: a proposal-create failure inside Plan is
          // fail-visible but should not truncate the user-visible reply
          // or swallow successful siblings.
          console.error('plan: proposal create failed', err);
        }
      }
    }

    const payload: Record<string, unknown> = {};
    if (proposals.length > 0) payload.proposals = proposals;
    if (frame.chips.length > 0) payload.chips = frame.chips;
    if (criticAudit) payload.criticAudit = criticAudit;
    if (memoryRecall) payload.memoryRecall = memoryRecall;
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
