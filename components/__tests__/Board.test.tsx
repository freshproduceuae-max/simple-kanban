import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Board } from "../Board";

// Server Actions can't execute in jsdom — stub the module so we can
// assert the shell renders without hitting Supabase.
vi.mock("@/lib/board/actions", () => ({
  createTaskAction: vi.fn(),
  editTaskAction: vi.fn(),
  deleteTaskAction: vi.fn(),
  moveTaskAction: vi.fn(),
  migrateLocalTasksAction: vi.fn(async () => ({ ok: true, value: { migrated: 0 } })),
}));

describe("Board (shell)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders three columns with correct labels", () => {
    render(<Board initialTasks={[]} />);
    expect(screen.getByRole("region", { name: "To Do" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "In Progress" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Done" })).toBeInTheDocument();
  });

  it("shows empty-state placeholder in each column when initialTasks is empty", () => {
    render(<Board initialTasks={[]} />);
    expect(screen.getAllByText("No tasks")).toHaveLength(3);
  });

  it("has an Add task button", () => {
    render(<Board initialTasks={[]} />);
    expect(screen.getByRole("button", { name: /add task/i })).toBeInTheDocument();
  });

  it("renders server-provided tasks into their columns", () => {
    render(
      <Board
        initialTasks={[
          { id: "t1", title: "Hydrated todo", description: "", dueDate: null, status: "todo", createdAt: 1 },
          { id: "t2", title: "Hydrated done", description: "", dueDate: null, status: "done", createdAt: 2 },
        ]}
      />,
    );
    expect(screen.getByText("Hydrated todo")).toBeInTheDocument();
    expect(screen.getByText("Hydrated done")).toBeInTheDocument();
  });
});
