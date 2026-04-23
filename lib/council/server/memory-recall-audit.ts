import type { ResearcherRecalledSummary } from '@/lib/council/researcher';

/**
 * F24 — Memory-recall trailer shape.
 *
 * When the Researcher surfaces prior-session summaries into the
 * Consolidator's system prompt, this fragment lets the shelf render
 * a small "I remembered from earlier" reveal next to the reply. The
 * artifact is intentionally shaped like {@link ./critic-audit.ts}:
 *   - `recalls` is empty → the route omits the fragment (nothing to
 *     reveal on a new-user turn or a memory-read failure).
 *   - Each entry carries the summary id, a display-capped `snippet`,
 *     the source session id, and the source `createdAt` so the UI can
 *     say "I remembered from <date>: …".
 *
 * The trailer fragment is a sibling of `criticAudit`; both are merged
 * into the route's JSON trailer and peeled by the client before the
 * stream is handed to the renderer.
 */
export type MemoryRecallItem = {
  /** `council_memory_summaries.id` — stable across turns. */
  id: string;
  /** Source session id (useful for F28 history filters). */
  sessionId: string;
  /** ISO timestamp the source summary was written. */
  createdAt: string;
  /**
   * The summary body, truncated to `MEMORY_RECALL_SNIPPET_CAP` chars
   * with a trailing `…` when cut. Keeps the trailer bounded.
   */
  snippet: string;
  /** True when `snippet` was truncated from the raw summary content. */
  snippetTruncated?: boolean;
};

export type MemoryRecallAudit = {
  recalls: MemoryRecallItem[];
};

/**
 * Per-recall snippet cap. The trailer carries up to
 * {@link MEMORY_RECALL_MAX_ITEMS} recalls, so the combined body is
 * bounded at ~2.4 KiB — comfortably inside the client's 4 KiB
 * tail-reserve window alongside the critic-audit fragment and the
 * proposals/chips payload. 300 chars ≈ 50-60 words, enough for a
 * session summary to land without dragging in every detail. The cap
 * ALSO applies to the persisted `memory_recalls.snippet` — keeping
 * the stored value bounded stops an accidentally-large summary row
 * from blowing up F28 history reads or the reveal when replayed.
 */
export const MEMORY_RECALL_SNIPPET_CAP = 300;

/**
 * Truncate a summary body to {@link MEMORY_RECALL_SNIPPET_CAP} chars
 * for both the trailer fragment and the persisted `memory_recalls`
 * row. Returns the capped snippet + a `truncated` flag so callers can
 * preserve the original length cue. Whitespace is right-trimmed
 * before the ellipsis so mid-word breaks don't read as "word …" with
 * a leading space.
 */
export function truncateRecallSnippet(raw: string | null | undefined): {
  snippet: string;
  truncated: boolean;
} {
  const value = raw ?? '';
  if (value.length <= MEMORY_RECALL_SNIPPET_CAP) {
    return { snippet: value, truncated: false };
  }
  return {
    snippet: value.slice(0, MEMORY_RECALL_SNIPPET_CAP).trimEnd() + '…',
    truncated: true,
  };
}

/**
 * Max recalls exposed in the trailer. The Researcher reads up to 5
 * summaries; we cap the trailer to the most recent 3 so the reveal
 * doesn't grow unbounded on heavy-memory users and the trailer stays
 * inside the peel window. 3 is also the default summary batch size
 * (`DEFAULT_SUMMARY_LIMIT = 3`), so the reveal matches what the
 * Researcher would pull on a quiet turn.
 */
export const MEMORY_RECALL_MAX_ITEMS = 3;

/**
 * Build the `memoryRecall` trailer fragment and the persisted-row
 * payloads from a Researcher finding. Returns `null` when the
 * Researcher didn't surface any summaries (common on new accounts,
 * memory-read failure, or the rate-limited fast-path) — the caller
 * emits nothing, which keeps the trailer small on the no-memory
 * common case.
 *
 * The ordering matches the Researcher's read order (desc by
 * `created_at` — newest first), so the most recent context lands
 * first in the reveal.
 */
export function buildMemoryRecallAudit(
  recalledSummaries: ResearcherRecalledSummary[],
): MemoryRecallAudit | null {
  if (!recalledSummaries || recalledSummaries.length === 0) return null;
  const items = recalledSummaries
    .slice(0, MEMORY_RECALL_MAX_ITEMS)
    .map((s): MemoryRecallItem => {
      const { snippet, truncated } = truncateRecallSnippet(s.content);
      const item: MemoryRecallItem = {
        id: s.id,
        sessionId: s.sessionId,
        createdAt: s.createdAt,
        snippet,
      };
      if (truncated) item.snippetTruncated = true;
      return item;
    })
    // An all-empty-snippet list is a degenerate case (memory rows with
    // no content). Skip them so the reveal never opens on blanks.
    .filter((item) => item.snippet.length > 0);
  if (items.length === 0) return null;
  return { recalls: items };
}
