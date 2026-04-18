# Simple Kanban Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-user, browser-local Kanban board (3 fixed columns, DnD, localStorage, overdue highlight) in Next.js 14 App Router.

**Architecture:** Client-only Next.js app. A single `Board` component owns task state via a typed reducer hook (`useTasks`). Tasks hydrate from `localStorage` on mount and persist on every mutation. `@dnd-kit/core` handles mouse/touch/keyboard DnD; its `onDragEnd` updates a task's `status` through the reducer.

**Tech Stack:** Next.js 14 (App Router), TypeScript strict, Tailwind CSS, `@dnd-kit/core` + `@dnd-kit/sortable`, Vitest + React Testing Library + jsdom, npm.

**Working directory:** `C:/Projects/Plan` (Windows, Git Bash — use forward slashes).

**Canonical types (used everywhere in this plan):**

```ts
// lib/types.ts
export type TaskStatus = "todo" | "in_progress" | "done";

export type Task = {
  id: string;
  title: string;
  description: string;
  dueDate: string | null; // YYYY-MM-DD or null
  status: TaskStatus;
  createdAt: number;      // Date.now()
};

export const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: "todo", label: "To Do" },
  { id: "in_progress", label: "In Progress" },
  { id: "done", label: "Done" },
];

export const STORAGE_KEY = "kanban.tasks";
```

**Branching rule (global CLAUDE.md):** Never commit to `main`. Each task lives on its own `feat/<name>` branch. When a feature is complete, open a PR; do not merge without user approval. Task 0 initializes `main` then immediately branches off.

**Progress tracking:** After each task, append a one-line entry to `C:/Projects/Plan/docs/progress.md` and tick the matching milestone there.

---

## File Structure

```
package.json
tsconfig.json
next.config.mjs
postcss.config.mjs
tailwind.config.ts
vitest.config.ts
vitest.setup.ts
app/
  globals.css
  layout.tsx
  page.tsx                 # Client Board page
components/
  Board.tsx                # DnD context + columns + dialog owner
  Column.tsx               # Droppable column
  TaskCard.tsx             # Draggable card
  TaskDialog.tsx           # Create/edit/delete modal
lib/
  types.ts                 # Task, TaskStatus, COLUMNS, STORAGE_KEY
  storage.ts               # loadTasks(), saveTasks()
  useTasks.ts              # useReducer hook + pure reducer
  overdue.ts               # isOverdue(task, today)
lib/__tests__/
  storage.test.ts
  useTasks.test.ts
  overdue.test.ts
  dragEnd.test.ts
components/__tests__/
  Board.test.tsx
  TaskCard.test.tsx
docs/
  progress.md              # milestone ticks + session log (pre-exists)
```

---

## Task 0: Project scaffold

**Branch:** `feat/scaffold`

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `postcss.config.mjs`, `tailwind.config.ts`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `.gitignore`, `vitest.config.ts`, `vitest.setup.ts`

- [ ] **Step 1: Initialize git and main branch**

```bash
cd /c/Projects/Plan
git init
git checkout -b main
git add docs/
git commit -m "chore: seed repo with docs/"
```

- [ ] **Step 2: Scaffold Next.js 14 app in current dir**

```bash
npx create-next-app@14 . --ts --tailwind --app --eslint --src-dir=false --import-alias "@/*" --use-npm --no-turbo
```

Expected: creates `package.json`, `app/`, `tsconfig.json`, Tailwind config. Accept all defaults. If prompted about non-empty dir, confirm yes (docs/ is fine).

- [ ] **Step 3: Verify strict TS**

Open `tsconfig.json` and confirm `"strict": true` is present under `compilerOptions`. If missing, add it.

- [ ] **Step 4: Install runtime deps**

```bash
npm install @dnd-kit/core @dnd-kit/sortable
```

Expected: added to `dependencies`.

- [ ] **Step 5: Install test deps**

```bash
npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @vitejs/plugin-react
```

- [ ] **Step 6: Create vitest.config.ts**

Create `C:/Projects/Plan/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
```

- [ ] **Step 7: Create vitest.setup.ts**

Create `C:/Projects/Plan/vitest.setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
  localStorage.clear();
});
```

- [ ] **Step 8: Add test scripts**

Edit `package.json` scripts block to include:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 9: Smoke-test build + lint**

```bash
npm run lint
npm run build
```

Expected: both succeed with no errors (default Next template).

- [ ] **Step 10: Smoke-test vitest**

```bash
npx vitest run
```

Expected: "No test files found" (exit 0 with `--passWithNoTests` not set → may exit 1; that's OK for now, we'll have tests next task).

- [ ] **Step 11: Commit scaffold**

```bash
git checkout -b feat/scaffold
git add -A
git commit -m "chore: scaffold Next.js 14 app with Tailwind, Vitest, dnd-kit"
```

- [ ] **Step 12: Update progress.md**

Append to `C:/Projects/Plan/docs/progress.md`:

```
- [x] Task 0: Project scaffold (feat/scaffold) — 2026-04-17
```

- [ ] **Step 13: Open PR**

```bash
git push -u origin feat/scaffold || echo "no remote — skip push, open PR when remote exists"
```

If no remote configured, skip push but do not merge to main.

---

## Task 1: Types + storage helpers

**Branch:** `feat/storage`

**Files:**
- Create: `lib/types.ts`, `lib/storage.ts`, `lib/__tests__/storage.test.ts`

- [ ] **Step 1: Write types**

Create `C:/Projects/Plan/lib/types.ts`:

```ts
export type TaskStatus = "todo" | "in_progress" | "done";

export type Task = {
  id: string;
  title: string;
  description: string;
  dueDate: string | null;
  status: TaskStatus;
  createdAt: number;
};

export const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: "todo", label: "To Do" },
  { id: "in_progress", label: "In Progress" },
  { id: "done", label: "Done" },
];

export const STORAGE_KEY = "kanban.tasks";
```

- [ ] **Step 2: Write failing storage tests**

Create `C:/Projects/Plan/lib/__tests__/storage.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { loadTasks, saveTasks } from "../storage";
import { STORAGE_KEY, type Task } from "../types";

const sample: Task[] = [
  {
    id: "a",
    title: "Hello",
    description: "",
    dueDate: null,
    status: "todo",
    createdAt: 1,
  },
];

describe("storage", () => {
  beforeEach(() => localStorage.clear());

  it("returns [] when key is missing", () => {
    expect(loadTasks()).toEqual([]);
  });

  it("returns [] when value is malformed JSON", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    expect(loadTasks()).toEqual([]);
  });

  it("returns [] when value is not an array", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ foo: 1 }));
    expect(loadTasks()).toEqual([]);
  });

  it("round-trips an array of tasks", () => {
    saveTasks(sample);
    expect(loadTasks()).toEqual(sample);
  });

  it("drops entries that don't match the Task shape", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([sample[0], { id: 2 }, null]),
    );
    expect(loadTasks()).toEqual(sample);
  });
});
```

- [ ] **Step 3: Run tests — expect FAIL**

```bash
npx vitest run lib/__tests__/storage.test.ts
```

Expected: FAIL — module `../storage` not found.

- [ ] **Step 4: Implement storage.ts**

Create `C:/Projects/Plan/lib/storage.ts`:

```ts
import { STORAGE_KEY, type Task, type TaskStatus } from "./types";

const STATUSES: TaskStatus[] = ["todo", "in_progress", "done"];

function isTask(v: unknown): v is Task {
  if (!v || typeof v !== "object") return false;
  const t = v as Record<string, unknown>;
  return (
    typeof t.id === "string" &&
    typeof t.title === "string" &&
    typeof t.description === "string" &&
    (t.dueDate === null || typeof t.dueDate === "string") &&
    typeof t.status === "string" &&
    STATUSES.includes(t.status as TaskStatus) &&
    typeof t.createdAt === "number"
  );
}

export function loadTasks(): Task[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isTask);
  } catch {
    return [];
  }
}

export function saveTasks(tasks: Task[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
npx vitest run lib/__tests__/storage.test.ts
```

Expected: 5 passed.

- [ ] **Step 6: Commit**

```bash
git checkout -b feat/storage
git add lib/types.ts lib/storage.ts lib/__tests__/storage.test.ts
git commit -m "feat(storage): add Task types and localStorage helpers with validation"
```

- [ ] **Step 7: Update progress.md**

Append:

```
- [x] Task 1: Types + storage helpers (feat/storage) — 2026-04-17
```

---

## Task 2: Reducer + useTasks hook

**Branch:** `feat/use-tasks`

**Files:**
- Create: `lib/useTasks.ts`, `lib/__tests__/useTasks.test.ts`

- [ ] **Step 1: Write failing reducer tests**

Create `C:/Projects/Plan/lib/__tests__/useTasks.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { tasksReducer, type TasksAction } from "../useTasks";
import type { Task } from "../types";

const base: Task = {
  id: "t1",
  title: "Write plan",
  description: "",
  dueDate: null,
  status: "todo",
  createdAt: 100,
};

describe("tasksReducer", () => {
  it("add appends a new task", () => {
    const action: TasksAction = {
      type: "add",
      task: { ...base, id: "t2", title: "Second" },
    };
    const next = tasksReducer([base], action);
    expect(next).toHaveLength(2);
    expect(next[1].id).toBe("t2");
  });

  it("edit updates matching id only", () => {
    const action: TasksAction = {
      type: "edit",
      id: "t1",
      patch: { title: "Updated", dueDate: "2026-05-01" },
    };
    const next = tasksReducer([base], action);
    expect(next[0].title).toBe("Updated");
    expect(next[0].dueDate).toBe("2026-05-01");
    expect(next[0].createdAt).toBe(100);
  });

  it("edit is a no-op when id is not found", () => {
    const prev = [base];
    const next = tasksReducer(prev, {
      type: "edit",
      id: "missing",
      patch: { title: "x" },
    });
    expect(next).toEqual(prev);
  });

  it("delete removes matching id", () => {
    const next = tasksReducer([base], { type: "delete", id: "t1" });
    expect(next).toEqual([]);
  });

  it("move updates status only", () => {
    const next = tasksReducer([base], {
      type: "move",
      id: "t1",
      status: "done",
    });
    expect(next[0].status).toBe("done");
    expect(next[0].title).toBe(base.title);
  });

  it("hydrate replaces state", () => {
    const replacement: Task[] = [{ ...base, id: "t9" }];
    const next = tasksReducer([base], { type: "hydrate", tasks: replacement });
    expect(next).toEqual(replacement);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx vitest run lib/__tests__/useTasks.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement hook + reducer**

Create `C:/Projects/Plan/lib/useTasks.ts`:

```ts
"use client";

import { useEffect, useReducer, useRef } from "react";
import { loadTasks, saveTasks } from "./storage";
import type { Task, TaskStatus } from "./types";

export type TasksAction =
  | { type: "hydrate"; tasks: Task[] }
  | { type: "add"; task: Task }
  | { type: "edit"; id: string; patch: Partial<Omit<Task, "id" | "createdAt">> }
  | { type: "delete"; id: string }
  | { type: "move"; id: string; status: TaskStatus };

export function tasksReducer(state: Task[], action: TasksAction): Task[] {
  switch (action.type) {
    case "hydrate":
      return action.tasks;
    case "add":
      return [...state, action.task];
    case "edit":
      return state.map((t) =>
        t.id === action.id ? { ...t, ...action.patch } : t,
      );
    case "delete":
      return state.filter((t) => t.id !== action.id);
    case "move":
      return state.map((t) =>
        t.id === action.id ? { ...t, status: action.status } : t,
      );
    default:
      return state;
  }
}

export function useTasks() {
  const [tasks, dispatch] = useReducer(tasksReducer, []);
  const hydrated = useRef(false);

  // Hydrate once on mount (client only).
  useEffect(() => {
    dispatch({ type: "hydrate", tasks: loadTasks() });
    hydrated.current = true;
  }, []);

  // Persist after hydration, on every change.
  useEffect(() => {
    if (!hydrated.current) return;
    saveTasks(tasks);
  }, [tasks]);

  return { tasks, dispatch };
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npx vitest run lib/__tests__/useTasks.test.ts
```

Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git checkout -b feat/use-tasks
git add lib/useTasks.ts lib/__tests__/useTasks.test.ts
git commit -m "feat(tasks): add tasksReducer and useTasks hook with hydration guard"
```

- [ ] **Step 6: Update progress.md**

Append:

```
- [x] Task 2: useTasks reducer + hook (feat/use-tasks) — 2026-04-17
```

---

## Task 3: Overdue helper + UI shell (3 empty columns)

**Branch:** `feat/board-shell`

**Files:**
- Create: `lib/overdue.ts`, `lib/__tests__/overdue.test.ts`, `components/Column.tsx`, `components/Board.tsx`, `components/__tests__/Board.test.tsx`
- Modify: `app/layout.tsx`, `app/page.tsx`, `app/globals.css`

- [ ] **Step 1: Failing overdue test**

Create `C:/Projects/Plan/lib/__tests__/overdue.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isOverdue } from "../overdue";
import type { Task } from "../types";

const make = (over: Partial<Task>): Task => ({
  id: "x",
  title: "x",
  description: "",
  dueDate: null,
  status: "todo",
  createdAt: 0,
  ...over,
});

describe("isOverdue", () => {
  const today = "2026-04-17";

  it("is false when dueDate is null", () => {
    expect(isOverdue(make({ dueDate: null }), today)).toBe(false);
  });

  it("is false when dueDate equals today", () => {
    expect(isOverdue(make({ dueDate: "2026-04-17" }), today)).toBe(false);
  });

  it("is true when dueDate is before today and status !== done", () => {
    expect(isOverdue(make({ dueDate: "2026-04-16" }), today)).toBe(true);
  });

  it("is false when status is done even if past due", () => {
    expect(
      isOverdue(make({ dueDate: "2026-04-16", status: "done" }), today),
    ).toBe(false);
  });

  it("is false when dueDate is in the future", () => {
    expect(isOverdue(make({ dueDate: "2026-04-18" }), today)).toBe(false);
  });
});
```

- [ ] **Step 2: Run — FAIL**

```bash
npx vitest run lib/__tests__/overdue.test.ts
```

- [ ] **Step 3: Implement overdue**

Create `C:/Projects/Plan/lib/overdue.ts`:

```ts
import type { Task } from "./types";

export function todayISO(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isOverdue(task: Task, today: string = todayISO()): boolean {
  if (!task.dueDate) return false;
  if (task.status === "done") return false;
  return task.dueDate < today;
}
```

- [ ] **Step 4: Run — PASS**

```bash
npx vitest run lib/__tests__/overdue.test.ts
```

Expected: 5 passed.

- [ ] **Step 5: Create Column.tsx (static, no DnD yet)**

Create `C:/Projects/Plan/components/Column.tsx`:

```tsx
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
```

- [ ] **Step 6: Failing Board shell test**

Create `C:/Projects/Plan/components/__tests__/Board.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Board } from "../Board";

describe("Board (shell)", () => {
  it("renders three columns with correct labels", () => {
    render(<Board />);
    expect(screen.getByRole("region", { name: "To Do" })).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "In Progress" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Done" })).toBeInTheDocument();
  });

  it("shows empty-state placeholder in each column on first render", () => {
    render(<Board />);
    expect(screen.getAllByText("No tasks")).toHaveLength(3);
  });

  it("has an Add task button", () => {
    render(<Board />);
    expect(
      screen.getByRole("button", { name: /add task/i }),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Run — FAIL**

```bash
npx vitest run components/__tests__/Board.test.tsx
```

- [ ] **Step 8: Implement Board shell**

Create `C:/Projects/Plan/components/Board.tsx`:

```tsx
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
```

- [ ] **Step 9: Wire into app**

Replace `C:/Projects/Plan/app/page.tsx`:

```tsx
import { Board } from "@/components/Board";

export default function Page() {
  return <Board />;
}
```

Replace `C:/Projects/Plan/app/layout.tsx`:

```tsx
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Plan",
  description: "Personal Kanban",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 10: Run tests — PASS**

```bash
npx vitest run
```

Expected: all test files pass (storage, useTasks, overdue, Board).

- [ ] **Step 11: Commit**

```bash
git checkout -b feat/board-shell
git add lib/overdue.ts lib/__tests__/overdue.test.ts components/Column.tsx components/Board.tsx components/__tests__/Board.test.tsx app/page.tsx app/layout.tsx
git commit -m "feat(board): add three-column shell, Column component, isOverdue helper"
```

- [ ] **Step 12: progress.md**

```
- [x] Task 3: UI shell + overdue helper (feat/board-shell) — 2026-04-17
```

---

## Task 4: TaskCard + TaskDialog (CRUD wiring, no DnD)

**Branch:** `feat/task-crud`

**Files:**
- Create: `components/TaskCard.tsx`, `components/TaskDialog.tsx`, `components/__tests__/TaskCard.test.tsx`
- Modify: `components/Board.tsx`, `components/Column.tsx`

- [ ] **Step 1: Failing TaskCard test**

Create `C:/Projects/Plan/components/__tests__/TaskCard.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskCard } from "../TaskCard";
import type { Task } from "@/lib/types";

const task: Task = {
  id: "t1",
  title: "Ship it",
  description: "",
  dueDate: "2026-04-16",
  status: "todo",
  createdAt: 0,
};

describe("TaskCard", () => {
  it("renders title and due date", () => {
    render(<TaskCard task={task} onOpen={() => {}} today="2026-04-17" />);
    expect(screen.getByText("Ship it")).toBeInTheDocument();
    expect(screen.getByText("2026-04-16")).toBeInTheDocument();
  });

  it("applies overdue styling when past due and not done", () => {
    render(<TaskCard task={task} onOpen={() => {}} today="2026-04-17" />);
    const card = screen.getByRole("button", { name: /ship it/i });
    expect(card.className).toMatch(/border-red-500/);
  });

  it("does not apply overdue styling when done", () => {
    render(
      <TaskCard
        task={{ ...task, status: "done" }}
        onOpen={() => {}}
        today="2026-04-17"
      />,
    );
    const card = screen.getByRole("button", { name: /ship it/i });
    expect(card.className).not.toMatch(/border-red-500/);
  });

  it("fires onOpen with id when clicked", async () => {
    const onOpen = vi.fn();
    render(<TaskCard task={task} onOpen={onOpen} today="2026-04-17" />);
    await userEvent.click(screen.getByRole("button", { name: /ship it/i }));
    expect(onOpen).toHaveBeenCalledWith("t1");
  });
});
```

- [ ] **Step 2: Run — FAIL**

```bash
npx vitest run components/__tests__/TaskCard.test.tsx
```

- [ ] **Step 3: Implement TaskCard**

Create `C:/Projects/Plan/components/TaskCard.tsx`:

```tsx
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
```

- [ ] **Step 4: Implement TaskDialog**

Create `C:/Projects/Plan/components/TaskDialog.tsx`:

```tsx
"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Task, TaskStatus } from "@/lib/types";

export type DialogMode =
  | { kind: "create" }
  | { kind: "edit"; task: Task };

type Props = {
  mode: DialogMode;
  onClose: () => void;
  onSubmit: (task: Task) => void;
  onDelete?: (id: string) => void;
};

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function TaskDialog({ mode, onClose, onSubmit, onDelete }: Props) {
  const titleId = useId();
  const descId = useId();
  const dateId = useId();

  const existing = mode.kind === "edit" ? mode.task : null;
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [dueDate, setDueDate] = useState<string>(existing?.dueDate ?? "");
  const [status, setStatus] = useState<TaskStatus>(existing?.status ?? "todo");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Title is required.");
      return;
    }
    const payload: Task = existing
      ? {
          ...existing,
          title: trimmed,
          description,
          dueDate: dueDate || null,
          status,
        }
      : {
          id: newId(),
          title: trimmed,
          description,
          dueDate: dueDate || null,
          status,
          createdAt: Date.now(),
        };
    onSubmit(payload);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={existing ? "Edit task" : "New task"}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-lg bg-white p-4 shadow-lg"
      >
        <h2 className="mb-3 text-lg font-semibold">
          {existing ? "Edit task" : "New task"}
        </h2>

        <label htmlFor={titleId} className="block text-sm font-medium">
          Title
        </label>
        <input
          id={titleId}
          ref={firstFieldRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mb-2 w-full rounded border border-slate-300 p-1.5"
        />
        {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}

        <label htmlFor={descId} className="block text-sm font-medium">
          Description
        </label>
        <textarea
          id={descId}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mb-2 w-full rounded border border-slate-300 p-1.5"
          rows={3}
        />

        <label htmlFor={dateId} className="block text-sm font-medium">
          Due date
        </label>
        <input
          id={dateId}
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="mb-2 w-full rounded border border-slate-300 p-1.5"
        />

        <label className="block text-sm font-medium">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as TaskStatus)}
          className="mb-4 w-full rounded border border-slate-300 p-1.5"
        >
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
        </select>

        <div className="flex items-center justify-between gap-2">
          {existing && onDelete ? (
            confirmDelete ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onDelete(existing.id)}
                  className="rounded bg-red-600 px-3 py-1.5 text-sm text-white"
                >
                  Confirm delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="rounded border px-3 py-1.5 text-sm"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="rounded border border-red-500 px-3 py-1.5 text-sm text-red-600"
              >
                Delete
              </button>
            )
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border px-3 py-1.5 text-sm"
            >
              Close
            </button>
            <button
              type="submit"
              className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white"
            >
              Save
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Wire dialog + cards into Board**

Replace `C:/Projects/Plan/components/Board.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { Column } from "./Column";
import { TaskCard } from "./TaskCard";
import { TaskDialog, type DialogMode } from "./TaskDialog";
import { useTasks } from "@/lib/useTasks";
import { COLUMNS, type Task, type TaskStatus } from "@/lib/types";
import { todayISO } from "@/lib/overdue";

export function Board() {
  const { tasks, dispatch } = useTasks();
  const [dialog, setDialog] = useState<DialogMode | null>(null);
  const today = todayISO();

  const byStatus = useMemo(() => {
    const empty: Record<TaskStatus, Task[]> = {
      todo: [],
      in_progress: [],
      done: [],
    };
    for (const t of tasks) empty[t.status].push(t);
    return empty;
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

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Plan</h1>
        <button
          type="button"
          onClick={() => setDialog({ kind: "create" })}
          className="rounded bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          Add task
        </button>
      </div>
      <div className="flex flex-col gap-3 md:flex-row">
        {COLUMNS.map((c) => (
          <Column key={c.id} label={c.label} count={byStatus[c.id].length}>
            {byStatus[c.id].map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                onOpen={openEdit}
                today={today}
              />
            ))}
          </Column>
        ))}
      </div>
      {dialog ? (
        <TaskDialog
          mode={dialog}
          onClose={() => setDialog(null)}
          onSubmit={handleSubmit}
          onDelete={dialog.kind === "edit" ? handleDelete : undefined}
        />
      ) : null}
    </main>
  );
}
```

- [ ] **Step 6: Run full test suite — PASS**

```bash
npx vitest run
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git checkout -b feat/task-crud
git add components/TaskCard.tsx components/TaskDialog.tsx components/Board.tsx components/__tests__/TaskCard.test.tsx
git commit -m "feat(tasks): add TaskCard and TaskDialog with create/edit/delete flow"
```

- [ ] **Step 8: progress.md**

```
- [x] Task 4: TaskCard + TaskDialog CRUD (feat/task-crud) — 2026-04-17
```

---

## Task 5: Drag-and-drop wiring

**Branch:** `feat/dnd`

**Files:**
- Create: `lib/dragEnd.ts`, `lib/__tests__/dragEnd.test.ts`
- Modify: `components/Board.tsx`, `components/Column.tsx`, `components/TaskCard.tsx`

- [ ] **Step 1: Failing pure dragEnd test**

Create `C:/Projects/Plan/lib/__tests__/dragEnd.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveDragEnd } from "../dragEnd";

describe("resolveDragEnd", () => {
  it("returns null when there is no over target", () => {
    expect(resolveDragEnd({ activeId: "t1", overId: null })).toBeNull();
  });

  it("returns null when overId is not a known column", () => {
    expect(resolveDragEnd({ activeId: "t1", overId: "random" })).toBeNull();
  });

  it("returns move payload when dropped on a column id", () => {
    expect(resolveDragEnd({ activeId: "t1", overId: "done" })).toEqual({
      id: "t1",
      status: "done",
    });
  });

  it("works for in_progress column id", () => {
    expect(resolveDragEnd({ activeId: "t1", overId: "in_progress" })).toEqual({
      id: "t1",
      status: "in_progress",
    });
  });
});
```

- [ ] **Step 2: Run — FAIL**

```bash
npx vitest run lib/__tests__/dragEnd.test.ts
```

- [ ] **Step 3: Implement resolveDragEnd**

Create `C:/Projects/Plan/lib/dragEnd.ts`:

```ts
import { COLUMNS, type TaskStatus } from "./types";

const COLUMN_IDS = new Set<TaskStatus>(COLUMNS.map((c) => c.id));

export type DragEndInput = {
  activeId: string;
  overId: string | null;
};

export type DragEndResult = { id: string; status: TaskStatus } | null;

export function resolveDragEnd(input: DragEndInput): DragEndResult {
  if (!input.overId) return null;
  if (!COLUMN_IDS.has(input.overId as TaskStatus)) return null;
  return { id: input.activeId, status: input.overId as TaskStatus };
}
```

- [ ] **Step 4: Run — PASS**

```bash
npx vitest run lib/__tests__/dragEnd.test.ts
```

- [ ] **Step 5: Make Column droppable**

Replace `C:/Projects/Plan/components/Column.tsx`:

```tsx
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
```

- [ ] **Step 6: Make TaskCard draggable**

Replace `C:/Projects/Plan/components/TaskCard.tsx`:

```tsx
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
```

Note: `@dnd-kit/utilities` ships with `@dnd-kit/core`; no new install needed. If `CSS` import fails at build time, run `npm install @dnd-kit/utilities`.

- [ ] **Step 7: Wire DndContext in Board**

Replace top of `C:/Projects/Plan/components/Board.tsx` to import and use `DndContext`. Full replacement file:

```tsx
"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Column } from "./Column";
import { TaskCard } from "./TaskCard";
import { TaskDialog, type DialogMode } from "./TaskDialog";
import { useTasks } from "@/lib/useTasks";
import { COLUMNS, type Task, type TaskStatus } from "@/lib/types";
import { todayISO } from "@/lib/overdue";
import { resolveDragEnd } from "@/lib/dragEnd";

export function Board() {
  const { tasks, dispatch } = useTasks();
  const [dialog, setDialog] = useState<DialogMode | null>(null);
  const today = todayISO();

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const byStatus = useMemo(() => {
    const empty: Record<TaskStatus, Task[]> = {
      todo: [],
      in_progress: [],
      done: [],
    };
    for (const t of tasks) empty[t.status].push(t);
    return empty;
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

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <main className="mx-auto flex max-w-6xl flex-col gap-4 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-800">Plan</h1>
          <button
            type="button"
            onClick={() => setDialog({ kind: "create" })}
            className="rounded bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
          >
            Add task
          </button>
        </div>
        <div className="flex flex-col gap-3 md:flex-row">
          {COLUMNS.map((c) => (
            <Column
              key={c.id}
              id={c.id}
              label={c.label}
              count={byStatus[c.id].length}
            >
              {byStatus[c.id].map((t) => (
                <TaskCard key={t.id} task={t} onOpen={openEdit} today={today} />
              ))}
            </Column>
          ))}
        </div>
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
```

- [ ] **Step 8: Run full suite — PASS**

```bash
npx vitest run
```

Expected: all pass. If `Board.test.tsx` trips over DndContext, it should still pass since the shell assertions (regions, buttons) are unaffected. If it fails due to pointer-event polyfill, wrap the test render in `<DndContext>` — but with default sensors this is not expected.

- [ ] **Step 9: Commit**

```bash
git checkout -b feat/dnd
git add lib/dragEnd.ts lib/__tests__/dragEnd.test.ts components/Board.tsx components/Column.tsx components/TaskCard.tsx
git commit -m "feat(dnd): wire @dnd-kit context, droppable columns, draggable cards"
```

- [ ] **Step 10: progress.md**

```
- [x] Task 5: Drag-and-drop (feat/dnd) — 2026-04-17
```

---

## Task 6: Persistence hydration guard (SSR safety)

**Branch:** `feat/persistence`

**Files:**
- Modify: `app/page.tsx`, `components/Board.tsx`

Note: `useTasks` already hydrates inside `useEffect`, but `app/page.tsx` must be a Server Component in App Router; `Board` being a client component is what allows `useTasks` to run only on the client. To avoid any SSR/client text mismatch in card rendering (e.g., `todayISO` computed at render), we guard with a mounted flag.

- [ ] **Step 1: Add mounted guard in Board**

In `C:/Projects/Plan/components/Board.tsx`, at the top of the component body, add:

```tsx
const [mounted, setMounted] = useState(false);
// existing useMemo, etc...
```

And after `const { tasks, dispatch } = useTasks();`, add:

```tsx
import { useEffect } from "react"; // add to existing react import if missing
// ...
useEffect(() => setMounted(true), []);
```

(Combine the import with the existing `useMemo, useState` import rather than duplicating.)

Then replace the final `<div className="flex flex-col gap-3 md:flex-row">...</div>` block with a guarded version so columns render empty on SSR and fill after mount:

```tsx
<div className="flex flex-col gap-3 md:flex-row">
  {COLUMNS.map((c) => (
    <Column
      key={c.id}
      id={c.id}
      label={c.label}
      count={mounted ? byStatus[c.id].length : 0}
    >
      {mounted
        ? byStatus[c.id].map((t) => (
            <TaskCard key={t.id} task={t} onOpen={openEdit} today={today} />
          ))
        : null}
    </Column>
  ))}
</div>
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run
```

Expected: all pass. (Tests run in jsdom where `useEffect` fires synchronously in `act`, so mounted becomes true before assertions.)

- [ ] **Step 3: Smoke-test in dev**

```bash
npm run dev
```

Open http://localhost:3000 in a browser, create a task, reload, confirm it persists. Stop server with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git checkout -b feat/persistence
git add components/Board.tsx
git commit -m "feat(persistence): add mounted guard to prevent SSR hydration mismatch"
```

- [ ] **Step 5: progress.md**

```
- [x] Task 6: Persistence hydration guard (feat/persistence) — 2026-04-17
```

---

## Task 7: Final polish — lint, build, overdue visual check, PR

**Branch:** `feat/polish`

**Files:**
- Modify: `docs/progress.md`

- [ ] **Step 1: Lint**

```bash
npm run lint
```

Expected: no errors. If warnings about unused imports appear, remove them and rerun.

- [ ] **Step 2: Type-check via build**

```bash
npm run build
```

Expected: "Compiled successfully" and a static export of `/`.

- [ ] **Step 3: Full test suite**

```bash
npm run test
```

Expected: all test files PASS. Count should be 4 test files (storage, useTasks, overdue, dragEnd) + 2 component files (Board, TaskCard).

- [ ] **Step 4: Manual acceptance run**

```bash
npm run dev
```

Walk through the PRD manual checklist in a browser:
1. Create a task with a past due date in "To Do" → red border + red date text visible.
2. Drag to "Done" with mouse → red border removed.
3. Reload → state restored.
4. Edit title → change persists on reload.
5. Delete with confirm → gone after reload.
6. Tab-focus a card, press Space, arrow keys move between columns, Space drops → status updates.

Stop dev server.

- [ ] **Step 5: Append session log to progress.md**

Append to `C:/Projects/Plan/docs/progress.md`:

```
## Session log — 2026-04-17
- Task 0–7 complete. npm run lint and npm run build pass. Manual acceptance checklist verified on Chrome desktop.
- [x] F1 Task CRUD
- [x] F2 Three-column board
- [x] F3 Drag-and-drop
- [x] F4 Persistence + overdue highlight
```

- [ ] **Step 6: Commit**

```bash
git checkout -b feat/polish
git add docs/progress.md
git commit -m "chore: mark all milestones complete, session log 2026-04-17"
```

- [ ] **Step 7: Open final PR**

If a remote exists:

```bash
git push -u origin feat/polish
gh pr create --title "Simple Kanban v0.1.0" --body "All four features (F1–F4) complete. Build + lint + Vitest pass. Ready for review."
```

If no remote: stop here and report completion. Do not merge any branch to `main` without user approval.

---

## Self-Review — Spec Coverage Map

| Requirement | Covered by |
|---|---|
| F1 Task CRUD (create/edit/delete, required title, id, persistence of mutations) | Task 2 (reducer), Task 4 (dialog + wiring), Task 6 (persistence) |
| F2 Three-column board (fixed columns, counts, empty state, responsive) | Task 3 (Column + Board shell), Task 4 (card rendering) |
| F3 Drag-and-drop (mouse/touch/keyboard sensors, move updates status, drop outside cancels) | Task 5 (DndContext, sensors, resolveDragEnd null on no target) |
| F4 localStorage persistence + overdue highlight (hydration, corrupt fallback, reactive overdue) | Task 1 (storage w/ validation), Task 2 (hydration effect), Task 3 (isOverdue), Task 4 (card styling), Task 6 (mount guard) |
| PRD 4.1 title validation + confirm-delete + Escape close | Task 4 (TaskDialog) |
| PRD 6 success metrics: `npm run lint` + `npm run build` pass | Task 0 (initial), Task 7 (final) |
| Acceptance: dueDate "today" not overdue (strict `<`) | Task 3 overdue tests |
| Acceptance: corrupt localStorage falls back to [] | Task 1 storage tests |
| Global CLAUDE.md: feature branches + PR at end; never commit to main | Every task creates `feat/*` branch; Task 7 opens PR |
| progress.md milestone + session log | Appended at end of each task; consolidated in Task 7 |

**Type consistency check:** `TaskStatus` values are `"todo" | "in_progress" | "done"` (underscore form) in `lib/types.ts` and are used consistently in reducer actions, column ids, select options, and `resolveDragEnd`. `createdAt` is `number` everywhere. No divergent method names across tasks.

**No out-of-scope features planned.** Exactly F1–F4; no fifth feature introduced.
