# Simple Kanban — Design Spec

**Date:** 2026-04-17
**Status:** Approved (brainstorming phase)
**Owner:** Chief architect (Claude) directs; subagents execute.

## 1. Summary

A single-user, browser-local Kanban board for personal project planning. Users create tasks with a title, description, and due date, then drag them between three fixed stages: **To Do → In Progress → Done**. All data persists in `localStorage`. No login, no backend, no multi-user features.

## 2. Goals & Non-Goals

### Goals
- Drag-and-drop task movement between three fixed columns.
- Task cards show title and due date; click to view/edit full details.
- Overdue tasks (not yet in "Done") are visually highlighted.
- Data survives browser reload via `localStorage`.

### Non-Goals (explicitly out of scope)
- Authentication, accounts, multi-device sync.
- Multi-user collaboration or realtime updates.
- Customizable or additional columns.
- Labels, tags, priorities, attachments, comments, subtasks.
- Backend API, database, server components that persist data.
- Mobile native apps.

## 3. Stack & Key Decisions

| Area | Choice | Reason |
|---|---|---|
| Framework | Next.js 14 App Router | Global default |
| Language | TypeScript (strict) | Global default |
| Styling | Tailwind CSS | Global default |
| Package manager | npm | Global default |
| Drag & drop | `@dnd-kit/core` | Maintained, accessible, ~10KB |
| Persistence | `localStorage` | Zero-infra; meets solo/local scope |
| Rendering | Single client component tree | No server data; SSR not needed |

## 4. Architecture

```
app/
  layout.tsx              # Root layout (Tailwind globals)
  page.tsx                # Client-only Board page
components/
  Board.tsx               # DnD context + 3 columns + state owner
  Column.tsx              # Droppable zone; renders tasks
  TaskCard.tsx            # Draggable card (title, due date)
  TaskDialog.tsx          # Modal for create/edit (title, desc, due date)
lib/
  storage.ts              # loadTasks(), saveTasks() — localStorage
  types.ts                # Task, TaskStatus types
docs/
  vision.md               # Vision
  prd.md                  # PRD
  features.json           # 4-feature list (machine-readable)
  progress.md             # Live progress log for session handoff
  handoff.md              # Instructions for future Claude sessions
```

### Data model
```ts
type TaskStatus = "todo" | "in_progress" | "done";

type Task = {
  id: string;          // crypto.randomUUID()
  title: string;       // required
  description: string; // optional, default ""
  dueDate: string | null; // ISO date (YYYY-MM-DD)
  status: TaskStatus;
  createdAt: number;   // Date.now()
};
```

### Data flow
- `Board` owns `useState<Task[]>`, hydrated from `localStorage` on mount.
- Every mutation (`add`, `edit`, `delete`, `move`) updates state; a `useEffect` persists the array to `localStorage` on change.
- DnD end handler mutates only the moved task's `status`.
- Overdue = `dueDate < today && status !== "done"`. Computed at render time; card gets a red border/date text.

## 5. The 4 Features (capped per user instruction)

1. **Task CRUD** — Create, edit, delete tasks (title, description, due date) via modal.
2. **Three-column Kanban board** — Fixed stages: To Do, In Progress, Done.
3. **Drag-and-drop between columns** — `@dnd-kit` with mouse, touch, keyboard support.
4. **localStorage persistence with overdue highlight** — State survives reloads; past-due non-done tasks are visually flagged.

## 6. Acceptance Criteria

- Reloading the page restores the exact prior board state.
- A task dragged from "To Do" to "Done" appears in "Done" and persists after reload.
- Creating a task with a past due date in "To Do" shows the overdue style immediately.
- `npm run build` and `npm run lint` pass.
- Keyboard-only user can move tasks (dnd-kit keyboard sensors).

## 7. Risks / Open Questions

- None blocking. Tailwind v3 vs v4 is an implementation-time decision (default to whatever `create-next-app` scaffolds).

## 8. Delegation Plan

Chief architect (main session) does not write feature code. Sequence:

1. **Doc subagents (parallel):** Vision, PRD, features.json, progress+handoff scaffolding.
2. **Plan subagent:** Invokes `writing-plans` to produce implementation plan.
3. **Implementation subagent(s):** Execute plan stepwise, updating `progress.md` after each step so any future session can resume.
