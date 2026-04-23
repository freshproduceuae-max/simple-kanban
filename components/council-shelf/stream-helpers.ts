'use client';

import {
  META_FRAME_PREFIX,
  peelSoftPauseFrames,
  type SoftPauseFrame,
} from '@/lib/council/shared/soft-pause-frame';

/**
 * F22a — Council stream helpers.
 *
 * The Council mode routes (`/api/council/chat|plan|advise`) all share
 * the same response shape:
 *
 *   <optional `__council_meta__:...\n` leader frames — F30 soft-pause>
 *   <streamed Consolidator text, chunk-by-chunk>
 *   \n
 *   <optional JSON trailer frame on its own final line>
 *
 * `streamCouncilReply` on the server appends the trailer as a single
 * `\n` + `JSON.stringify(payload)` chunk after the Consolidator stream
 * drains (see `lib/council/server/stream-response.ts`). The client has
 * to walk three tightropes at once:
 *
 *   1. Feed tokens to `<ThinkingStream>` in real-time, which consumes
 *      an `AsyncIterable<string>` and animates each arrival — so we
 *      cannot buffer the whole response.
 *   2. Detect the trailer frame and NOT render it as display text —
 *      otherwise the user briefly sees `{"proposals":[...]}` flash in
 *      the reply before the composer strips it.
 *   3. Peel any F30 soft-pause meta frames off the HEAD of the body
 *      and surface them via `onSoftPause` so the shelf can flip a
 *      "retried after Ns" indicator — without those bytes ever reaching
 *      the token stream.
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

export type OpenCouncilStreamOptions = {
  /**
   * F30 — fires whenever a `__council_meta__:{"type":"soft-pause",...}`
   * leader frame arrives at the head of the response body. Callers can
   * flip a turn-local "rate-limited — retried after Ns" indicator in
   * response. Frames are always emitted BEFORE any Consolidator tokens
   * (the server populates them inside `retryOn429` and flushes the
   * buffered list at stream head), so callers should treat the arrival
   * as a historical note explaining latency rather than a live
   * countdown. The callback may be invoked zero, one, or several times.
   */
  onSoftPause?: (frame: SoftPauseFrame) => void;
};

/**
 * Wrap a Response with a Council-shaped body (text/plain stream +
 * optional JSON trailer) into the live + summary pair.
 *
 * Safe to call with any `fetch` response; if `response.body` is
 * missing we resolve immediately with empty fields rather than
 * throwing — the caller can surface a "cold" error turn.
 */
export function openCouncilStream(
  response: Response,
  options: OpenCouncilStreamOptions = {},
): CouncilStreamHandle {
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
    // F30 — head-phase state. Meta frames live at the lead of the body
    // (see `lib/council/shared/soft-pause-frame.ts`); we accumulate the
    // lead into `headBuffer` and peel whole lines until either:
    //   a) a line arrives that doesn't start with the meta prefix
    //      (→ we're into Consolidator bytes — flip headDone and fold
    //      the remainder into `tail` + `full`), or
    //   b) the stream closes before any non-meta byte (→ nothing to
    //      render, a historical note at most).
    // Head-phase chunks never touch `tail` or `full`, so the existing
    // trailer-peel + fullText math operate exclusively on body bytes.
    let tail = '';
    let full = '';
    let headBuffer = '';
    let headDone = false;

    const advanceHead = (incoming: string) => {
      headBuffer += incoming;
      const { frames, rest } = peelSoftPauseFrames(headBuffer);
      for (const frame of frames) {
        try {
          options.onSoftPause?.(frame);
        } catch {
          /* a faulty callback must not kill the stream */
        }
      }
      headBuffer = rest;
      // `rest` non-empty AND NOT starting with the prefix → we are past
      // the head. Move `rest` into the regular body buffers. If `rest`
      // is empty, or still starts with a (partial) prefix, keep buffering.
      if (rest.length > 0 && !rest.startsWith(META_FRAME_PREFIX)) {
        headDone = true;
        tail += rest;
        full += rest;
        headBuffer = '';
      }
    };

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (!chunk) continue;
        if (!headDone) {
          advanceHead(chunk);
        } else {
          tail += chunk;
          full += chunk;
        }
        if (tail.length > TAIL_RESERVE) {
          const yieldable = tail.slice(0, tail.length - TAIL_RESERVE);
          tail = tail.slice(tail.length - TAIL_RESERVE);
          pump(yieldable);
        }
      }
      const flush = decoder.decode();
      if (flush) {
        if (!headDone) {
          advanceHead(flush);
        } else {
          tail += flush;
          full += flush;
        }
      }
      // Stream ended while still in head-phase. Anything left in the
      // head buffer is either (a) a trailing partial meta line the
      // server never completed, or (b) a body so short it fit entirely
      // inside the head window (e.g. a one-token reply). Flush it
      // through the normal body path so trailer-peel still runs and
      // the user sees whatever prose was sent.
      if (!headDone && headBuffer.length > 0) {
        tail += headBuffer;
        full += headBuffer;
        headBuffer = '';
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
