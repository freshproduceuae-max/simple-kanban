import type { CouncilMode, TaskRow } from '@/lib/persistence/types';
import type { CouncilMemoryRepository } from '@/lib/persistence/council-memory-repository';
import type { SessionRepository } from '@/lib/persistence/session-repository';
import { COUNCIL_MODEL, getAnthropicClient, type AnthropicLike } from '../shared/client';

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

export type ResearcherFinding = {
  ok: boolean;
  /** Always populated — on failure this is the honest one-liner. */
  text: string;
  toolCalls: unknown[];
  tokensIn: number;
  tokensOut: number;
};

export type ResearcherDeps = {
  client?: AnthropicLike;
  sessionRepo: SessionRepository;
  memoryRepo: CouncilMemoryRepository;
  /** Optional logger (defaults to console.error on failure path). */
  log?: (msg: string, err: unknown) => void;
};

/**
 * Per-session web-call rate limit. PRD §7 + features.json F16 step 3:
 * Plan mode ≤ 10 web calls per session. In-memory Map is fine for v0.4
 * (single-process Vercel serverless; state is per-invocation). A real
 * multi-region quota lands at F22.
 */
const WEB_CALLS_PER_SESSION_MAX = 10;
const webCallCountBySession = new Map<string, number>();

export function __resetWebRateLimitForTests(): void {
  webCallCountBySession.clear();
}

function incrementWebCallCount(sessionId: string): number {
  const next = (webCallCountBySession.get(sessionId) ?? 0) + 1;
  webCallCountBySession.set(sessionId, next);
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

  // Plan-mode rate limit. In other modes web is disabled; we still
  // count nothing so the limit tracks real web calls only.
  if (input.webEnabled) {
    const used = incrementWebCallCount(input.sessionId);
    if (used > WEB_CALLS_PER_SESSION_MAX) {
      // Not an error — the calm one-liner tells the user we hit the
      // cap. Consolidator weaves it in as the finding.
      return {
        ok: true,
        text: "I've already reached this session's web-research limit; staying with what we have.",
        toolCalls: [],
        tokensIn: 0,
        tokensOut: 0,
      };
    }
  }

  try {
    // Pull recent memory summaries for context (memory-only path).
    const summaries = await deps.memoryRepo.listSummariesForUser(
      input.userId,
      5
    );
    const memoryBlock =
      summaries.length > 0
        ? summaries.map((s) => `- ${s.content}`).join('\n')
        : '(no prior-session summaries yet)';

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

    const response = await client.messages.create({
      model: COUNCIL_MODEL,
      max_tokens: 1024,
      system: `You are the Council's research agent, backstage. Return a compact plain-prose finding for the Consolidator.\nMemory summaries:\n${memoryBlock}`,
      messages: [{ role: 'user', content: buildPrompt(input) }],
      // Web tool is only attached in Plan mode.
      ...(input.webEnabled ? { tools: [webTool] } : {}),
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

    return { ok: true, text, toolCalls, tokensIn, tokensOut };
  } catch (err) {
    log('researcher: call failed', err);
    return {
      ok: false,
      text: RESEARCHER_FAIL_SENTENCE,
      toolCalls: [],
      tokensIn: 0,
      tokensOut: 0,
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
