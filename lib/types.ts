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
