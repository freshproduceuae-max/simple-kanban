# Personal Kanban — Product Requirements Document

## 1. Overview / Goal

Personal Kanban is a single-user, browser-local task board for organizing personal work. It provides a minimal, distraction-free Kanban surface with three fixed columns and drag-and-drop interaction. The goal is to ship a small, reliable, fully offline tool that a solo user can open in a browser, add tasks to, and return to later with their data intact — without accounts, servers, or sync.

Success means: the app works end-to-end on first load, persists locally, and respects accessibility basics.

## 2. Target User & Use Case

**User:** A solo individual (developer, student, freelancer) who wants a lightweight personal task tracker and does not need collaboration, cloud sync, or mobile apps.

**Use case:** Open the app in a desktop or mobile browser, jot down tasks, move them across "To Do → In Progress → Done" as work progresses, and rely on an overdue indicator to surface slipping work.

## 3. Assumptions & Constraints

- Single user per browser profile; no identity or auth.
- All data lives in `localStorage` on the user's device. Clearing site data wipes the board; this is acceptable.
- Modern evergreen browser (latest Chrome, Firefox, Safari, Edge).
- No backend, no network calls for data.
- Keyboard, mouse, and touch must all work for drag-and-drop.

## 4. In-Scope Features

### 4.1 Task CRUD via Modal Dialog

**Description:** Users can create, edit, and delete tasks through a single modal dialog. Fields: title (required), description (optional), due date (optional ISO date).

**Data model:**

```ts
type Status = "todo" | "in-progress" | "done";
type Task = {
  id: string;           // uuid
  title: string;        // required, non-empty
  description?: string;
  dueDate: string | null; // ISO date (YYYY-MM-DD) or null
  status: Status;
  createdAt: string;    // ISO timestamp
};
```

**User story:** As a user, I want to add, edit, and remove tasks so I can keep my board current.

**Acceptance criteria:**
- Clicking "Add task" opens a modal with empty fields; "To Do" is the default status for new tasks.
- Submitting with an empty or whitespace-only title blocks submission and shows an inline error.
- Clicking an existing card opens the same modal pre-populated, including a "Delete" action.
- Delete requires a confirmation step before removing the task.
- Modal is dismissible via Escape, backdrop click, and a Close button; focus is trapped while open and returns to the trigger on close.
- Create, edit, and delete each show immediate UI feedback (optimistic) and persist to `localStorage`.

### 4.2 Three-Column Kanban Board

**Description:** A fixed-layout board with three columns in order: "To Do", "In Progress", "Done". Columns are not configurable.

**User story:** As a user, I want to see my tasks grouped by status so I can understand what's next.

**Acceptance criteria:**
- Exactly three columns render, labeled "To Do", "In Progress", "Done".
- Each column shows its task count in the header.
- Empty columns show a neutral placeholder ("No tasks").
- Layout is responsive: columns stack vertically below a mobile breakpoint and sit side-by-side on desktop.
- Cards display title, due date (if set), and an overdue indicator when applicable.

### 4.3 Drag-and-Drop Between Columns (@dnd-kit)

**Description:** Users can move tasks between columns via drag-and-drop using `@dnd-kit/core`, with mouse, touch, and keyboard support.

**User story:** As a user, I want to drag a task from one column to another to update its status without opening a dialog.

**Acceptance criteria:**
- Mouse drag moves a card to any of the three columns and updates `status` accordingly.
- Touch drag works on a mobile browser.
- Keyboard sensor is enabled: focusing a card and pressing Space/Enter picks it up; arrow keys move it; Space/Enter drops it; Escape cancels.
- The drop target column highlights while a card is being dragged over it.
- A drag that ends outside any column returns the card to its original position.
- Status change persists to `localStorage` immediately on drop.

### 4.4 localStorage Persistence + Overdue Highlight

**Description:** Board state is persisted to `localStorage` and rehydrated on load. Tasks with a past due date and non-done status are visually flagged.

**User story:** As a user, I want my board to survive reloads and I want overdue tasks to stand out.

**Acceptance criteria:**
- On load, the app reads from a single `localStorage` key and restores all tasks exactly as last saved (columns, order, fields).
- Every create/edit/delete/drag writes the new state to `localStorage` before the interaction is considered complete.
- Corrupt or missing storage falls back to an empty board without throwing.
- A task where `dueDate < today && status !== "done"` renders with red styling on the card border and due-date text.
- The overdue check uses the user's local date; tasks due "today" are not overdue.

## 5. Out of Scope / Non-Goals

The following are explicitly excluded from v1:
- Authentication or user accounts
- Multi-user collaboration or sharing
- Cloud sync or cross-device persistence
- Custom or reorderable columns
- Labels, tags, priorities, or colors
- File attachments
- Comments or activity history
- Subtasks or checklists
- Native mobile apps
- Search, filters, or sorting controls
- Notifications or reminders

## 6. Success Metrics (Qualitative)

- Reloading the browser restores the board exactly (columns, order, fields).
- A keyboard-only user can create, edit, move, and delete a task end-to-end.
- Overdue tasks are visually distinguishable at a glance.
- `npm run lint` and `npm run build` both pass with zero errors.
- Manual test checklist (below) passes on Chrome desktop and one mobile browser.

## 7. Technical Constraints

- Next.js 14 (App Router), TypeScript strict mode, Tailwind CSS, npm.
- Drag-and-drop via `@dnd-kit/core` only.
- No additional npm packages beyond `@dnd-kit/core` without explicit approval.
- No backend routes; the app is effectively a static client app.
- Client-only state; persistence via `localStorage` under a single namespaced key.

## 8. Release Criteria

The app is considered done when all of the following are true:

- `npm run build` succeeds with no errors.
- `npm run lint` succeeds with no errors.
- TypeScript strict mode compiles with no errors.
- Manual test checklist passes:
  - Create a task; reload; task persists.
  - Edit a task's title, description, and due date; changes persist.
  - Delete a task with confirmation; task does not reappear on reload.
  - Drag a task across all three columns with mouse.
  - Move a task across columns using keyboard only.
  - Move a task on a touch device.
  - Set a due date in the past on a non-done task; card and date render red.
  - Mark the overdue task as Done; red styling is removed.
  - Clear `localStorage`; app loads cleanly with an empty board.
- No console errors on load or during standard interactions.
