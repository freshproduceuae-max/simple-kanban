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

export function Column({ id, label, count, children }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section
      ref={setNodeRef}
      aria-label={label}
      className={`flex min-h-[12rem] flex-1 flex-col rounded-lg p-3 transition-colors ${
        isOver ? "bg-slate-200" : "bg-slate-100"
      }`}
    >
      <header className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">{label}</h2>
        <span className="rounded bg-slate-200 px-2 text-xs text-slate-600">
          {count}
        </span>
      </header>
      <div className="flex flex-col gap-2">
        {count === 0 ? (
          <p className="text-sm text-slate-400">No tasks</p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
