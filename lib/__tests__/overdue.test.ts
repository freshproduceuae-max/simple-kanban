import { describe, it, expect } from "vitest";
import { isOverdue } from "../overdue";
import type { Task } from "../types";

const make = (over: Partial<Task>): Task => ({
  id: "x",
  title: "x",
  description: "",
  dueDate: null,
  status: "todo",
  priority: "medium",
  tags: [],
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
