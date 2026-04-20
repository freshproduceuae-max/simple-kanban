'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * F08 — Thinking-stream.
 *
 * The v0.4 signature aesthetic, per design-system.md §9.2:
 *   - a muted cursor appears during Council generation
 *   - text streams token-by-token, not as a final block
 *   - each token fades opacity 0 → 1 over ~50ms
 *   - cadence variation comes from the producer; this component does
 *     not flatten it into uniform machine output
 *   - the effect must remain subtle
 *
 * Two entry modes:
 *
 *   1. `source`: an AsyncIterable<string> — the production path. Works
 *      directly with Anthropic SDK streaming, Web ReadableStreams
 *      (via `for await (...)` over the readable), or a server-emitted
 *      SSE adapter. We consume it and drive state.
 *
 *   2. `tokens` + `isStreaming`: controlled mode. Parent owns state.
 *      Used by tests and by composition where a parent (shelf message
 *      row, history replay) already has the chunks.
 *
 * Rendering contract:
 *   - one <span> per chunk (not per character), key=index, so a
 *     newly-arrived chunk animates but older chunks sit at opacity 1.
 *   - cursor follows the last chunk when streaming is active.
 */

export type ThinkingStreamProps = {
  /** Production path: async iterable of text chunks. */
  source?: AsyncIterable<string>;
  /** Controlled mode: parent-owned chunks. Ignored if `source` is set. */
  tokens?: string[];
  /** Controlled mode: parent-owned streaming flag. Ignored if `source` is set. */
  isStreaming?: boolean;
  /** Fires when the source iterable closes normally. */
  onComplete?: (full: string) => void;
  /** Fires if the source iterable throws. */
  onError?: (err: unknown) => void;
  /** Accessible label for the live region. Defaults to "Council reply". */
  label?: string;
};

export function ThinkingStream({
  source,
  tokens: controlledTokens,
  isStreaming: controlledStreaming = false,
  onComplete,
  onError,
  label = 'Council reply',
}: ThinkingStreamProps) {
  const [collectedTokens, setCollectedTokens] = useState<string[]>([]);
  const [internalStreaming, setInternalStreaming] = useState<boolean>(false);

  // Latest callback refs so the iteration effect doesn't re-run on
  // every parent render.
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  onCompleteRef.current = onComplete;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!source) return;
    let cancelled = false;
    // Capture the iterator explicitly so cleanup can call return() on
    // it. A plain `for await (... of source)` hides the iterator and
    // leaves no handle to ask the producer to stop — which means a
    // real Anthropic SDK / SSE / ReadableStream would keep running
    // after unmount, burning tokens and bandwidth. Per the async-
    // iteration spec, `return()` is the cooperative shutdown hook;
    // if a producer omits it we fall through and the local cancelled
    // flag at least keeps us from emitting post-unmount state.
    const iterator = source[Symbol.asyncIterator]();
    const chunks: string[] = [];
    setCollectedTokens([]);
    setInternalStreaming(true);

    (async () => {
      try {
        while (true) {
          const { value, done } = await iterator.next();
          if (cancelled) return;
          if (done) break;
          chunks.push(value);
          // Functional update so React batches arrivals at native
          // cadence — we do not throttle, flatten, or jitter.
          setCollectedTokens((prev) => [...prev, value]);
        }
        if (cancelled) return;
        setInternalStreaming(false);
        onCompleteRef.current?.(chunks.join(''));
      } catch (err) {
        if (cancelled) return;
        setInternalStreaming(false);
        onErrorRef.current?.(err);
      }
    })();

    return () => {
      cancelled = true;
      // Cooperative shutdown. Swallow errors from return() itself —
      // it is a best-effort signal; the producer may ignore it.
      void Promise.resolve(iterator.return?.()).catch(() => {});
    };
  }, [source]);

  const tokens = source ? collectedTokens : controlledTokens ?? [];
  const streaming = source ? internalStreaming : controlledStreaming;

  return (
    <span
      data-thinking-stream="true"
      role="status"
      aria-live="polite"
      aria-label={label}
      className="font-family-body text-size-md leading-relaxed text-ink-900"
    >
      {tokens.map((chunk, i) => (
        <span
          key={i}
          data-thinking-token={i}
          className="thinking-stream-token"
        >
          {chunk}
        </span>
      ))}
      {streaming ? (
        <span
          data-thinking-cursor="true"
          aria-hidden="true"
          className="ml-[1px] inline-block align-baseline text-ink-500"
        >
          ▍
        </span>
      ) : null}
    </span>
  );
}
