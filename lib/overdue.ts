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
