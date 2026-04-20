import type { TaskRow } from '@/lib/persistence/types';
import type { Task, TaskStatus } from '@/lib/types';

/**
 * Map between the app-level `Task` shape (what `Board`/`TaskCard`/
 * `TaskDialog` have always consumed, unchanged from v0.1) and the
 * persistence-level `TaskRow` shape (what the Supabase `tasks` table
 * stores).
 *
 * Keeping the app shape stable means `components/**` and the rendering
 * + drag logic don't move in F05 — only the data source does.
 *
 * Ordering: the v0.1 board had no explicit position field; cards
 * appeared in array / insertion order. We reuse `createdAt` (ms since
 * epoch) as the `position` value so order matches what users saw in
 * v0.1. New cards get `Date.now()`, which sorts them last within a
 * column. Cross-column moves preserve the same position so the card
 * lands "where it was" relative to its new neighbors.
 */
export function taskRowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    dueDate: row.overdue_at ? row.overdue_at.slice(0, 10) : null,
    status: row.board_column as TaskStatus,
    createdAt: row.position,
  };
}

/**
 * ISO timestamp (UTC, end-of-day) for a YYYY-MM-DD due date. Stored in
 * `tasks.overdue_at`. End-of-day keeps "due today" from firing while
 * the day is still in progress.
 */
export function dueDateToOverdueAt(dueDate: string | null | undefined): string | null {
  if (!dueDate) return null;
  return `${dueDate}T23:59:59.000Z`;
}
