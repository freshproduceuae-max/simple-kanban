import type {
  CouncilMemorySummaryRow,
  CouncilMode,
  TaskRow,
} from '@/lib/persistence/types';
import type { CouncilMemoryRepository } from '@/lib/persistence/council-memory-repository';
import type { MetricsRepository } from '@/lib/persistence/metrics-repository';
import type { SessionRepository } from '@/lib/persistence/session-repository';
import { COUNCIL_MODEL, getAnthropicClient, type AnthropicLike } from '../shared/client';
import { classifyOutcome, recordMetric } from '../shared/instrument';
import { retryOn429, type SoftPauseInfo } from '../shared/retry-on-429';

/**
 * F09 — Researcher agent.
 *
 * One agent, two sources:
 *   - public web (Plan mode only, per-session rate limited ≤ 10 calls)
 *   - internal board/memory (always available)
 *
 * Fail-visible: on any error the Researcher returns an honest one-liner
 * to the Consolidator instead of throwing. That sentence gets woven
 * into the reply as-is, with no cover-up. See PRD §9 failure policy.
 *
 * Tool calls + findings persist to council_turns via SessionRepository.
 * Real web tool wiring lands here — we send the Anthropic web_search
 * tool when web is enabled; when web is off we send memory/board only.
 */

export type ResearcherInput = {
  userId: string;
  sessionId: string;
  mode: CouncilMode;
  /** User-facing query. Used to frame the Researcher prompt. */
  query: string;
  /** Board snapshot for memory-only research (todo/in_progress/done counts etc.). */
  boardSnapshot?: Pick<TaskRow, 'id' | 'title' | 'board_column' | 'overdue_at'>[];
  /** Whether this turn is allowed to hit the public web. Plan only. */
  webEnabled: boolean;
};

/**
 * Structured handle on a memory summary the Researcher surfaced into
 * the Consolidator's system prompt. F24 uses this to persist a
 * `memory_recalls` row per surfaced summary and to render the inline
 * "I remembered from …" reveal. `content` is the raw summary text (the
 * dispatch layer truncates it for display); `sessionId` + `createdAt`
 * label the source session.
 */
export type ResearcherRecalledSummary = {
  id: string;
  content: string;
  sessionId: string;
  createdAt: string;
};

export type ResearcherFinding = {
  ok: boolean;
  /** Always populated — on failure this is the honest one-liner. */
  text: string;
  toolCalls: unknown[];
  tokensIn: number;
  tokensOut: number;
  /**
   * F24 — memory summaries surfaced into the Consolidator's system
   * prompt this turn. Empty array when no prior-session summaries were
   * available (new users, memory read failure, degraded path).
   */
  recalledSummaries: ResearcherRecalledSummary[];
};

export type ResearcherDeps = {
  client?: AnthropicLike;
  sessionRepo: SessionRepository;
  memoryRepo: CouncilMemoryRepository;
  /** F21 — optional metrics repo for per-call observability. */
  metricsRepo?: MetricsRepository;
  /** F20 — optional error hook; dispatch wires this to the Resend pipeline. */
  errorHook?: (info: {
    failureClass: 'anthropic_error' | 'anthropic_429' | 'unknown';
    message: string;
    cause?: unknown;
  }) => void;
  /**
   * F30 — fires when the Anthropic call is 429'd and we're about to
   * sleep before a retry. Dispatch wires this into the soft-pause meta
   * frame stream so the shelf can render a countdown indicator. The
   * Researcher only invokes the hook when one is supplied; no-op when
   * omitted so standalone tests don't need a stub.
   */
  onSoftPause?: (info: SoftPauseInfo) => void;
  /**
   * F30 — test hook. Overrides the retry wrapper's sleep so unit tests
   * don't wait real wall-clock between backoff attempts. Production
   * leaves this unset and the default `setTimeout` sleep is used.
   */
  retrySleep?: (ms: number) => Promise<void>;
  /** Optional logger (defaults to console.error on failure path). */
  log?: (msg: string, err: unknown) => void;
};

/**
 * Per-session web-call rate limit. PRD §7 + features.json F15/F16/F17:
 *   - Plan mode   ≤ 10 web calls per session (Researcher web always on)
 *   - Advise mode ≤  5 web calls per session (only after user confirm)
 *   - Chat mode   ≤  5 web calls per session (only on explicit request)
 *   - Greeting    web disabled; no counter touched
 *
 * In-memory Map is fine for v0.4 (single-process Vercel serverless;
 * state is per-invocation). A real multi-region quota lands at F22.
 * Keyed by `${mode}:${sessionId}` so Plan and Chat usage in the same
 * session don't cross-subsidize each other's caps.
 */
export const WEB_CALLS_PER_SESSION_MAX_BY_MODE: Readonly<
  Record<CouncilMode, number>
> = {
  plan: 10,
  advise: 5,
  chat: 5,
  greeting: 0,
};

const webCallCountByKey = new Map<string, number>();

export function __resetWebRateLimitForTests(): void {
  webCallCountByKey.clear();
}

function rateLimitKey(mode: CouncilMode, sessionId: string): string {
  return `${mode}:${sessionId}`;
}

function incrementWebCallCount(mode: CouncilMode, sessionId: string): number {
  const key = rateLimitKey(mode, sessionId);
  const next = (webCallCountByKey.get(key) ?? 0) + 1;
  webCallCountByKey.set(key, next);
  return next;
}

/**
 * The Researcher is fail-visible: if it fails, the user sees an honest
 * sentence, not a silent retry. This is the canonical one-liner.
 */
export const RESEARCHER_FAIL_SENTENCE =
  "I couldn't check external sources this turn.";

function buildPrompt(input: ResearcherInput): string {
  const boardLines =
    input.boardSnapshot?.map(
      (t) =>
        `- [${t.board_column}] ${t.title}${t.overdue_at ? ' (overdue)' : ''}`
    ) ?? [];
  return [
    `Mode: ${input.mode}.`,
    `User query: ${input.query}`,
    boardLines.length > 0
      ? `Current board:\n${boardLines.join('\n')}`
      : 'Board: no tasks on record.',
    input.webEnabled
      ? 'Web research is enabled for this turn. Use it if the query needs external facts.'
      : 'Web research is disabled for this turn. Use only the board and memory summaries.',
    'Return a concise, plain-prose finding the Consolidator can quote. No headings, no emoji.',
  ].join('\n\n');
}

export async function research(
  input: ResearcherInput,
  deps: ResearcherDeps
): Promise<ResearcherFinding> {
  const client = deps.client ?? getAnthropicClient();
  const log = deps.log ?? ((msg, err) => console.error(msg, err));

  // Mode-aware rate limit. Only counts when web is actually enabled.
  // Each mode keeps its own counter (see WEB_CALLS_PER_SESSION_MAX_BY_MODE).
  if (input.webEnabled) {
    const cap = WEB_CALLS_PER_SESSION_MAX_BY_MODE[input.mode] ?? 0;
    const used = incrementWebCallCount(input.mode, input.sessionId);
    if (used > cap) {
      // Not an error — the calm one-liner tells the user we hit the
      // cap. Consolidator weaves it in as the finding. No memory read
      // happens on this fast-return path, so recalledSummaries is
      // empty — the rate-limit turn doesn't surface prior-session
      // context anyway.
      return {
        ok: true,
        text: "I've already reached this session's web-research limit; staying with what we have.",
        toolCalls: [],
        tokensIn: 0,
        tokensOut: 0,
        recalledSummaries: [],
      };
    }
  }

  const callStartedAt = new Date().toISOString();
  const startMs = Date.now();
  try {
    // Pull recent memory summaries for context. The memory repo is
    // still NotImplemented until F18, but F15/F16/F17 depend on F09
    // and not F18 — so we degrade to "no prior summaries" instead of
    // collapsing the whole research turn when the read fails. Real
    // SDK failure still falls through to the outer fail-visible path.
    let summaries: CouncilMemorySummaryRow[] = [];
    try {
      summaries = await deps.memoryRepo.listSummariesForUser(
        input.userId,
        5
      );
    } catch (memErr) {
      log(
        'researcher: memory read unavailable, degrading to no-summaries',
        memErr
      );
    }
    const memoryBlock =
      summaries.length > 0
        ? summaries.map((s) => `- ${s.content}`).join('\n')
        : '(no prior-session summaries yet)';
    // F24 — expose the structured summaries so dispatch can persist a
    // recall row per surfaced summary and render the "I remembered …"
    // reveal. We keep all four fields because the UI needs date
    // attribution and the persistence layer needs the summary id as
    // part of the audit trail embedded in `snippet`.
    const recalledSummaries: ResearcherRecalledSummary[] = summaries.map((s) => ({
      id: s.id,
      content: s.content,
      sessionId: s.session_id,
      createdAt: s.created_at,
    }));

    // The Anthropic server-side web_search tool isn't fully typed in
    // @anthropic-ai/sdk@0.39; we cast the tool descriptor locally.
    // When the SDK adds the type we'll drop the cast.
    const webTool = {
      type: 'web_search_20250305',
      name: 'web_search',
    } as unknown as Parameters<typeof client.messages.create>[0]['tools'] extends
      | Array<infer T>
      | undefined
      ? T
      : never;

    const response = await retryOn429({
      attempt: () =>
        client.messages.create({
          model: COUNCIL_MODEL,
          max_tokens: 1024,
          system: `You are the Council's research agent, backstage. Return a compact plain-prose finding for the Consolidator.\nMemory summaries:\n${memoryBlock}`,
          messages: [{ role: 'user', content: buildPrompt(input) }],
          // Web tool is only attached in Plan mode.
          ...(input.webEnabled ? { tools: [webTool] } : {}),
        }),
      onBackoff: (info) => {
        deps.onSoftPause?.(info);
      },
      sleep: deps.retrySleep,
    });

    const text = extractText(response);
    const toolCalls = extractToolCalls(response);
    const tokensIn = response.usage?.input_tokens ?? 0;
    const tokensOut = response.usage?.output_tokens ?? 0;

    // Persist the Researcher turn (fail-visible even for log writes —
    // we swallow write errors so the user-facing turn is not blocked).
    try {
      await deps.sessionRepo.appendTurn({
        session_id: input.sessionId,
        user_id: input.userId,
        agent: 'researcher',
        role: toolCalls.length > 0 ? 'tool' : 'assistant',
        content: text,
        tool_calls: toolCalls.length > 0 ? toolCalls : null,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
      });
    } catch (writeErr) {
      log('researcher: turn write failed', writeErr);
    }

    if (deps.metricsRepo) {
      void recordMetric(
        {
          userId: input.userId,
          sessionId: input.sessionId,
          agent: 'researcher',
          callStartedAt,
          firstTokenMs: null,
          fullReplyMs: Date.now() - startMs,
          tokensIn,
          tokensOut,
          outcome: 'ok',
        },
        { metricsRepo: deps.metricsRepo, log },
      );
    }

    return {
      ok: true,
      text,
      toolCalls,
      tokensIn,
      tokensOut,
      recalledSummaries,
    };
  } catch (err) {
    log('researcher: call failed', err);
    if (deps.errorHook) {
      const message = err instanceof Error ? err.message : String(err);
      const failureClass = /429|rate/i.test(message)
        ? 'anthropic_429'
        : /anthropic|claude|overloaded|\b5\d\d\b/i.test(message)
          ? 'anthropic_error'
          : 'unknown';
      deps.errorHook({ failureClass, message, cause: err });
    }
    if (deps.metricsRepo) {
      void recordMetric(
        {
          userId: input.userId,
          sessionId: input.sessionId,
          agent: 'researcher',
          callStartedAt,
          firstTokenMs: null,
          fullReplyMs: Date.now() - startMs,
          tokensIn: 0,
          tokensOut: 0,
          outcome: classifyOutcome(err),
        },
        { metricsRepo: deps.metricsRepo, log },
      );
    }
    return {
      ok: false,
      text: RESEARCHER_FAIL_SENTENCE,
      toolCalls: [],
      tokensIn: 0,
      tokensOut: 0,
      recalledSummaries: [],
    };
  }
}

/** Pull plain text out of an Anthropic non-streaming response. */
function extractText(response: {
  content: Array<{ type: string; text?: string }>;
}): string {
  return response.content
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text as string)
    .join('')
    .trim();
}

/** Pull tool-use blocks out of an Anthropic non-streaming response. */
function extractToolCalls(response: {
  content: Array<{ type: string; name?: string; input?: unknown; id?: string }>;
}): unknown[] {
  return response.content
    .filter((b) => b.type === 'tool_use')
    .map((b) => ({ id: b.id, name: b.name, input: b.input }));
}
