"use client";

import type { ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import type { TaskStatus } from "@/lib/types";

type Props = {
  id: TaskStatus;
  label: string;
  blurb: string;
  count: number;
  index: number;
  children?: ReactNode;
};

export function Column({ id, label, blurb, count, index, children }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section
      ref={setNodeRef}
      aria-label={label}
      style={{ animationDelay: `${index * 70}ms` }}
      className={`rise flex min-h-[16rem] flex-col rounded-sm border border-rule/60 bg-paper-warm/40 p-5 transition-colors ${
        isOver ? "border-terra/70 bg-paper-warm" : ""
      }`}
    >
      <header className="mb-5 flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <span className="small-caps font-mono text-[10px] font-medium text-ink-muted">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div>
            <h2 className="font-serif text-xl font-[600] leading-none text-ink">
              {label}
            </h2>
            <p className="mt-1.5 font-serif text-[12px] italic text-ink-muted">
              {blurb}
            </p>
          </div>
        </div>
        <span className="font-serif text-3xl font-[500] leading-none text-ink/30 tabular-nums">
          {count}
        </span>
      </header>
      <div className="rule-dot mb-4" />
      <div className="flex flex-col gap-3">
        {count === 0 ? (
          <p className="font-serif text-sm italic text-ink-muted">
            — nothing here —
          </p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
