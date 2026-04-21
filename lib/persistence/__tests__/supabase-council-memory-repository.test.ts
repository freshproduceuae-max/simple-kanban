import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupabaseCouncilMemoryRepository } from '../supabase-council-memory-repository';
import type { CouncilMemorySummaryRow } from '../types';

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

  it('writeRecall / listRecallsForTurn still throw with an F24 hint', async () => {
    const repo = new SupabaseCouncilMemoryRepository({ from: fromSpy } as never);
    await expect(
      repo.writeRecall({
        turn_id: 't',
        user_id: 'u1',
        source_turn_id: 's',
        snippet: 'x',
      }),
    ).rejects.toThrow(/F24/);
    await expect(repo.listRecallsForTurn('t')).rejects.toThrow(/F24/);
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
