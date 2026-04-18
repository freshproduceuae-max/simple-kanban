import type { Task } from "./types";

/**
 * A handful of realistic demo tasks so the board has something to show
 * on first visit. The user can clear them any time via the trash button.
 */
export function buildDemoTasks(now: number = Date.now()): Task[] {
  const day = 24 * 60 * 60 * 1000;
  const iso = (offsetDays: number) =>
    new Date(now + offsetDays * day).toISOString().slice(0, 10);

  return [
    {
      id: "demo-1",
      title: "Sketch new landing hero",
      description:
        "Three variations: editorial, minimal, and maximalist. Pick one by Friday review.",
      dueDate: iso(2),
      status: "todo",
      priority: "high",
      tags: ["design", "marketing"],
      createdAt: now - 5 * day,
    },
    {
      id: "demo-2",
      title: "Review Q2 roadmap draft",
      description: "Leave inline comments, focus on staffing.",
      dueDate: iso(-1),
      status: "todo",
      priority: "medium",
      tags: ["planning"],
      createdAt: now - 4 * day,
    },
    {
      id: "demo-3",
      title: "Refactor auth provider",
      description: "Split session + user concerns. Keep hook signature stable.",
      dueDate: iso(5),
      status: "in_progress",
      priority: "high",
      tags: ["eng", "cleanup"],
      createdAt: now - 3 * day,
    },
    {
      id: "demo-4",
      title: "Write weekly note",
      description: "",
      dueDate: iso(0),
      status: "in_progress",
      priority: "low",
      tags: ["writing"],
      createdAt: now - 2 * day,
    },
    {
      id: "demo-5",
      title: "Ship CI workflow",
      description: "Lint + test + build on every PR.",
      dueDate: null,
      status: "done",
      priority: "medium",
      tags: ["eng", "infra"],
      createdAt: now - 1 * day,
    },
    {
      id: "demo-6",
      title: "Close out billing review",
      description: "",
      dueDate: iso(-3),
      status: "done",
      priority: "low",
      tags: ["admin"],
      createdAt: now - 6 * day,
    },
  ];
}
