"use client";

import type { ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import type { TaskStatus } from "@/lib/types";

type Props = {
  id: TaskStatus;
  label: string;
  count: number;
  children?: ReactNode;
};

/**
 * Kanban column. Surface = canvas tone with a subtle pressed shift on
 * drag-over, per design-system.md §6.3 + §7.2. Border instead of
 * heavier chrome keeps the editorial-paper feel.
 */
export function Column({ id, label, count, children }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section
      ref={setNodeRef}
      aria-label={label}
      className={`flex min-h-[12rem] flex-1 flex-col rounded-lg border border-border-default p-space-3 transition-colors duration-duration-fast ease-ease-standard ${
        isOver ? "bg-surface-pressed" : "bg-surface-canvas"
      }`}
    >
      <header className="mb-space-2 flex items-center justify-between">
        <h2 className="text-size-sm font-weight-semibold text-ink-900">{label}</h2>
        <span className="rounded bg-surface-pressed px-space-2 text-size-xs text-ink-700">
          {count}
        </span>
      </header>
      <div className="flex flex-col gap-space-2">
        {count === 0 ? (
          <p className="text-size-sm text-ink-500">No tasks</p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
