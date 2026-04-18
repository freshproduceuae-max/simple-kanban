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
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Column } from "./Column";
import { TaskCard } from "./TaskCard";
import { TaskDialog, type DialogMode } from "./TaskDialog";
import { useTasks } from "@/lib/useTasks";
import { COLUMNS, type Task, type TaskStatus } from "@/lib/types";
import { todayISO } from "@/lib/overdue";
import { resolveDragEnd } from "@/lib/dragEnd";
import { buildDemoTasks } from "@/lib/seed";

export function Board() {
  const { tasks, dispatch } = useTasks();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [dialog, setDialog] = useState<DialogMode | null>(null);
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const today = todayISO();

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Press "n" to open a new-task dialog (ignores typing into fields).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (dialog) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        setDialog({ kind: "create" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((t) => {
      if (activeTag && !t.tags.includes(activeTag)) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    });
  }, [tasks, query, activeTag]);

  const byStatus = useMemo(() => {
    const empty: Record<TaskStatus, Task[]> = {
      todo: [],
      in_progress: [],
      done: [],
    };
    for (const t of filtered) empty[t.status].push(t);
    return empty;
  }, [filtered]);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    for (const t of tasks) for (const tag of t.tags) s.add(tag);
    return Array.from(s).sort();
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
          priority: task.priority,
          tags: task.tags,
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

  const isEmpty = mounted && tasks.length === 0;
  const todayPretty = new Date(today + "T00:00:00").toLocaleDateString(
    "en-US",
    { weekday: "long", month: "long", day: "numeric" },
  );

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <main className="relative z-10 mx-auto flex max-w-6xl flex-col gap-10 px-6 py-10 md:px-10 md:py-14">
        {/* Masthead */}
        <header className="flex flex-col gap-6 border-b border-rule pb-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-xl">
              <p className="small-caps font-mono text-[11px] text-ink-muted">
                Vol. I · Issue 01 · {todayPretty}
              </p>
              <h1 className="font-serif text-6xl font-[600] leading-[0.95] tracking-tight text-ink md:text-7xl">
                Plan<span className="text-terra">.</span>
              </h1>
              <p className="mt-3 max-w-md text-[15px] leading-relaxed text-ink-soft">
                A small, opinionated planner for a single quiet brain. Drag a
                card to move it forward. Press{" "}
                <kbd className="rounded border border-rule bg-paper-warm px-1.5 py-0.5 font-mono text-[11px]">
                  N
                </kbd>{" "}
                for a new task.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search the board…"
                  aria-label="Search tasks"
                  className="h-10 w-64 rounded-none border-b border-ink/40 bg-transparent px-1 font-sans text-sm text-ink placeholder:text-ink-muted focus:border-terra focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => setDialog({ kind: "create" })}
                className="group inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 font-sans text-sm font-medium text-paper transition-all hover:bg-terra hover:shadow-[0_8px_24px_-10px_rgba(179,75,43,0.6)]"
              >
                <span className="font-mono text-[13px] leading-none">+</span>
                New task
              </button>
            </div>
          </div>

          {/* Tag filter strip */}
          {mounted && allTags.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="small-caps font-mono text-[10px] text-ink-muted">
                Filter —
              </span>
              <button
                type="button"
                onClick={() => setActiveTag(null)}
                className={`font-serif text-sm italic transition-colors ${
                  activeTag === null
                    ? "text-ink underline decoration-terra decoration-2 underline-offset-4"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                all
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() =>
                    setActiveTag((cur) => (cur === tag ? null : tag))
                  }
                  className={`font-serif text-sm italic transition-colors ${
                    activeTag === tag
                      ? "text-ink underline decoration-terra decoration-2 underline-offset-4"
                      : "text-ink-muted hover:text-ink"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          ) : null}
        </header>

        {/* Empty state */}
        {isEmpty ? (
          <section className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded border border-dashed border-rule bg-paper-warm/40 px-8 py-16 text-center">
            <p className="small-caps font-mono text-[10px] text-ink-muted">
              Blank page
            </p>
            <h2 className="font-serif text-4xl leading-tight text-ink">
              Nothing planned{" "}
              <span className="italic text-terra">yet</span>.
            </h2>
            <p className="max-w-sm text-sm leading-relaxed text-ink-soft">
              Add your first task, or load a handful of sample cards to see how
              the board feels with real content.
            </p>
            <div className="mt-2 flex gap-3">
              <button
                type="button"
                onClick={() => setDialog({ kind: "create" })}
                className="rounded-full bg-ink px-5 py-2 font-sans text-sm font-medium text-paper hover:bg-terra"
              >
                Add a task
              </button>
              <button
                type="button"
                onClick={() => {
                  for (const t of buildDemoTasks())
                    dispatch({ type: "add", task: t });
                }}
                className="rounded-full border border-ink/30 px-5 py-2 font-sans text-sm font-medium text-ink transition-colors hover:border-ink"
              >
                Load demo data
              </button>
            </div>
          </section>
        ) : null}

        {/* Columns */}
        {!isEmpty ? (
          <section className="grid gap-5 md:grid-cols-3">
            {COLUMNS.map((c, i) => (
              <Column
                key={c.id}
                id={c.id}
                label={c.label}
                blurb={c.blurb}
                count={mounted ? byStatus[c.id].length : 0}
                index={i}
              >
                {mounted
                  ? byStatus[c.id].map((t) => (
                      <TaskCard
                        key={t.id}
                        task={t}
                        onOpen={openEdit}
                        today={today}
                      />
                    ))
                  : null}
              </Column>
            ))}
          </section>
        ) : null}

        {/* Colophon / meta footer */}
        <footer className="mt-4 flex items-center justify-between border-t border-rule pt-5 font-mono text-[11px] text-ink-muted">
          <span className="small-caps">
            {tasks.length} total · {tasks.filter((t) => t.status === "done").length} done
          </span>
          <span className="small-caps">local only · no cloud</span>
        </footer>

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
