'use server';

import { revalidatePath } from 'next/cache';
import { getTaskRepository } from '@/lib/persistence/server';
import { mintUserApprovalContext } from './approval';
import { dueDateToOverdueAt, taskRowToTask } from './mappers';
import { getAuthedUserId } from '@/lib/auth/current-user';
import type { Task, TaskStatus } from '@/lib/types';

/**
 * Server Actions for the v0.4 board. Replace the v0.1 localStorage
 * reducer with Supabase-backed writes. Every mutation:
 *   1. Resolves the authenticated user (Supabase session).
 *   2. Mints an ApprovalContext (direct user action — Council Write
 *      Gate contract; verification lands at F12).
 *   3. Calls the TaskRepository (RLS enforces owner-only access).
 *   4. Revalidates `/` so the server-rendered initial list picks up
 *      the change on the next navigation.
 *
 * Return shape is deliberately uniform: `{ ok: true, task }` on
 * success, `{ ok: false, error: string }` on failure. The client
 * reads `ok` to roll back its optimistic update and surface the
 * message — loading / success / error states per global CLAUDE.md.
 */

export type ActionResult<T> = { ok: true; value: T } | { ok: false; error: string };

export async function listTasksAction(): Promise<ActionResult<Task[]>> {
  try {
    const userId = await getAuthedUserId();
    const rows = await getTaskRepository().listForUser(userId);
    return { ok: true, value: rows.map(taskRowToTask) };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function createTaskAction(input: {
  title: string;
  description?: string;
  dueDate?: string | null;
  status: TaskStatus;
}): Promise<ActionResult<Task>> {
  try {
    const userId = await getAuthedUserId();
    const title = input.title.trim();
    if (!title) return { ok: false, error: 'Title is required.' };

    const row = await getTaskRepository().create({
      userId,
      title,
      description: (input.description ?? '').trim() || null,
      board_column: input.status,
      position: Date.now(),
      approvalContext: mintUserApprovalContext(),
    });
    // overdue_at is a separate column; set it via update if present.
    const overdueAt = dueDateToOverdueAt(input.dueDate);
    const finalRow = overdueAt
      ? await getTaskRepository().update({
          id: row.id,
          userId,
          patch: { overdue_at: overdueAt },
          approvalContext: mintUserApprovalContext(),
        })
      : row;
    revalidatePath('/');
    return { ok: true, value: taskRowToTask(finalRow) };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function editTaskAction(input: {
  id: string;
  title: string;
  description?: string;
  dueDate?: string | null;
  status: TaskStatus;
}): Promise<ActionResult<Task>> {
  try {
    const userId = await getAuthedUserId();
    const title = input.title.trim();
    if (!title) return { ok: false, error: 'Title is required.' };

    const row = await getTaskRepository().update({
      id: input.id,
      userId,
      patch: {
        title,
        description: (input.description ?? '').trim() || null,
        board_column: input.status,
        overdue_at: dueDateToOverdueAt(input.dueDate),
      },
      approvalContext: mintUserApprovalContext(),
    });
    revalidatePath('/');
    return { ok: true, value: taskRowToTask(row) };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function moveTaskAction(input: { id: string; status: TaskStatus }): Promise<ActionResult<Task>> {
  try {
    const userId = await getAuthedUserId();
    const row = await getTaskRepository().update({
      id: input.id,
      userId,
      patch: { board_column: input.status },
      approvalContext: mintUserApprovalContext(),
    });
    revalidatePath('/');
    return { ok: true, value: taskRowToTask(row) };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function deleteTaskAction(input: { id: string }): Promise<ActionResult<{ id: string }>> {
  try {
    const userId = await getAuthedUserId();
    await getTaskRepository().delete({
      id: input.id,
      userId,
      approvalContext: mintUserApprovalContext(),
    });
    revalidatePath('/');
    return { ok: true, value: { id: input.id } };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/**
 * One-time v0.1 → v0.4 data migration. If the user's server-side task
 * list is empty and the browser hands us a batch of v0.1 localStorage
 * tasks, insert them all (preserving createdAt as position) so a
 * returning v0.1 user keeps their board on first sign-in. The client
 * clears localStorage after a successful response.
 */
export async function migrateLocalTasksAction(input: {
  tasks: Array<{
    title: string;
    description: string;
    dueDate: string | null;
    status: TaskStatus;
    createdAt: number;
  }>;
}): Promise<ActionResult<{ migrated: number }>> {
  try {
    const userId = await getAuthedUserId();
    const repo = getTaskRepository();
    const existing = await repo.listForUser(userId);
    if (existing.length > 0) {
      // Server already has data — don't clobber; treat as no-op.
      return { ok: true, value: { migrated: 0 } };
    }
    let n = 0;
    for (const t of input.tasks) {
      const title = t.title.trim();
      if (!title) continue;
      const row = await repo.create({
        userId,
        title,
        description: t.description.trim() || null,
        board_column: t.status,
        position: t.createdAt,
        approvalContext: mintUserApprovalContext(),
      });
      if (t.dueDate) {
        await repo.update({
          id: row.id,
          userId,
          patch: { overdue_at: dueDateToOverdueAt(t.dueDate) },
          approvalContext: mintUserApprovalContext(),
        });
      }
      n += 1;
    }
    revalidatePath('/');
    return { ok: true, value: { migrated: n } };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return 'Something went wrong. Please try again.';
}
