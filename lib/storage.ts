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
