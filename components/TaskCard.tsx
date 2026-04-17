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

export function TaskCard({ task, onOpen, today }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: task.id });
  const overdue = isOverdue(task, today);
  const base =
    "w-full rounded border bg-white p-2 text-left shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400";
  const borderCls = overdue ? "border-red-500" : "border-slate-200";
  const dateCls = overdue ? "text-red-600" : "text-slate-500";
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
      <div className="text-sm font-medium text-slate-800">{task.title}</div>
      {task.dueDate ? (
        <div className={`mt-1 text-xs ${dateCls}`}>{task.dueDate}</div>
      ) : null}
    </button>
  );
}
