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

const priClass: Record<Task["priority"], string> = {
  low: "pri-low",
  medium: "pri-medium",
  high: "pri-high",
};

const priLabel: Record<Task["priority"], string> = {
  low: "low",
  medium: "med",
  high: "high",
};

function formatDue(iso: string): string {
  // Render as "Apr 20" / "Dec 3" — short & editorial.
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function TaskCard({ task, onOpen, today }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: task.id });
  const overdue = isOverdue(task, today);
  const done = task.status === "done";

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.55 : 1,
  };

  return (
    <button
      ref={setNodeRef}
      style={style}
      type="button"
      onClick={() => onOpen(task.id)}
      className="card-paper group relative w-full rounded-sm px-4 py-3.5 pl-5 text-left transition-all focus:outline-none focus:ring-2 focus:ring-terra/50"
      {...attributes}
      {...listeners}
    >
      {/* Priority bar on the leading edge */}
      <span
        aria-hidden
        className={`absolute left-0 top-0 h-full w-[3px] ${priClass[task.priority]}`}
      />

      <div className="flex items-start justify-between gap-3">
        <h3
          className={`font-serif text-[17px] leading-snug text-ink ${
            done ? "italic text-ink-muted line-through decoration-ink-muted/60" : ""
          }`}
        >
          {task.title}
        </h3>
        <span className="small-caps shrink-0 font-mono text-[9px] text-ink-muted">
          {priLabel[task.priority]}
        </span>
      </div>

      {task.description ? (
        <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-ink-soft">
          {task.description}
        </p>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {task.tags.map((tag) => (
            <span
              key={tag}
              className="font-serif text-[12px] italic text-ink-muted"
            >
              #{tag}
            </span>
          ))}
        </div>
        {task.dueDate ? (
          <span
            className={`whitespace-nowrap font-mono text-[11px] tabular-nums ${
              overdue ? "text-terra" : "text-ink-muted"
            }`}
          >
            {overdue ? "▲ " : ""}
            {formatDue(task.dueDate)}
          </span>
        ) : null}
      </div>
    </button>
  );
}
