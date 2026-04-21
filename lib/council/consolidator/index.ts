import type { CouncilMode } from '@/lib/persistence/types';
import type { SessionRepository } from '@/lib/persistence/session-repository';
import type { CouncilMemoryRepository } from '@/lib/persistence/council-memory-repository';
import { COUNCIL_MODEL, getAnthropicClient, type AnthropicLike } from '../shared/client';
import { COUNCIL_VOICE_STYLEBOOK } from '../shared/voice';

/**
 * F10 — Consolidator agent.
 *
 * The user-facing voice. Streams tokens as an AsyncIterable<string> for
 * F08 ThinkingStream to consume directly. Writes the user turn
 * synchronously before streaming starts and the assistant turn after
 * the stream completes. On SDK error: one retry, then surfaces a calm
 * failure sentence as the final reply.
 *
 * Mode classification (Plan/Advise/Chat) is a lightweight rule-based
 * pass so it runs offline-testable — tests don't need another mock
 * Anthropic pass just to pick a mode.
 */

export type ConsolidatorInput = {
  userId: string;
  sessionId: string;
  /** If omitted, classified from userInput. */
  mode?: CouncilMode;
  userInput: string;
  /** Researcher finding text — woven into the system prompt. */
  researcherFindings?: string;
};

export type ConsolidatorDeps = {
  client?: AnthropicLike;
  sessionRepo: SessionRepository;
  memoryRepo: CouncilMemoryRepository;
  log?: (msg: string, err: unknown) => void;
};

export type ConsolidatorResult = {
  stream: AsyncIterable<string>;
  done: Promise<{ text: string; tokensIn: number; tokensOut: number; mode: CouncilMode }>;
};

export const CONSOLIDATOR_FAIL_SENTENCE =
  "I'm not able to answer cleanly right now. Let's try again in a moment.";

/**
 * Lightweight rule-based classifier. Plan-intent words go to Plan;
 * advise-intent words go to Advise; everything else is Chat. Deliberate
 * low-tech — a mis-classification degrades gracefully (user just gets a
 * slightly different framing).
 */
export function classifyMode(userInput: string): CouncilMode {
  const text = userInput.toLowerCase();
  const planWords = ['plan', 'break down', 'roadmap', 'kick off', "let's start", 'design', 'new project'];
  const adviseWords = ['advice', 'advise', 'should i', 'what do you think', 'take a look', 'review'];
  if (planWords.some((w) => text.includes(w))) return 'plan';
  if (adviseWords.some((w) => text.includes(w))) return 'advise';
  return 'chat';
}

/**
 * Minimal streaming-event shape we need from the SDK. The real
 * @anthropic-ai/sdk types are richer; we only care about content_block
 * deltas carrying text and message_delta carrying usage.
 */
type StreamEvent =
  | { type: 'content_block_delta'; delta: { type: string; text?: string } }
  | { type: 'message_delta'; usage?: { output_tokens?: number } }
  | { type: 'message_start'; message?: { usage?: { input_tokens?: number } } }
  | { type: string };

function buildSystemPrompt(mode: CouncilMode, researcherFindings?: string): string {
  const modeHint = {
    plan:
      "Mode: Plan. You are shaping a new piece of work. Be concrete, numbered if it helps. " +
      // F16 — append a fenced structured frame the Plan route parses to
      // create one proposal row per draft task. The fence is required
      // for the route to surface proposal cards; omit `chips` when the
      // topic is concrete enough to stand on its own.
      'At the very end of your reply, append a fenced code block tagged `json-plan` ' +
      'containing JSON of the form ' +
      '`{ "tasks": ["title one", "title two"], "chips": ["scope?", "by when?"] }`. ' +
      'Include only the tasks you actually want to draft. Omit the `chips` field unless ' +
      'a short follow-up question would genuinely sharpen the draft.',
    advise: "Mode: Advise. You are reacting to the user's current board. Be brief. No committed board changes.",
    chat: "Mode: Chat. Ordinary exchange. Be present, not verbose.",
    greeting: 'Mode: Greeting. Two short sentences, under 200 characters total.',
  }[mode];

  return [
    COUNCIL_VOICE_STYLEBOOK,
    modeHint,
    researcherFindings
      ? `Researcher finding (backstage — do not cite by that name):\n${researcherFindings}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

async function persistTurn(
  deps: ConsolidatorDeps,
  args: {
    sessionId: string;
    userId: string;
    agent: 'user' | 'consolidator';
    content: string;
    tokensIn?: number;
    tokensOut?: number;
  }
): Promise<void> {
  try {
    await deps.sessionRepo.appendTurn({
      session_id: args.sessionId,
      user_id: args.userId,
      agent: args.agent === 'user' ? 'user' : 'consolidator',
      role: args.agent === 'user' ? 'user' : 'assistant',
      content: args.content,
      tool_calls: null,
      tokens_in: args.tokensIn ?? null,
      tokens_out: args.tokensOut ?? null,
    });
  } catch (err) {
    (deps.log ?? console.error)('consolidator: turn write failed', err);
  }
}

async function attemptStream(
  client: AnthropicLike,
  system: string,
  userInput: string
): Promise<AsyncIterable<StreamEvent>> {
  // Cast required: the SDK returns overloaded types; we only consume
  // the shared event shape.
  const raw = await client.messages.create({
    model: COUNCIL_MODEL,
    max_tokens: 2048,
    system,
    messages: [{ role: 'user', content: userInput }],
    stream: true,
  });
  return raw as unknown as AsyncIterable<StreamEvent>;
}

export async function consolidate(
  input: ConsolidatorInput,
  deps: ConsolidatorDeps
): Promise<ConsolidatorResult> {
  const client = deps.client ?? getAnthropicClient();
  const log = deps.log ?? ((msg, err) => console.error(msg, err));
  const mode = input.mode ?? classifyMode(input.userInput);
  const system = buildSystemPrompt(mode, input.researcherFindings);

  // Write the user turn BEFORE streaming starts. If this fails we still
  // reply — the user should not be punished for a persistence flake.
  await persistTurn(deps, {
    sessionId: input.sessionId,
    userId: input.userId,
    agent: 'user',
    content: input.userInput,
  });

  // No per-turn summary write here. F18 wires the real session-end
  // summary via `finalizeSession` in `lib/council/server/session.ts`
  // on idle rollover. An empty `session-pending` placeholder per turn
  // would bloat `council_memory_summaries` and pollute Researcher /
  // greeting reads, which fetch the newest summaries without filtering
  // on non-empty content.

  // One retry, then surface the failure sentence. The retry wraps the
  // stream *acquisition*, not the streaming itself (a mid-stream error
  // is surfaced as failure directly — can't cleanly resume).
  let stream: AsyncIterable<StreamEvent>;
  try {
    stream = await attemptStream(client, system, input.userInput);
  } catch (firstErr) {
    log('consolidator: attempt 1 failed, retrying', firstErr);
    try {
      stream = await attemptStream(client, system, input.userInput);
    } catch (secondErr) {
      log('consolidator: attempt 2 failed, surfacing', secondErr);
      return failStream(deps, input, mode);
    }
  }

  // Drive two consumers of the same underlying stream: one yields text
  // chunks to the caller (F08), the other accumulates the full reply
  // and usage counts so we can persist the assistant turn at the end.
  const chunks: string[] = [];
  let tokensIn = 0;
  let tokensOut = 0;

  // Single emit point for every text fragment the consumer will see.
  // Keeping this as the ONLY way to produce an output token guarantees
  // `chunks` and the yielded stream stay in lock-step — including the
  // mid-stream recovery path. `finalize()` persists `chunks.join('')`
  // and resolves `done` with the same text, so any consumer of `done`
  // (critic, metrics, session log) sees exactly what the user saw.
  const emit = (text: string): string => {
    chunks.push(text);
    return text;
  };

  const passthrough: AsyncIterable<string> = {
    async *[Symbol.asyncIterator]() {
      try {
        for await (const event of stream) {
          if (
            event.type === 'message_start' &&
            'message' in event &&
            event.message?.usage?.input_tokens !== undefined
          ) {
            tokensIn = event.message.usage.input_tokens;
          }
          if (
            event.type === 'content_block_delta' &&
            'delta' in event &&
            event.delta?.type === 'text_delta' &&
            typeof event.delta.text === 'string'
          ) {
            yield emit(event.delta.text);
          }
          if (
            event.type === 'message_delta' &&
            'usage' in event &&
            event.usage?.output_tokens !== undefined
          ) {
            tokensOut = event.usage.output_tokens;
          }
        }
      } catch (err) {
        log('consolidator: mid-stream error', err);
        // Recovery tokens must also go through emit() so the persisted
        // reply matches the rendered reply.
        yield emit(' ');
        yield emit(CONSOLIDATOR_FAIL_SENTENCE);
      }
    },
  };

  let resolveDone!: (v: {
    text: string;
    tokensIn: number;
    tokensOut: number;
    mode: CouncilMode;
  }) => void;
  const done = new Promise<{
    text: string;
    tokensIn: number;
    tokensOut: number;
    mode: CouncilMode;
  }>((r) => {
    resolveDone = r;
  });

  // Finalization runs exactly once — whether the caller drained the
  // stream fully, cancelled via `iterator.return()`, or the underlying
  // iteration threw. F08's ThinkingStream explicitly calls `return()`
  // on unmount/source change, so cancellation is the common case, not
  // the edge.
  let finalized = false;
  const finalize = async (): Promise<void> => {
    if (finalized) return;
    finalized = true;
    const text = chunks.join('');
    await persistTurn(deps, {
      sessionId: input.sessionId,
      userId: input.userId,
      agent: 'consolidator',
      content: text,
      tokensIn,
      tokensOut,
    });
    resolveDone({ text, tokensIn, tokensOut, mode });
  };

  // Wrap the passthrough so that persistence + done-resolution happen
  // exactly once regardless of how iteration terminates (normal end,
  // caller `return()`, or error). `try/finally` in the async generator
  // ensures the finalize step is reached even when the consumer
  // cancels mid-stream.
  const wrapped: AsyncIterable<string> = {
    async *[Symbol.asyncIterator]() {
      try {
        for await (const chunk of passthrough) yield chunk;
      } finally {
        await finalize();
      }
    },
  };

  return { stream: wrapped, done };
}

function failStream(
  deps: ConsolidatorDeps,
  input: ConsolidatorInput,
  mode: CouncilMode
): ConsolidatorResult {
  const stream: AsyncIterable<string> = {
    async *[Symbol.asyncIterator]() {
      yield CONSOLIDATOR_FAIL_SENTENCE;
    },
  };
  const done = (async () => {
    await persistTurn(deps, {
      sessionId: input.sessionId,
      userId: input.userId,
      agent: 'consolidator',
      content: CONSOLIDATOR_FAIL_SENTENCE,
      tokensIn: 0,
      tokensOut: 0,
    });
    return { text: CONSOLIDATOR_FAIL_SENTENCE, tokensIn: 0, tokensOut: 0, mode };
  })();
  return { stream, done };
}
