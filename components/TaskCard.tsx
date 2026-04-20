"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Task } from "@/lib/types";
import { isOverdue } from "@/lib/overdue";

type Props = {
  task: Task;
  onOpen: (id: string) => void;
  today?: string;
};

/**
 * Task card — reads as an index card per design-system.md §8.1: surface
 * card tone, default border, resting shadow that deepens on hover.
 * Overdue surfaces a terra accent instead of a raw red, per the voice
 * contract that avoids alarm and blame.
 */
export function TaskCard({ task, onOpen, today }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: task.id });
  const overdue = isOverdue(task, today);
  const base =
    "w-full rounded border bg-surface-card p-space-3 text-left shadow-card-rest transition-shadow duration-duration-fast ease-ease-standard hover:shadow-card-hover focus:outline-none focus:shadow-ring-focus";
  const borderCls = overdue ? "border-accent-terra-500" : "border-border-default";
  const dateCls = overdue ? "text-accent-terra-700" : "text-ink-500";
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <button
      ref={setNodeRef}
      style={style}
      type="button"
      className={`${base} ${borderCls}`}
      onClick={() => onOpen(task.id)}
      {...attributes}
      {...listeners}
    >
      <div className="text-size-sm font-weight-medium text-ink-900">{task.title}</div>
      {task.dueDate ? (
        <div className={`mt-space-1 font-family-mono text-size-xs ${dateCls}`}>{task.dueDate}</div>
      ) : null}
    </button>
  );
}
