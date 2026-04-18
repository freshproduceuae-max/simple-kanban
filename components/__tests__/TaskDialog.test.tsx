import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskDialog } from "../TaskDialog";
import type { Task } from "@/lib/types";

const existing: Task = {
  id: "t1",
  title: "Original",
  description: "desc",
  dueDate: "2026-05-01",
  status: "in_progress",
  priority: "medium",
  tags: [],
  createdAt: 0,
};

describe("TaskDialog", () => {
  it("blocks submit when title is empty or whitespace", async () => {
    const onSubmit = vi.fn();
    render(
      <TaskDialog
        mode={{ kind: "create" }}
        onClose={() => {}}
        onSubmit={onSubmit}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/title is required/i)).toBeInTheDocument();
  });

  it("submits a new task with trimmed title when create mode", async () => {
    const onSubmit = vi.fn();
    render(
      <TaskDialog
        mode={{ kind: "create" }}
        onClose={() => {}}
        onSubmit={onSubmit}
      />,
    );
    await userEvent.type(screen.getByLabelText("Title"), "  New thing  ");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const arg = onSubmit.mock.calls[0][0] as Task;
    expect(arg.title).toBe("New thing");
    expect(arg.status).toBe("todo");
    expect(typeof arg.id).toBe("string");
    expect(arg.id.length).toBeGreaterThan(0);
  });

  it("prefills and submits an edit with the existing id and createdAt", async () => {
    const onSubmit = vi.fn();
    render(
      <TaskDialog
        mode={{ kind: "edit", task: existing }}
        onClose={() => {}}
        onSubmit={onSubmit}
      />,
    );
    const titleInput = screen.getByLabelText("Title") as HTMLInputElement;
    expect(titleInput.value).toBe("Original");
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, "Renamed");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    const arg = onSubmit.mock.calls[0][0] as Task;
    expect(arg.id).toBe("t1");
    expect(arg.createdAt).toBe(0);
    expect(arg.title).toBe("Renamed");
  });

  it("fires onClose on Escape", async () => {
    const onClose = vi.fn();
    render(
      <TaskDialog
        mode={{ kind: "create" }}
        onClose={onClose}
        onSubmit={() => {}}
      />,
    );
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("requires two clicks to delete (confirm flow)", async () => {
    const onDelete = vi.fn();
    render(
      <TaskDialog
        mode={{ kind: "edit", task: existing }}
        onClose={() => {}}
        onSubmit={() => {}}
        onDelete={onDelete}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /delete this task/i }),
    );
    expect(onDelete).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("button", { name: /confirm delete/i }),
    );
    expect(onDelete).toHaveBeenCalledWith("t1");
  });

  it("wraps Tab focus from last to first focusable", async () => {
    render(
      <TaskDialog
        mode={{ kind: "create" }}
        onClose={() => {}}
        onSubmit={() => {}}
      />,
    );
    const title = screen.getByLabelText("Title");
    const save = screen.getByRole("button", { name: "Save" });
    save.focus();
    expect(document.activeElement).toBe(save);
    await userEvent.tab();
    expect(document.activeElement).toBe(title);
  });
});
