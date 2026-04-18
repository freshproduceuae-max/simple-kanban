export type TaskStatus = "todo" | "in_progress" | "done";
export type Priority = "low" | "medium" | "high";

export type Task = {
  id: string;
  title: string;
  description: string;
  dueDate: string | null;
  status: TaskStatus;
  priority: Priority;
  tags: string[];
  createdAt: number;
};

export const COLUMNS: { id: TaskStatus; label: string; blurb: string }[] = [
  { id: "todo", label: "To Do", blurb: "Ideas, inbox, not yet started" },
  { id: "in_progress", label: "In Progress", blurb: "Active work this week" },
  { id: "done", label: "Done", blurb: "Shipped & closed" },
];

export const PRIORITIES: { id: Priority; label: string }[] = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
];

export const STORAGE_KEY = "kanban.tasks";
