"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Column } from "./Column";
import { TaskCard } from "./TaskCard";
import { TaskDialog, type DialogMode } from "./TaskDialog";
import { useTasks } from "@/lib/useTasks";
import { COLUMNS, type Task, type TaskStatus } from "@/lib/types";
import { todayISO } from "@/lib/overdue";
import { resolveDragEnd } from "@/lib/dragEnd";

export function Board() {
  const { tasks, dispatch } = useTasks();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [dialog, setDialog] = useState<DialogMode | null>(null);
  const today = todayISO();

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor),
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
    if (dialog?.kind === "edit") {
      dispatch({
        type: "edit",
        id: task.id,
        patch: {
          title: task.title,
          description: task.description,
          dueDate: task.dueDate,
          status: task.status,
        },
      });
    } else {
      dispatch({ type: "add", task });
    }
    setDialog(null);
  };

  const handleDelete = (id: string) => {
    dispatch({ type: "delete", id });
    setDialog(null);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const result = resolveDragEnd({
      activeId: String(e.active.id),
      overId: e.over ? String(e.over.id) : null,
    });
    if (result) dispatch({ type: "move", id: result.id, status: result.status });
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <main className="mx-auto flex max-w-6xl flex-col gap-4 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-800">Plan</h1>
          <button
            type="button"
            onClick={() => setDialog({ kind: "create" })}
            className="rounded bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
          >
            Add task
          </button>
        </div>
        <div className="flex flex-col gap-3 md:flex-row">
          {COLUMNS.map((c) => (
            <Column
              key={c.id}
              id={c.id}
              label={c.label}
              count={mounted ? byStatus[c.id].length : 0}
            >
              {mounted
                ? byStatus[c.id].map((t) => (
                    <TaskCard key={t.id} task={t} onOpen={openEdit} today={today} />
                  ))
                : null}
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
