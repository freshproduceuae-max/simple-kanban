import {
  STORAGE_KEY,
  type Priority,
  type Task,
  type TaskStatus,
} from "./types";

const STATUSES: TaskStatus[] = ["todo", "in_progress", "done"];
const PRIORITY_VALUES: Priority[] = ["low", "medium", "high"];

function coerceTask(v: unknown): Task | null {
  if (!v || typeof v !== "object") return null;
  const t = v as Record<string, unknown>;
  if (
    typeof t.id !== "string" ||
    typeof t.title !== "string" ||
    typeof t.description !== "string" ||
    !(t.dueDate === null || typeof t.dueDate === "string") ||
    typeof t.status !== "string" ||
    !STATUSES.includes(t.status as TaskStatus) ||
    typeof t.createdAt !== "number"
  ) {
    return null;
  }
  const priority: Priority =
    typeof t.priority === "string" &&
    PRIORITY_VALUES.includes(t.priority as Priority)
      ? (t.priority as Priority)
      : "medium";
  const tags: string[] = Array.isArray(t.tags)
    ? (t.tags.filter((x): x is string => typeof x === "string"))
    : [];
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    dueDate: t.dueDate as string | null,
    status: t.status as TaskStatus,
    priority,
    tags,
    createdAt: t.createdAt,
  };
}

export function loadTasks(): Task[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const tasks: Task[] = [];
    for (const item of parsed) {
      const t = coerceTask(item);
      if (t) tasks.push(t);
    }
    return tasks;
  } catch {
    return [];
  }
}

export function saveTasks(tasks: Task[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}
