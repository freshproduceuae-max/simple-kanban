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
import { truncateRecallSnippet } from '@/lib/council/server/memory-recall-audit';
import { encodeSoftPauseFrame } from '@/lib/council/shared/soft-pause-frame';
import type { SoftPauseInfo } from '@/lib/council/shared/retry-on-429';

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
  /**
   * F30 — test hook. Overrides the retry wrapper's sleep inside every
   * agent so unit tests don't wait real wall-clock between backoff
   * attempts. Production leaves this unset.
   */
  retrySleep?: (ms: number) => Promise<void>;
  log?: (msg: string, err: unknown) => void;
};

export type RunCouncilTurnResult = {
  /** The user-visible text stream (pass straight to the HTTP body). */
  stream: AsyncIterable<string>;
  /**
   * Settles after the Consolidator stream ends AND the Critic has
   * finished (or skipped). Routes MUST await this before the HTTP
   * response closes so the Critic has a chance to persist its review.
   *
   * `preCriticText` is the raw Consolidator draft the Critic reviewed —
   * no warn banner, no fence stripping. F23 ("How I got here" reveal)
   * needs this alongside `critic.review` so the client can show the
   * user what the Council drafted next to what the Critic flagged.
   * `text` is the final, user-visible string (banner + draft); the two
   * differ only when a budget warn banner is prepended.
   */
  done: Promise<{
    text: string;
    preCriticText: string;
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

  // F30 — soft-pause frame buffer. Every 429 backoff from the
  // Researcher or Consolidator pushes a `__council_meta__:{...}\n` line
  // here. We flush this buffer at the HEAD of the user-visible stream
  // so the shelf can render a "rate-limited, retrying in Ns" indicator
  // BEFORE any Consolidator tokens arrive. All relevant retries
  // complete before the Consolidator stream starts iterating (the
  // `retryOn429` wrapper awaits its sleep inside the call chain) so
  // the buffer is guaranteed to be fully populated by the time the
  // stream is drained.
  const softPauseFrames: string[] = [];
  const collectSoftPause = (info: SoftPauseInfo) => {
    softPauseFrames.push(encodeSoftPauseFrame(info));
  };

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
        onSoftPause: collectSoftPause,
        retrySleep: deps.retrySleep,
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
      // F24 — no memory was surfaced this turn, so the recall-write
      // chain below short-circuits and no inline "I remembered …" line
      // is rendered.
      recalledSummaries: [],
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
        onSoftPause: collectSoftPause,
        retrySleep: deps.retrySleep,
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
  //
  //    F30 note: we deliberately do NOT pass `onSoftPause:
  //    collectSoftPause` here. `softPauseFrames` flushes at the HEAD of
  //    the user-visible stream — by the time a Critic 429 fires, the
  //    Consolidator stream has already started and any late push to
  //    the buffer would be invisible to the client. Critic 429s still
  //    fire the `errorHook` below, which surfaces to the Resend pipe
  //    for server-side observability. See the docstring on
  //    `CriticDeps.onSoftPause` for details.
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
            retrySleep: deps.retrySleep,
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

  // F24 — writing recall rows is chained off the Consolidator's
  // persisted turn id so we can FK each row back at the reply that
  // used the memory. The promise is launched in parallel with the
  // Critic, then awaited by `done` so the dispatch return value only
  // resolves after all post-stream writes have settled. When the
  // Consolidator's persistTurn failed (turnId === null) or the
  // Researcher surfaced nothing, we skip the write entirely — a
  // missing memory-recall row is cheap; a mis-FK'd one would be a
  // data bug.
  const recallWritesPromise = consolidator.done.then(async ({ turnId }) => {
    if (!turnId) return;
    if (researcher.recalledSummaries.length === 0) return;
    await Promise.all(
      researcher.recalledSummaries.map(async (summary) => {
        try {
          // Cap before write. The stored snippet has to match the
          // displayed one — if we persisted the full summary here, a
          // future read (F28 history replay) would pull back text
          // that overshot the tail-reserve window and pollute the
          // reveal with content the user never saw. Using the same
          // helper the trailer uses keeps the two surfaces coherent.
          const { snippet } = truncateRecallSnippet(summary.content);
          // An all-empty snippet shouldn't reach here (the Researcher
          // filters blanks), but guard anyway so we don't insert a
          // recall row with no visible body.
          if (snippet.length === 0) return;
          await deps.memoryRepo.writeRecall({
            turn_id: turnId,
            user_id: input.userId,
            // Null — v0.4 memory surfaces summaries, not individual
            // turns (see `MemoryRecallRow` JSDoc + migration 007).
            source_turn_id: null,
            snippet,
          });
        } catch (writeErr) {
          log('dispatch: writeRecall failed (swallowed)', writeErr);
        }
      }),
    );
  });

  const done = (async () => {
    const finalConsolidator = await consolidator.done;
    const critic = await criticPromise;
    // Wait for recall writes before resolving `done` so tests and
    // downstream observers (F28 history) see a consistent DB state.
    // Errors are already swallowed inside the chain; awaiting a
    // settled promise here never rejects.
    await recallWritesPromise;
    return {
      text: warnBanner
        ? `${warnBanner}\n\n${finalConsolidator.text}`
        : finalConsolidator.text,
      // What the Critic actually reviewed — raw, unbannered. F23
      // surfaces this in "How I got here" so the user can compare the
      // Council's draft against the Critic's notes.
      preCriticText: finalConsolidator.text,
      mode: finalConsolidator.mode,
      researcher,
      critic,
      budget,
    };
  })();

  // Prepend, in order:
  //   1. F30 soft-pause meta frames (each one line ending in `\n`).
  //      These go out BEFORE the banner because they describe the
  //      reason the banner/text is arriving slowly — the shelf peels
  //      them off the wire before anything is shown.
  //   2. F22 warn banner (a user-visible sentence).
  //   3. Consolidator tokens.
  //
  // When no 429 ever fired, softPauseFrames is empty and the prefix
  // collapses to just the banner (or nothing) — zero overhead on the
  // happy path.
  const stream: AsyncIterable<string> = prependFixedPrefix(
    softPauseFrames,
    warnBanner,
    consolidator.stream,
  );

  return { stream, done };
}

function prependFixedPrefix(
  metaFrames: readonly string[],
  banner: string | null,
  inner: AsyncIterable<string>,
): AsyncIterable<string> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const frame of metaFrames) yield frame;
      if (banner) yield `${banner}\n\n`;
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
    // Budget cuts never run the Consolidator, so no real draft exists.
    // Echo the cut sentence so F23 receivers can render a zero-state
    // reveal rather than crashing on an undefined field.
    preCriticText: sentence,
    mode: mode as CouncilMode,
    researcher: {
      ok: false,
      text: '',
      toolCalls: [],
      tokensIn: 0,
      tokensOut: 0,
      // Budget cuts skip the Researcher entirely — nothing was
      // surfaced, so F24 recall rendering short-circuits.
      recalledSummaries: [],
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
