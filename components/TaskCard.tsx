"use client";

import type { Task } from "@/lib/types";
import { isOverdue } from "@/lib/overdue";

type Props = {
  task: Task;
  onOpen: (id: string) => void;
  today?: string;
};

export function TaskCard({ task, onOpen, today }: Props) {
  const overdue = isOverdue(task, today);
  const base =
    "w-full rounded border bg-white p-2 text-left shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400";
  const borderCls = overdue ? "border-red-500" : "border-slate-200";
  const dateCls = overdue ? "text-red-600" : "text-slate-500";

  return (
    <button
      type="button"
      className={`${base} ${borderCls}`}
      onClick={() => onOpen(task.id)}
    >
      <div className="text-sm font-medium text-slate-800">{task.title}</div>
      {task.dueDate ? (
        <div className={`mt-1 text-xs ${dateCls}`}>{task.dueDate}</div>
      ) : null}
    </button>
  );
}
