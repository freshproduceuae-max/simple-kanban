"use client";

import type { ReactNode } from "react";

type Props = {
  label: string;
  count: number;
  children?: ReactNode;
};

export function Column({ label, count, children }: Props) {
  return (
    <section
      aria-label={label}
      className="flex min-h-[12rem] flex-1 flex-col rounded-lg bg-slate-100 p-3"
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
