import { describe, expect, it } from 'vitest';
import {
  buildMemoryRecallAudit,
  MEMORY_RECALL_MAX_ITEMS,
  MEMORY_RECALL_SNIPPET_CAP,
} from '@/lib/council/server/memory-recall-audit';
import type { ResearcherRecalledSummary } from '@/lib/council/researcher';

/**
 * F24 — `buildMemoryRecallAudit` is the single decision point for
 * whether a turn's trailer carries a `memoryRecall` fragment. The
 * route emits nothing when this returns `null`, so these tests guard
 * the no-memory zero-state and the trailer-size invariants end-to-end.
 */

function fixture(
  overrides: Partial<ResearcherRecalledSummary> = {},
  i = 0,
): ResearcherRecalledSummary {
  return {
    id: `sum-${i}`,
    sessionId: `sess-${i}`,
    createdAt: `2026-04-1${i}T00:00:00Z`,
    content: `summary ${i}`,
    ...overrides,
  };
}

describe('buildMemoryRecallAudit', () => {
  it('returns null when no summaries were surfaced', () => {
    expect(buildMemoryRecallAudit([])).toBeNull();
  });

  it('defends against an undefined array (degraded Researcher path)', () => {
    // The route/dispatcher both guarantee an array, but the shelf uses
    // this same module via the trailer path where shape narrowing could
    // miss. Cheap belt-and-suspenders.
    expect(
      buildMemoryRecallAudit(
        undefined as unknown as ResearcherRecalledSummary[],
      ),
    ).toBeNull();
  });

  it('drops entries with an empty snippet and returns null when all were empty', () => {
    expect(
      buildMemoryRecallAudit([
        fixture({ content: '' }, 0),
        fixture({ content: '' }, 1),
      ]),
    ).toBeNull();
  });

  it('returns one item per surfaced summary with id/sessionId/createdAt preserved', () => {
    const out = buildMemoryRecallAudit([
      fixture({ id: 'a', sessionId: 'sa', createdAt: '2026-04-10T10:00:00Z', content: 'hello' }),
      fixture({ id: 'b', sessionId: 'sb', createdAt: '2026-04-11T10:00:00Z', content: 'world' }),
    ]);
    expect(out).not.toBeNull();
    expect(out!.recalls).toHaveLength(2);
    expect(out!.recalls[0]).toEqual({
      id: 'a',
      sessionId: 'sa',
      createdAt: '2026-04-10T10:00:00Z',
      snippet: 'hello',
    });
    expect(out!.recalls[1].id).toBe('b');
  });

  it('preserves the input order (newest-first from the Researcher)', () => {
    const out = buildMemoryRecallAudit([
      fixture({ id: 'newest' }, 0),
      fixture({ id: 'middle' }, 1),
      fixture({ id: 'oldest' }, 2),
    ]);
    expect(out!.recalls.map((r) => r.id)).toEqual([
      'newest',
      'middle',
      'oldest',
    ]);
  });

  it('caps the number of items at MEMORY_RECALL_MAX_ITEMS', () => {
    // Researcher reads up to 5 summaries; the trailer only keeps 3.
    const summaries = Array.from({ length: 5 }, (_, i) =>
      fixture({ id: `s${i}` }, i),
    );
    const out = buildMemoryRecallAudit(summaries);
    expect(out!.recalls).toHaveLength(MEMORY_RECALL_MAX_ITEMS);
    expect(out!.recalls.map((r) => r.id)).toEqual(['s0', 's1', 's2']);
  });

  it('truncates snippets beyond MEMORY_RECALL_SNIPPET_CAP with a trailing ellipsis', () => {
    const long = 'x'.repeat(MEMORY_RECALL_SNIPPET_CAP + 100);
    const out = buildMemoryRecallAudit([fixture({ content: long })]);
    const item = out!.recalls[0];
    expect(item.snippetTruncated).toBe(true);
    // The cap is the pre-ellipsis length; the final string is ≤ cap + 1
    // (the `…`). Cannot be larger than that.
    expect(item.snippet.length).toBeLessThanOrEqual(
      MEMORY_RECALL_SNIPPET_CAP + 1,
    );
    expect(item.snippet.endsWith('…')).toBe(true);
  });

  it('does not flag snippetTruncated when content fits under the cap', () => {
    const out = buildMemoryRecallAudit([fixture({ content: 'brief note' })]);
    expect(out!.recalls[0].snippetTruncated).toBeUndefined();
  });

  it('treats null/undefined content as empty and drops the entry', () => {
    // The Researcher shape is typed `string`, but the trailer crosses a
    // JSON boundary on the client path — guard against a malformed row.
    const out = buildMemoryRecallAudit([
      fixture({ content: undefined as unknown as string }, 0),
      fixture({ content: 'real' }, 1),
    ]);
    expect(out!.recalls).toHaveLength(1);
    expect(out!.recalls[0].snippet).toBe('real');
  });
});
