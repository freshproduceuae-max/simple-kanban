import type { CouncilMode, TaskRow } from '@/lib/persistence/types';
import type { SessionRepository } from '@/lib/persistence/session-repository';
import type { CouncilMemoryRepository } from '@/lib/persistence/council-memory-repository';
import type { MetricsRepository } from '@/lib/persistence/metrics-repository';
import { consolidate, type ConsolidatorResult } from '@/lib/council/consolidator';
import { research, type ResearcherFinding } from '@/lib/council/researcher';
import { critique, type CriticResult } from '@/lib/council/critic';
import type { AnthropicLike } from '@/lib/council/shared/client';
import { checkBudget, type BudgetCheckResult } from '@/lib/council/shared/budget-check';
import { reportAgentError } from '@/lib/council/errors/email';
import { invalidateSessionCacheBySessionId } from '@/lib/council/server/session';

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
  /** F21 — optional metrics repo; when present, agents emit per-call rows. */
  metricsRepo?: MetricsRepository;
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
    budget?: BudgetCheckResult;
  }>;
};

export async function runCouncilTurn(
  input: RunCouncilTurnInput,
  deps: RunCouncilTurnDeps,
): Promise<RunCouncilTurnResult> {
  const log = deps.log ?? ((msg, err) => console.error(msg, err));

  // 0. Pre-flight budget check (F22). A 'cut' verdict short-circuits
  //    the entire turn: no Researcher, no Consolidator, no Critic —
  //    just a calm sentence explaining the cap is hit. A 'warn' verdict
  //    proceeds normally; the banner is prepended to the streamed reply
  //    so the user sees the ceiling warning once at the top of the
  //    response. The budget module degrades to 'ok' on read failure,
  //    so a metrics outage never locks a user out of a reply.
  let budget: BudgetCheckResult | undefined;
  if (deps.metricsRepo) {
    try {
      budget = await checkBudget(
        {
          userId: input.userId,
          sessionId: input.sessionId,
          mode: input.mode,
        },
        {
          sessionRepo: deps.sessionRepo,
          metricsRepo: deps.metricsRepo,
          log,
        },
      );
    } catch (budgetErr) {
      log('dispatch: budget check threw, proceeding', budgetErr);
    }
  }

  if (budget?.verdict === 'cut' && budget.cutSentence) {
    // End the over-budget session so the next turn cannot reuse it.
    // Session-cap cuts in particular must *actually* free the user to
    // start fresh — otherwise the route echoes back the same sessionId
    // and the next turn hits the same cut. Daily-cap cuts end the
    // session too: the user won't get a reply on this session until
    // the UTC day rolls, so there's no reason to keep it open.
    try {
      await deps.sessionRepo.endSession({
        sessionId: input.sessionId,
        userId: input.userId,
      });
    } catch (endErr) {
      log('dispatch: endSession after budget cut failed', endErr);
    }
    // Drop the in-memory resolver cache entry for this session so the
    // next turn falls through to `startSession` and opens a fresh row,
    // rather than re-cutting on the same cached id.
    invalidateSessionCacheBySessionId(input.sessionId);
    // Mirror the other session-end paths (idle rollover, sign-out) by
    // writing a `session-end` summary. Budget-terminated sessions are
    // real ended sessions per PRD §10.2 / §11.1; without this row the
    // Researcher / greeting memory hand-off would skip the closure
    // entirely and future turns would lose the context that this
    // session ended because a cap was hit.
    const cutReason =
      budget.dailyUsed >= budget.dailyCap
        ? `daily token cap (${budget.dailyUsed}/${budget.dailyCap})`
        : `session token ceiling (${budget.sessionUsed}/${budget.sessionCeiling})`;
    void (async () => {
      try {
        await deps.memoryRepo.writeSummary({
          user_id: input.userId,
          session_id: input.sessionId,
          kind: 'session-end',
          content: `Session closed by budget cut — ${cutReason}. Mode: ${input.mode}.`,
        });
      } catch (summaryErr) {
        log('dispatch: writeSummary after budget cut failed (swallowed)', summaryErr);
      }
    })();

    // Operator notification (F22 §4): first daily- or session-cap hit
    // fires an email. The email module's 1-hour dedup keys on
    // (userId, agent, failureClass) — passing the specific class
    // ensures a budget cut is not suppressed by an unrelated prior
    // `unknown` failure on the same agent.
    const failureClass: 'daily_cap_hit' | 'session_cap_hit' =
      budget.dailyUsed >= budget.dailyCap ? 'daily_cap_hit' : 'session_cap_hit';
    void reportAgentError(
      {
        userId: input.userId,
        agent: 'consolidator',
        failureClass,
        message: `Budget cut (${failureClass}) — session ${budget.sessionUsed}/${budget.sessionCeiling}, daily ${budget.dailyUsed}/${budget.dailyCap}`,
        context: {
          sessionId: input.sessionId,
          mode: input.mode,
        },
      },
      { log },
    );
    return cutResult(input.mode, budget);
  }

  const warnBanner = budget?.verdict === 'warn' ? budget.banner : null;

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
        metricsRepo: deps.metricsRepo,
        errorHook: ({ failureClass, message, cause }) => {
          void reportAgentError(
            {
              userId: input.userId,
              agent: 'researcher',
              failureClass,
              message,
              context: { sessionId: input.sessionId, mode: input.mode },
              cause,
            },
            { log },
          );
        },
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
        metricsRepo: deps.metricsRepo,
        errorHook: ({ failureClass, message, cause }) => {
          void reportAgentError(
            {
              userId: input.userId,
              agent: 'consolidator',
              failureClass,
              message,
              context: { sessionId: input.sessionId, mode: input.mode },
              cause,
            },
            { log },
          );
        },
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
            metricsRepo: deps.metricsRepo,
            errorHook: ({ failureClass, message, cause }) => {
              void reportAgentError(
                {
                  userId: input.userId,
                  agent: 'critic',
                  failureClass,
                  message,
                  context: { sessionId: input.sessionId, mode: input.mode },
                  cause,
                },
                { log },
              );
            },
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
      text: warnBanner
        ? `${warnBanner}\n\n${finalConsolidator.text}`
        : finalConsolidator.text,
      mode: finalConsolidator.mode,
      researcher,
      critic,
      budget,
    };
  })();

  // When a warn banner is present, prepend it once at the top of the
  // user-visible stream. The banner goes out before any Consolidator
  // chunk so the user sees the ceiling warning first.
  const stream: AsyncIterable<string> = warnBanner
    ? prependBanner(warnBanner, consolidator.stream)
    : consolidator.stream;

  return { stream, done };
}

function prependBanner(
  banner: string,
  inner: AsyncIterable<string>,
): AsyncIterable<string> {
  return {
    async *[Symbol.asyncIterator]() {
      yield `${banner}\n\n`;
      for await (const chunk of inner) yield chunk;
    },
  };
}

function cutResult(
  mode: RunCouncilTurnInput['mode'],
  budget: BudgetCheckResult,
): RunCouncilTurnResult {
  const sentence = budget.cutSentence ?? 'Token budget reached.';
  const stream: AsyncIterable<string> = {
    async *[Symbol.asyncIterator]() {
      yield sentence;
    },
  };
  const done = Promise.resolve({
    text: sentence,
    mode: mode as CouncilMode,
    researcher: {
      ok: false,
      text: '',
      toolCalls: [],
      tokensIn: 0,
      tokensOut: 0,
    } satisfies ResearcherFinding,
    critic: {
      ran: false,
      risk: 'low',
      review: null,
      tokensIn: 0,
      tokensOut: 0,
    } satisfies CriticResult,
    budget,
  });
  return { stream, done };
}
