'use client';

/**
 * F22a — Council stream helpers.
 *
 * The Council mode routes (`/api/council/chat|plan|advise`) all share
 * the same response shape:
 *
 *   <streamed Consolidator text, chunk-by-chunk>
 *   \n
 *   <optional JSON trailer frame on its own final line>
 *
 * `streamCouncilReply` on the server appends the trailer as a single
 * `\n` + `JSON.stringify(payload)` chunk after the Consolidator stream
 * drains (see `lib/council/server/stream-response.ts`). The client has
 * to walk two tightropes at once:
 *
 *   1. Feed tokens to `<ThinkingStream>` in real-time, which consumes
 *      an `AsyncIterable<string>` and animates each arrival — so we
 *      cannot buffer the whole response.
 *   2. Detect the trailer frame and NOT render it as display text —
 *      otherwise the user briefly sees `{"proposals":[...]}` flash in
 *      the reply before the composer strips it.
 *
 * The compromise: hold back a tail-reserve window (4 KiB — plenty for
 * any realistic trailer, trivial pause in perceived streaming). Yield
 * any chunk beyond that window immediately. On stream close, inspect
 * the held tail: if it matches a trailing `\n{...JSON...}` and the
 * JSON parses, strip it; yield the remaining display text as the final
 * chunk. Otherwise yield the full tail as-is.
 *
 * `result` resolves when the stream closes with:
 *   { trailer: parsed JSON or null,
 *     fullText: display-only text (trailer already peeled off),
 *     sessionId: header echo or null }
 *
 * This helper is mode-agnostic. Per-mode trailer parsing (proposals,
 * chips, handoff) happens in the composer that consumes `result`.
 */

const TAIL_RESERVE = 4096;

export type CouncilStreamHandle = {
  /** Live token stream suitable for <ThinkingStream source=...>. */
  tokens: AsyncIterable<string>;
  /**
   * Resolves when the response body closes. `trailer` is the parsed
   * JSON trailer or null; `fullText` is the display-only text.
   */
  result: Promise<{
    trailer: unknown | null;
    fullText: string;
    sessionId: string | null;
  }>;
  /**
   * Cooperative shutdown. Cancels the underlying reader so the server
   * stops producing tokens we won't render. Safe to call multiple
   * times; safe to call after `result` has already resolved.
   *
   * Callers that unmount or navigate away before `ThinkingStream`
   * gets a chance to run `iterator.return()` must call this — the
   * alternative is an orphaned Anthropic stream burning tokens for
   * a user who already left.
   */
  cancel: () => Promise<void>;
};

/**
 * Wrap a Response with a Council-shaped body (text/plain stream +
 * optional JSON trailer) into the live + summary pair.
 *
 * Safe to call with any `fetch` response; if `response.body` is
 * missing we resolve immediately with empty fields rather than
 * throwing — the caller can surface a "cold" error turn.
 */
export function openCouncilStream(response: Response): CouncilStreamHandle {
  const sessionId = response.headers.get('x-council-session-id');

  if (!response.body) {
    return {
      tokens: (async function* () {})(),
      result: Promise.resolve({ trailer: null, fullText: '', sessionId }),
      cancel: async () => {},
    };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  // Internal queue + signal for the live iterator. We cannot use a
  // bare async generator here because we need to resolve `result`
  // from the same loop that yields tokens. Single-consumer by design
  // — `tokens` refuses a second `[Symbol.asyncIterator]()` call so
  // the single `waiter` slot cannot race two pending `.next()` calls.
  const queue: string[] = [];
  let closed = false;
  let consumed = false;
  let waiter: ((next: IteratorResult<string>) => void) | null = null;

  const pump = (chunk: string) => {
    if (waiter) {
      const w = waiter;
      waiter = null;
      w({ value: chunk, done: false });
    } else {
      queue.push(chunk);
    }
  };

  const finish = () => {
    closed = true;
    if (waiter) {
      const w = waiter;
      waiter = null;
      w({ value: undefined, done: true });
    }
  };

  const cancel = async () => {
    closed = true;
    try {
      await reader.cancel();
    } catch {
      /* best-effort — reader may already be closed */
    }
    if (waiter) {
      const w = waiter;
      waiter = null;
      w({ value: undefined, done: true });
    }
  };

  const tokens: AsyncIterable<string> = {
    [Symbol.asyncIterator]() {
      if (consumed) {
        throw new Error(
          'openCouncilStream tokens have already been iterated; handle is single-consumer.',
        );
      }
      consumed = true;
      return {
        next(): Promise<IteratorResult<string>> {
          if (queue.length > 0) {
            return Promise.resolve({ value: queue.shift()!, done: false });
          }
          if (closed) {
            return Promise.resolve({ value: undefined, done: true });
          }
          return new Promise((resolve) => {
            waiter = resolve;
          });
        },
        async return(): Promise<IteratorResult<string>> {
          // Cooperative shutdown: unmount or error on the consumer
          // side. Cancel the underlying reader so the server can stop
          // producing tokens we'll never render.
          await cancel();
          return { value: undefined, done: true };
        },
      };
    },
  };

  const result = (async () => {
    let tail = '';
    let full = '';
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (!chunk) continue;
        tail += chunk;
        full += chunk;
        if (tail.length > TAIL_RESERVE) {
          const yieldable = tail.slice(0, tail.length - TAIL_RESERVE);
          tail = tail.slice(tail.length - TAIL_RESERVE);
          pump(yieldable);
        }
      }
      const flush = decoder.decode();
      if (flush) {
        tail += flush;
        full += flush;
      }
    } catch {
      // Network or reader failure. Surface what we have so far — the
      // composer decides how to present partial results.
    }

    const { trailer, displayTail } = peelTrailer(tail);
    if (displayTail.length > 0) pump(displayTail);
    finish();

    const peeledLength = tail.length - displayTail.length;
    const fullText = peeledLength > 0 ? full.slice(0, full.length - peeledLength) : full;
    return { trailer, fullText, sessionId };
  })();

  return { tokens, result, cancel };
}

/**
 * Split a held tail into the trailer JSON and the leftover display
 * text. Matches the LAST `\n{...}` substring whose body parses. If no
 * match parses, returns the tail unchanged.
 *
 * We do greedy right-to-left matching rather than a single regex so a
 * reply that legitimately contains `\n{...}` in its prose (e.g. the
 * user pasted JSON into the conversation) still parses correctly when
 * the trailer is the LAST one.
 */
export function peelTrailer(tail: string): {
  trailer: unknown | null;
  displayTail: string;
} {
  // Walk backward through `\n{` candidates.
  let searchFrom = tail.length;
  while (searchFrom > 0) {
    const nlAt = tail.lastIndexOf('\n{', searchFrom - 1);
    if (nlAt === -1) break;
    const candidate = tail.slice(nlAt + 1).trimEnd();
    if (candidate.endsWith('}')) {
      try {
        const parsed = JSON.parse(candidate);
        if (parsed !== null && typeof parsed === 'object') {
          return { trailer: parsed, displayTail: tail.slice(0, nlAt) };
        }
      } catch {
        /* try the next candidate */
      }
    }
    searchFrom = nlAt;
  }
  return { trailer: null, displayTail: tail };
}
