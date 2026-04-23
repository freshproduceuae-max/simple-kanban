import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupabaseCouncilMemoryRepository } from '../supabase-council-memory-repository';
import type { CouncilMemorySummaryRow, MemoryRecallRow } from '../types';

type Result<T> = { data: T; error: null | { message: string } };

function chain<T>(result: Result<T>) {
  const self: Record<string, unknown> = {};
  const methods = ['select', 'insert', 'eq', 'order', 'limit'] as const;
  for (const m of methods) self[m] = vi.fn(() => self);
  self.single = vi.fn(async () => result);
  (self as { then: (r: (v: Result<T>) => void) => void }).then = (r) => r(result);
  return self as {
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
  };
}

const summaryRow: CouncilMemorySummaryRow = {
  id: 's-1',
  user_id: 'u1',
  session_id: 'sess-1',
  kind: 'session-end',
  content: 'We discussed deploys.',
  created_at: '2026-04-21T00:00:00Z',
};

const recallRow: MemoryRecallRow = {
  id: 'r-1',
  turn_id: 't-1',
  user_id: 'u1',
  source_turn_id: null,
  snippet: 'We discussed deploys.',
  created_at: '2026-04-22T00:00:00Z',
};

describe('SupabaseCouncilMemoryRepository (F18 summaries)', () => {
  let fromSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fromSpy = vi.fn();
  });

  it('writeSummary inserts a row and returns it', async () => {
    const builder = chain<CouncilMemorySummaryRow>({ data: summaryRow, error: null });
    fromSpy.mockReturnValue(builder);
    const repo = new SupabaseCouncilMemoryRepository({ from: fromSpy } as never);

    const got = await repo.writeSummary({
      user_id: 'u1',
      session_id: 'sess-1',
      kind: 'session-end',
      content: 'We discussed deploys.',
    });
    expect(fromSpy).toHaveBeenCalledWith('council_memory_summaries');
    expect(builder.insert).toHaveBeenCalledWith({
      user_id: 'u1',
      session_id: 'sess-1',
      kind: 'session-end',
      content: 'We discussed deploys.',
    });
    expect(got.id).toBe('s-1');
  });

  it('listSummariesForUser defaults to 3 rows, desc by created_at', async () => {
    const builder = chain<CouncilMemorySummaryRow[]>({
      data: [summaryRow],
      error: null,
    });
    fromSpy.mockReturnValue(builder);
    const repo = new SupabaseCouncilMemoryRepository({ from: fromSpy } as never);

    await repo.listSummariesForUser('u1');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(builder.limit).toHaveBeenCalledWith(3);
  });

  it('listSummariesForUser clamps limit into [1, 50]', async () => {
    const builder = chain<CouncilMemorySummaryRow[]>({ data: [], error: null });
    fromSpy.mockReturnValue(builder);
    const repo = new SupabaseCouncilMemoryRepository({ from: fromSpy } as never);
    await repo.listSummariesForUser('u1', 9999);
    expect(builder.limit).toHaveBeenCalledWith(50);
    fromSpy.mockClear();
    const builder2 = chain<CouncilMemorySummaryRow[]>({ data: [], error: null });
    fromSpy.mockReturnValue(builder2);
    await repo.listSummariesForUser('u1', -5);
    expect(builder2.limit).toHaveBeenCalledWith(1);
  });

  // F24 — recall writes and reads. These rows bind a Consolidator
  // turn to the memory snippets the Researcher surfaced into its
  // system prompt, so the UI reveal ("I remembered …") has
  // persistent data to replay via F28 history later.
  it('writeRecall inserts a row with null source_turn_id on the summary path', async () => {
    const builder = chain<MemoryRecallRow>({ data: recallRow, error: null });
    fromSpy.mockReturnValue(builder);
    const repo = new SupabaseCouncilMemoryRepository({ from: fromSpy } as never);

    const got = await repo.writeRecall({
      turn_id: 't-1',
      user_id: 'u1',
      source_turn_id: null,
      snippet: 'We discussed deploys.',
    });
    expect(fromSpy).toHaveBeenCalledWith('memory_recalls');
    expect(builder.insert).toHaveBeenCalledWith({
      turn_id: 't-1',
      user_id: 'u1',
      source_turn_id: null,
      snippet: 'We discussed deploys.',
    });
    expect(got.id).toBe('r-1');
    expect(got.source_turn_id).toBeNull();
  });

  it('writeRecall surfaces the insert error with a prefixed message', async () => {
    const builder = chain<MemoryRecallRow>({
      data: null as unknown as MemoryRecallRow,
      error: { message: 'fk-violation' },
    });
    fromSpy.mockReturnValue(builder);
    const repo = new SupabaseCouncilMemoryRepository({ from: fromSpy } as never);
    await expect(
      repo.writeRecall({
        turn_id: 't-1',
        user_id: 'u1',
        source_turn_id: null,
        snippet: 'x',
      }),
    ).rejects.toThrow(/CouncilMemoryRepository\.writeRecall: fk-violation/);
  });

  it('listRecallsForTurn filters by user_id + turn_id and orders oldest-first', async () => {
    const builder = chain<MemoryRecallRow[]>({ data: [recallRow], error: null });
    fromSpy.mockReturnValue(builder);
    const repo = new SupabaseCouncilMemoryRepository({ from: fromSpy } as never);

    const rows = await repo.listRecallsForTurn('u1', 't-1');
    expect(fromSpy).toHaveBeenCalledWith('memory_recalls');
    // Defence-in-depth: the query is double-filtered. RLS covers the
    // cookie-auth path; the explicit user_id.eq covers the service-role
    // path (future backfills / workers).
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(builder.eq).toHaveBeenCalledWith('turn_id', 't-1');
    // Oldest-first so UI can replay in the order memory was surfaced
    // into the Consolidator's prompt.
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(rows).toEqual([recallRow]);
  });

  it('listRecallsForTurn surfaces the select error with a prefixed message', async () => {
    const builder = chain<MemoryRecallRow[]>({
      data: null as unknown as MemoryRecallRow[],
      error: { message: 'offline' },
    });
    fromSpy.mockReturnValue(builder);
    const repo = new SupabaseCouncilMemoryRepository({ from: fromSpy } as never);
    await expect(repo.listRecallsForTurn('u1', 't-1')).rejects.toThrow(
      /CouncilMemoryRepository\.listRecallsForTurn: offline/,
    );
  });

  it('surfaces errors with a prefixed message', async () => {
    const builder = chain<CouncilMemorySummaryRow>({
      data: null as unknown as CouncilMemorySummaryRow,
      error: { message: 'boom' },
    });
    fromSpy.mockReturnValue(builder);
    const repo = new SupabaseCouncilMemoryRepository({ from: fromSpy } as never);
    await expect(
      repo.writeSummary({
        user_id: 'u1',
        session_id: 'session-1',
        kind: 'session-end',
        content: 'x',
      }),
    ).rejects.toThrow(/CouncilMemoryRepository\.writeSummary: boom/);
  });
});
