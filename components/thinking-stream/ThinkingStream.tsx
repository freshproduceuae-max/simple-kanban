'use client';

/**
 * Thinking-stream component — F08.
 * Muted cursor + token-by-token reveal + variable cadence + ~50ms fade.
 * Real streaming integration lands at Phase 11.
 */
export function ThinkingStream({ text = '', isStreaming = false }: { text?: string; isStreaming?: boolean }) {
  return (
    <span data-thinking-stream="true">
      {text}
      {isStreaming ? <span aria-hidden className="opacity-60">▍</span> : null}
    </span>
  );
}
