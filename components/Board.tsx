"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Column } from "./Column";
import { TaskCard } from "./TaskCard";
import { TaskDialog, type DialogMode } from "./TaskDialog";
import { COLUMNS, STORAGE_KEY, type Task, type TaskStatus } from "@/lib/types";
import { todayISO } from "@/lib/overdue";
import { resolveDragEnd } from "@/lib/dragEnd";
import { loadTasks } from "@/lib/storage";
import {
  createTaskAction,
  deleteTaskAction,
  editTaskAction,
  migrateLocalTasksAction,
  moveTaskAction,
} from "@/lib/board/actions";

type Props = {
  initialTasks: Task[];
};

/**
 * v0.4 board client. Hydrates from server-fetched `initialTasks`,
 * mutates via Server Actions, applies optimistic updates locally and
 * rolls back on failure. Preserves the three-column layout and task
 * dialog behavior from v0.1.
 *
 * Loading state: `pending` from useTransition + a per-action flash.
 * Error state: `error` string rendered as a role=alert banner.
 */
export function Board({ initialTasks }: Props) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [dialog, setDialog] = useState<DialogMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const today = todayISO();
  const migrationAttempted = useRef(false);

  // One-time v0.1 → v0.4 migration. If the server gave us an empty
  // board but localStorage has v0.1 tasks, push them up once and clear
  // the local copy. Runs at most once per mount.
  useEffect(() => {
    if (migrationAttempted.current) return;
    migrationAttempted.current = true;
    if (initialTasks.length > 0) return;
    const local = loadTasks();
    if (local.length === 0) return;
    startTransition(async () => {
      const result = await migrateLocalTasksAction({
        tasks: local.map((t) => ({
          title: t.title,
          description: t.description,
          dueDate: t.dueDate,
          status: t.status,
          createdAt: t.createdAt,
        })),
      });
      if (result.ok && result.value.migrated > 0) {
        try {
          window.localStorage.removeItem(STORAGE_KEY);
        } catch {
          // Non-fatal — user can clear it themselves.
        }
        // Reload so the server component re-fetches the canonical rows
        // (real ids + canonical positions) — cheapest way to reconcile.
        window.location.reload();
      } else if (!result.ok) {
        setError(result.error);
      }
    });
    // We only ever want this on mount — initialTasks is the server truth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const byStatus = useMemo(() => {
    const empty: Record<TaskStatus, Task[]> = {
      todo: [],
      in_progress: [],
      done: [],
    };
    for (const t of tasks) empty[t.status].push(t);
    return empty;
  }, [tasks]);

  const openEdit = (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (task) setDialog({ kind: "edit", task });
  };

  const handleSubmit = (task: Task) => {
    setError(null);
    if (dialog?.kind === "edit") {
      const prev = tasks;
      setTasks((s) => s.map((t) => (t.id === task.id ? { ...t, ...task } : t)));
      startTransition(async () => {
        const result = await editTaskAction({
          id: task.id,
          title: task.title,
          description: task.description,
          dueDate: task.dueDate,
          status: task.status,
        });
        if (!result.ok) {
          setTasks(prev);
          setError(result.error);
        } else {
          setTasks((s) => s.map((t) => (t.id === task.id ? result.value : t)));
        }
      });
    } else {
      // Optimistic: insert under the placeholder id, swap to the real
      // row id when the action returns.
      const placeholder = { ...task };
      setTasks((s) => [...s, placeholder]);
      startTransition(async () => {
        const result = await createTaskAction({
          title: task.title,
          description: task.description,
          dueDate: task.dueDate,
          status: task.status,
        });
        if (!result.ok) {
          setTasks((s) => s.filter((t) => t.id !== placeholder.id));
          setError(result.error);
        } else {
          setTasks((s) => s.map((t) => (t.id === placeholder.id ? result.value : t)));
        }
      });
    }
    setDialog(null);
  };

  const handleDelete = (id: string) => {
    setError(null);
    const prev = tasks;
    setTasks((s) => s.filter((t) => t.id !== id));
    setDialog(null);
    startTransition(async () => {
      const result = await deleteTaskAction({ id });
      if (!result.ok) {
        setTasks(prev);
        setError(result.error);
      }
    });
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const result = resolveDragEnd({
      activeId: String(e.active.id),
      overId: e.over ? String(e.over.id) : null,
    });
    if (!result) return;
    setError(null);
    const prev = tasks;
    setTasks((s) => s.map((t) => (t.id === result.id ? { ...t, status: result.status } : t)));
    startTransition(async () => {
      const move = await moveTaskAction({ id: result.id, status: result.status });
      if (!move.ok) {
        setTasks(prev);
        setError(move.error);
      }
    });
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <main className="mx-auto flex max-w-6xl flex-col gap-space-4 px-space-4 py-space-6">
        <div className="flex items-center justify-between">
          <h1 className="font-family-display text-size-xl font-weight-semibold text-ink-900">Plan</h1>
          <div className="flex items-center gap-space-3">
            {pending && (
              <span className="text-size-xs text-ink-500" aria-live="polite">
                Saving…
              </span>
            )}
            <button
              type="button"
              onClick={() => setDialog({ kind: "create" })}
              className="rounded bg-ink-900 px-space-3 py-space-1 text-size-sm font-weight-medium text-surface-card transition-colors duration-duration-fast ease-ease-standard hover:bg-ink-700"
            >
              Add task
            </button>
          </div>
        </div>
        {error && (
          <p
            role="alert"
            className="rounded border border-accent-terra-500 bg-surface-card p-space-3 text-size-sm text-accent-terra-700"
          >
            {error}
          </p>
        )}
        <div className="flex flex-col gap-space-3 md:flex-row md:gap-space-6">
          {COLUMNS.map((c) => (
            <Column key={c.id} id={c.id} label={c.label} count={byStatus[c.id].length}>
              {byStatus[c.id].map((t) => (
                <TaskCard key={t.id} task={t} onOpen={openEdit} today={today} />
              ))}
            </Column>
          ))}
        </div>
        {dialog ? (
          <TaskDialog
            mode={dialog}
            onClose={() => setDialog(null)}
            onSubmit={handleSubmit}
            onDelete={dialog.kind === "edit" ? handleDelete : undefined}
          />
        ) : null}
      </main>
    </DndContext>
  );
}
