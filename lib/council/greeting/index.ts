import type { TaskRow } from '@/lib/persistence/types';
import type { CouncilMemoryRepository } from '@/lib/persistence/council-memory-repository';
import type { MetricsRepository } from '@/lib/persistence/metrics-repository';
import type { SessionRepository } from '@/lib/persistence/session-repository';
import { COUNCIL_MODEL, getAnthropicClient, type AnthropicLike } from '../shared/client';
import { COUNCIL_VOICE_STYLEBOOK } from '../shared/voice';
import { classifyOutcome, recordMetric } from '../shared/instrument';
import { checkBudget } from '../shared/budget-check';

/**
 * F14 — Morning greeting composer.
 *
 * Hot-path invariants (PRD §6.1, vision §9):
 *   - Memory-only. **No live web research.** We never attach a tool.
 *   - First calendar-day open only → full greeting. Subsequent opens
 *     get the shorter re-entry line. The "first of the day" decision
 *     is made by the route handler (it knows the user's last-session
 *     timestamp); this module just composes whichever message the
 *     caller asked for.
 *   - Final rendered text ≤ 200 characters or 2 sentences, whichever
 *     is shorter. We trim/cap on our side rather than hoping the
 *     model cooperates — cheap insurance.
 *
 * Content model allowed (PRD §6.1):
 *   - todo / in_progress / done counts
 *   - overdue count + top-1 overdue title (if ≤ 40 chars, else generic)
 *   - days-since-last-session
 *   - may NOT cite full card descriptions or cards older than 30 days
 *
 * The module exposes two entry points:
 *   - `composeFullGreeting` — streams via Anthropic with the allowed
 *     signals only, then caps the final text.
 *   - `shortReentryLine` — a pure string the route returns without
 *     an SDK call. Mirrors the example from PRD §6.1.
 */

export const GREETING_MAX_CHARS = 200;
export const GREETING_MAX_SENTENCES = 2;
/** Staleness horizon from PRD §6.1 — cards older than this never cited. */
export const GREETING_STALENESS_HORIZON_DAYS = 30;
/** Anthropic max_tokens on the greeting call; vision §9 caps the session at 5k. */
const GREETING_MAX_TOKENS = 300;

export type GreetingBoardSnapshot = {
  tasks: Array<Pick<TaskRow, 'id' | 'title' | 'board_column' | 'overdue_at' | 'created_at'>>;
  daysSinceLastSession: number | null;
};

export type GreetingSignals = {
  todo: number;
  inProgress: number;
  done: number;
  overdue: number;
  /** Display title for the top-1 overdue by staleness; null if none. */
  topOverdueTitle: string | null;
  daysSinceLastSession: number | null;
};

export type ComposeGreetingInput = {
  userId: string;
  signals: GreetingSignals;
};

export type ComposeGreetingDeps = {
  client?: AnthropicLike;
  memoryRepo: CouncilMemoryRepository;
  /** F21 — optional metrics repo for per-call observability. */
  metricsRepo?: MetricsRepository;
  /** F22 — optional session repo; required alongside metricsRepo for budget check. */
  sessionRepo?: SessionRepository;
  log?: (msg: string, err: unknown) => void;
};

export type ComposeGreetingResult = {
  stream: AsyncIterable<string>;
  done: Promise<{ text: string; tokensIn: number; tokensOut: number }>;
};

export const GREETING_FAIL_SENTENCE = 'Good morning.';
export const SHORT_REENTRY_LINE = 'Welcome back.';

/**
 * Reduce a raw board snapshot to the exact fields the greeting is
 * allowed to cite. Pure — tests assert the gating (stale cards not
 * cited, long titles genericized, no description leakage).
 */
export function deriveGreetingSignals(
  snapshot: GreetingBoardSnapshot,
  now: Date = new Date(),
): GreetingSignals {
  const horizon = now.getTime() - GREETING_STALENESS_HORIZON_DAYS * 24 * 60 * 60 * 1000;
  const fresh = snapshot.tasks.filter(
    (t) => new Date(t.created_at).getTime() >= horizon,
  );

  let todo = 0;
  let inProgress = 0;
  let done = 0;
  let overdue = 0;
  let topOverdue: { title: string; overdueAt: number } | null = null;
  for (const t of fresh) {
    if (t.board_column === 'todo') todo++;
    else if (t.board_column === 'in_progress') inProgress++;
    else if (t.board_column === 'done') done++;
    if (t.overdue_at) {
      overdue++;
      const due = new Date(t.overdue_at).getTime();
      if (due <= now.getTime() && (!topOverdue || due < topOverdue.overdueAt)) {
        topOverdue = { title: t.title, overdueAt: due };
      }
    }
  }

  const topOverdueTitle =
    topOverdue == null
      ? null
      : topOverdue.title.length <= 40
        ? topOverdue.title
        : 'a long-running card';

  return {
    todo,
    inProgress,
    done,
    overdue,
    topOverdueTitle,
    daysSinceLastSession: snapshot.daysSinceLastSession,
  };
}

/** Cap the composed greeting to ≤ 2 sentences AND ≤ 200 chars. */
export function capGreeting(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return GREETING_FAIL_SENTENCE;

  // Sentence cap: keep up to the first two sentence terminators.
  const sentences: string[] = [];
  let buf = '';
  for (const ch of trimmed) {
    buf += ch;
    if (ch === '.' || ch === '?' || ch === '!') {
      sentences.push(buf.trim());
      buf = '';
      if (sentences.length >= GREETING_MAX_SENTENCES) break;
    }
  }
  const joined = (sentences.length > 0 ? sentences.join(' ') : trimmed).trim();

  // Character cap: hard-truncate, backing off to the last word boundary
  // so we don't leave a severed token. Appends an ellipsis character
  // if truncation occurred.
  if (joined.length <= GREETING_MAX_CHARS) return joined;
  const slice = joined.slice(0, GREETING_MAX_CHARS - 1);
  const lastSpace = slice.lastIndexOf(' ');
  const safe = lastSpace > 0 ? slice.slice(0, lastSpace) : slice;
  return safe.trimEnd() + '…';
}

function buildSystemPrompt(signals: GreetingSignals, memorySnippet: string): string {
  const boardLine = [
    `${signals.todo} todo`,
    `${signals.inProgress} in progress`,
    `${signals.done} done`,
    signals.overdue > 0 ? `${signals.overdue} overdue` : null,
  ]
    .filter(Boolean)
    .join(', ');

  const overdueLine = signals.topOverdueTitle
    ? `Top overdue: ${signals.topOverdueTitle}.`
    : 'No overdue items.';

  const cadenceLine =
    signals.daysSinceLastSession == null
      ? 'First session on record.'
      : signals.daysSinceLastSession <= 1
        ? 'User was here yesterday.'
        : `User last here ${signals.daysSinceLastSession} days ago.`;

  return [
    COUNCIL_VOICE_STYLEBOOK,
    'Mode: Greeting. Write two short sentences, maximum, under 200 characters total.',
    'Do NOT use emoji. Do NOT cite full card descriptions. Do NOT promise action.',
    `Board state: ${boardLine}.`,
    overdueLine,
    cadenceLine,
    memorySnippet,
  ]
    .filter(Boolean)
    .join('\n\n');
}

type StreamEvent =
  | { type: 'content_block_delta'; delta: { type: string; text?: string } }
  | { type: 'message_delta'; usage?: { output_tokens?: number } }
  | { type: 'message_start'; message?: { usage?: { input_tokens?: number } } }
  | { type: string };

export async function composeFullGreeting(
  input: ComposeGreetingInput,
  deps: ComposeGreetingDeps,
): Promise<ComposeGreetingResult> {
  const client = deps.client ?? getAnthropicClient();
  const log = deps.log ?? ((msg, err) => console.error(msg, err));

  // Memory-only: pull up to 3 prior summaries. Greeting degrades to
  // "no prior summaries" on a stub throw — the greeting must still
  // render per PRD §6.1 even on a cold start.
  let memorySnippet = '';
  try {
    const summaries = await deps.memoryRepo.listSummariesForUser(input.userId, 3);
    memorySnippet =
      summaries.length > 0
        ? `Memory of recent sessions:\n${summaries.map((s) => `- ${s.content}`).join('\n')}`
        : '';
  } catch (err) {
    log('greeting: memory read unavailable, degrading to no-summaries', err);
  }

  // F22 — daily-cap pre-flight. Greeting has no session yet, so the
  // per-session ceiling is skipped; only the daily cap applies. A 'cut'
  // verdict replaces the greeting with the calm cap sentence; 'warn'
  // simply proceeds (the greeting's 200-char cap leaves no room for a
  // banner, so we intentionally swallow the warn signal here).
  if (deps.metricsRepo && deps.sessionRepo) {
    try {
      const budget = await checkBudget(
        { userId: input.userId, sessionId: null, mode: 'greeting' },
        {
          sessionRepo: deps.sessionRepo,
          metricsRepo: deps.metricsRepo,
          log,
        },
      );
      if (budget.verdict === 'cut' && budget.cutSentence) {
        const sentence = budget.cutSentence;
        const stream: AsyncIterable<string> = {
          async *[Symbol.asyncIterator]() {
            yield sentence;
          },
        };
        return {
          stream,
          done: Promise.resolve({
            text: sentence,
            tokensIn: 0,
            tokensOut: 0,
          }),
        };
      }
    } catch (err) {
      log('greeting: budget check failed, proceeding', err);
    }
  }

  const system = buildSystemPrompt(input.signals, memorySnippet);

  const callStartedAt = new Date().toISOString();
  const startMs = Date.now();
  let raw: unknown;
  try {
    raw = await client.messages.create({
      model: COUNCIL_MODEL,
      max_tokens: GREETING_MAX_TOKENS,
      system,
      // No `tools` — memory-only hot path.
      messages: [{ role: 'user', content: 'Begin the greeting.' }],
      stream: true,
    });
  } catch (err) {
    log('greeting: stream acquisition failed', err);
    if (deps.metricsRepo) {
      void recordMetric(
        {
          userId: input.userId,
          sessionId: null,
          agent: 'consolidator',
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
    return failResult();
  }

  const stream = raw as AsyncIterable<StreamEvent>;
  const chunks: string[] = [];
  let tokensIn = 0;
  let tokensOut = 0;
  let firstTokenMs: number | null = null;
  let streamErr: unknown = null;

  // Streaming cap state. We enforce the F14 contract (≤ GREETING_MAX_CHARS
  // AND ≤ GREETING_MAX_SENTENCES) on every yielded chunk so the client
  // can never render a greeting that exceeds the cap. Fix for Codex P1
  // on PR #29: previously only `done.text` was capped, so the streamed
  // bytes could overrun the contract.
  let emittedLen = 0;
  let sentenceCount = 0;
  let stopped = false;
  const emit = (text: string): string => {
    if (firstTokenMs === null) firstTokenMs = Date.now() - startMs;
    chunks.push(text);
    return text;
  };
  const applyCap = (incoming: string): string | null => {
    if (stopped || incoming.length === 0) return null;
    let out = '';
    for (const ch of incoming) {
      if (emittedLen + out.length >= GREETING_MAX_CHARS - 1) {
        // Reserve one char for the trailing ellipsis so the emitted
        // total never exceeds GREETING_MAX_CHARS. Back off to the last
        // word boundary within `out` so we don't leave a severed token;
        // if this chunk has no space, truncate at its start — less
        // aesthetic but contract-safe.
        const room = Math.max(0, GREETING_MAX_CHARS - emittedLen - 1);
        const trimmed = out.slice(0, room);
        const lastSpace = trimmed.lastIndexOf(' ');
        out = (lastSpace > 0 ? trimmed.slice(0, lastSpace) : trimmed).trimEnd();
        out = out + '…';
        stopped = true;
        break;
      }
      out += ch;
      if (ch === '.' || ch === '!' || ch === '?') {
        sentenceCount++;
        if (sentenceCount >= GREETING_MAX_SENTENCES) {
          stopped = true;
          break;
        }
      }
    }
    emittedLen += out.length;
    return out.length > 0 ? out : null;
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
            const capped = applyCap(event.delta.text);
            if (capped !== null) yield emit(capped);
            // If the cap has been reached, keep consuming events so we
            // still collect token totals, but don't yield further text.
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
        streamErr = err;
        log('greeting: mid-stream error', err);
        const fallback = applyCap(' ' + GREETING_FAIL_SENTENCE);
        if (fallback !== null) yield emit(fallback);
      }
    },
  };

  let resolveDone!: (v: { text: string; tokensIn: number; tokensOut: number }) => void;
  const done = new Promise<{ text: string; tokensIn: number; tokensOut: number }>((r) => {
    resolveDone = r;
  });

  let finalized = false;
  const wrapped: AsyncIterable<string> = {
    async *[Symbol.asyncIterator]() {
      try {
        for await (const chunk of passthrough) yield chunk;
      } finally {
        if (!finalized) {
          finalized = true;
          const text = capGreeting(chunks.join(''));
          if (deps.metricsRepo) {
            void recordMetric(
              {
                userId: input.userId,
                sessionId: null,
                agent: 'consolidator',
                callStartedAt,
                firstTokenMs,
                fullReplyMs: Date.now() - startMs,
                tokensIn,
                tokensOut,
                outcome: streamErr ? classifyOutcome(streamErr) : 'ok',
              },
              { metricsRepo: deps.metricsRepo, log },
            );
          }
          resolveDone({ text, tokensIn, tokensOut });
        }
      }
    },
  };

  return { stream: wrapped, done };
}

function failResult(): ComposeGreetingResult {
  const stream: AsyncIterable<string> = {
    async *[Symbol.asyncIterator]() {
      yield GREETING_FAIL_SENTENCE;
    },
  };
  const done = Promise.resolve({
    text: GREETING_FAIL_SENTENCE,
    tokensIn: 0,
    tokensOut: 0,
  });
  return { stream, done };
}

/**
 * Subsequent same-day opens: one tight line. Keeps the shelf present
 * without re-greeting. Style mirrors the example in PRD §6.1.
 */
export function shortReentryLine(signals: GreetingSignals): string {
  if (signals.inProgress > 0) {
    return 'Welcome back.';
  }
  if (signals.overdue > 0) {
    return 'Welcome back. Something is past due.';
  }
  return 'Welcome back.';
}
