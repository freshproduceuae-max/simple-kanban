"use client";

import { useMemo, useState } from "react";
import { Column } from "./Column";
import { useTasks } from "@/lib/useTasks";
import { COLUMNS } from "@/lib/types";

export function Board() {
  const { tasks } = useTasks();
  const [dialogOpen, setDialogOpen] = useState(false);

  const byStatus = useMemo(() => {
    return {
      todo: tasks.filter((t) => t.status === "todo"),
      in_progress: tasks.filter((t) => t.status === "in_progress"),
      done: tasks.filter((t) => t.status === "done"),
    };
  }, [tasks]);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Plan</h1>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="rounded bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          Add task
        </button>
      </div>
      <div className="flex flex-col gap-3 md:flex-row">
        {COLUMNS.map((c) => (
          <Column key={c.id} label={c.label} count={byStatus[c.id].length} />
        ))}
      </div>
      {dialogOpen ? (
        <div role="dialog" aria-label="task dialog placeholder" hidden />
      ) : null}
    </main>
  );
}
