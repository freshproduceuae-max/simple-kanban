import { describe, it, expect } from "vitest";
import { tasksReducer, type TasksAction } from "../useTasks";
import type { Task } from "../types";

const base: Task = {
  id: "t1",
  title: "Write plan",
  description: "",
  dueDate: null,
  status: "todo",
  priority: "medium",
  tags: [],
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
