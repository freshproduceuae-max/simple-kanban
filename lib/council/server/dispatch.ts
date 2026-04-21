import type { CouncilMode, TaskRow } from '@/lib/persistence/types';
import type { SessionRepository } from '@/lib/persistence/session-repository';
import type { CouncilMemoryRepository } from '@/lib/persistence/council-memory-repository';
import { consolidate, type ConsolidatorResult } from '@/lib/council/consolidator';
import { research, type ResearcherFinding } from '@/lib/council/researcher';
import { critique, type CriticResult } from '@/lib/council/critic';
import type { AnthropicLike } from '@/lib/council/shared/client';

/**
 * F15/F16/F17 — shared Council-turn orchestrator.
 *
 * Composes Researcher → Consolidator stream → (post-stream) Critic for
 * all three user-facing modes (Chat, Plan, Advise). The greeting path
 * is separate — it does not use the Researcher + Critic pair and has
 * its own composer in `lib/council/greeting/index.ts`.
 *
 * Keeping the three mode routes thin: their only job is to translate
 * HTTP shape (auth, body parsing, trailer frames for Plan) into a
 * `runCouncilTurn` call. Everything about "call the Researcher first,
 * hand findings to Consolidator, critique afterwards, decide if web
 * is on" lives here so the three routes can't drift from each other.
 *
 * The return shape mirrors `consolidate()`: a `stream` the route pipes
 * directly into the HTTP response, and a `done` promise that resolves
 * after the Consolidator finishes AND the Critic (if it runs) reports
 * back. Route handlers await `done` inside the ReadableStream's
 * `finally` so the response body closes only after all post-stream
 * work has landed.
 */

export type RunCouncilTurnInput = {
  userId: string;
  sessionId: string;
  mode: Exclude<CouncilMode, 'greeting'>;
  userInput: string;
  /**
   * True → Researcher is allowed to hit the public web. False →
   * memory-only. The routes compute this per PRD §7:
   *   - Plan:   always true
   *   - Advise: only when the user has confirmed
   *   - Chat:   only when the user explicitly asks (see web-request.ts)
   */
  webEnabled: boolean;
  /**
   * Advise passes the current board so the Researcher can reason over
   * it without a fresh fetch. Chat/Plan usually pass nothing (Plan
   * tends to be about new work, not the existing board).
   */
  boardSnapshot?: Pick<TaskRow, 'id' | 'title' | 'board_column' | 'overdue_at'>[];
  /**
   * When true, Critic dispatches regardless of risk heuristic. Plan
   * sets this; Chat/Advise leave it unset (threshold fast-path still
   * catches high-risk drafts).
   */
  forceCritic?: boolean;
};

export type RunCouncilTurnDeps = {
  client?: AnthropicLike;
  sessionRepo: SessionRepository;
  memoryRepo: CouncilMemoryRepository;
  log?: (msg: string, err: unknown) => void;
};

export type RunCouncilTurnResult = {
  /** The user-visible text stream (pass straight to the HTTP body). */
  stream: AsyncIterable<string>;
  /**
   * Settles after the Consolidator stream ends AND the Critic has
   * finished (or skipped). Routes MUST await this before the HTTP
   * response closes so the Critic has a chance to persist its review.
   */
  done: Promise<{
    text: string;
    mode: CouncilMode;
    researcher: ResearcherFinding;
    critic: CriticResult;
  }>;
};

export async function runCouncilTurn(
  input: RunCouncilTurnInput,
  deps: RunCouncilTurnDeps,
): Promise<RunCouncilTurnResult> {
  const log = deps.log ?? ((msg, err) => console.error(msg, err));

  // 1. Researcher first. Its finding — success, cap-hit, or fail-visible
  //    one-liner — becomes a backstage system-prompt frame for the
  //    Consolidator. Running it before the Consolidator call (rather
  //    than in parallel) keeps the PRD §9 contract that the user sees
  //    the research outcome *inside* the first streamed reply, not as
  //    a separate second message.
  let researcher: ResearcherFinding;
  try {
    researcher = await research(
      {
        userId: input.userId,
        sessionId: input.sessionId,
        mode: input.mode,
        query: input.userInput,
        boardSnapshot: input.boardSnapshot,
        webEnabled: input.webEnabled,
      },
      {
        client: deps.client,
        sessionRepo: deps.sessionRepo,
        memoryRepo: deps.memoryRepo,
        log,
      },
    );
  } catch (researchErr) {
    // research() is supposed to be fail-visible internally; this branch
    // catches a throw we didn't anticipate (bug in the researcher, or
    // the stub repo went into a rejected-never-thrown state). Surface
    // the same honest sentence and continue.
    log('dispatch: researcher threw unexpectedly', researchErr);
    researcher = {
      ok: false,
      text: "I couldn't check external sources this turn.",
      toolCalls: [],
      tokensIn: 0,
      tokensOut: 0,
    };
  }

  // 2. Consolidator stream. Passing the researcher finding as
  //    `researcherFindings` lets the Consolidator quote it as backstage
  //    context per the one-voice rule (design-system.md §10.1).
  let consolidator: ConsolidatorResult;
  try {
    consolidator = await consolidate(
      {
        userId: input.userId,
        sessionId: input.sessionId,
        mode: input.mode,
        userInput: input.userInput,
        researcherFindings: researcher.text || undefined,
      },
      {
        client: deps.client,
        sessionRepo: deps.sessionRepo,
        memoryRepo: deps.memoryRepo,
        log,
      },
    );
  } catch (consolidateErr) {
    log('dispatch: consolidator threw on acquisition', consolidateErr);
    throw consolidateErr; // fail-hard per PRD §9 — route returns 500
  }

  // 3. Post-stream critic. We chain it onto the consolidator's own
  //    `done` promise so the Critic never starts before the final
  //    draft exists. `forceCritic` maps to the critic's `force` flag.
  const criticPromise: Promise<CriticResult> = consolidator.done.then(
    async ({ text }) => {
      try {
        return await critique(
          {
            userId: input.userId,
            sessionId: input.sessionId,
            draft: text,
            force: input.forceCritic === true,
          },
          {
            client: deps.client,
            sessionRepo: deps.sessionRepo,
            log,
          },
        );
      } catch (criticErr) {
        // critique() is fail-quiet internally; this is the bug-path
        // catch. Surface a no-review result — the user still saw the
        // reply, nothing to block.
        log('dispatch: critic threw unexpectedly (fail-quiet)', criticErr);
        return {
          ran: false,
          risk: 'low',
          review: null,
          tokensIn: 0,
          tokensOut: 0,
        } satisfies CriticResult;
      }
    },
  );

  const done = (async () => {
    const finalConsolidator = await consolidator.done;
    const critic = await criticPromise;
    return {
      text: finalConsolidator.text,
      mode: finalConsolidator.mode,
      researcher,
      critic,
    };
  })();

  return { stream: consolidator.stream, done };
}
