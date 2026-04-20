import { describe, it, expect } from 'vitest';
import { taskRowToTask, dueDateToOverdueAt } from '../mappers';
import type { TaskRow } from '@/lib/persistence/types';

const baseRow: TaskRow = {
  id: 't1',
  user_id: 'u1',
  title: 'Write plan',
  description: 'Draft the v0.4 PRD',
  board_column: 'in_progress',
  position: 1700000000000,
  overdue_at: null,
  created_at: '2026-04-21T00:00:00Z',
  updated_at: '2026-04-21T00:00:00Z',
};

describe('taskRowToTask (F05)', () => {
  it('maps each persistence field to the app-level Task shape', () => {
    const t = taskRowToTask(baseRow);
    expect(t.id).toBe('t1');
    expect(t.title).toBe('Write plan');
    expect(t.description).toBe('Draft the v0.4 PRD');
    expect(t.status).toBe('in_progress');
    expect(t.createdAt).toBe(1700000000000);
    expect(t.dueDate).toBeNull();
  });

  it('normalizes null description to empty string (Task.description is not nullable)', () => {
    const t = taskRowToTask({ ...baseRow, description: null });
    expect(t.description).toBe('');
  });

  it('slices overdue_at into a YYYY-MM-DD dueDate', () => {
    const t = taskRowToTask({ ...baseRow, overdue_at: '2026-05-01T23:59:59.000Z' });
    expect(t.dueDate).toBe('2026-05-01');
  });
});

describe('dueDateToOverdueAt (F05)', () => {
  it('returns null for null/undefined/empty', () => {
    expect(dueDateToOverdueAt(null)).toBeNull();
    expect(dueDateToOverdueAt(undefined)).toBeNull();
    expect(dueDateToOverdueAt('')).toBeNull();
  });

  it('extends a YYYY-MM-DD into an end-of-day UTC timestamp', () => {
    expect(dueDateToOverdueAt('2026-05-01')).toBe('2026-05-01T23:59:59.000Z');
  });
});
