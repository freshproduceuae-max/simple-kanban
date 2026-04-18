import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskCard } from "../TaskCard";
import type { Task } from "@/lib/types";

const task: Task = {
  id: "t1",
  title: "Ship it",
  description: "",
  dueDate: "2026-04-16",
  status: "todo",
  priority: "medium",
  tags: [],
  createdAt: 0,
};

describe("TaskCard", () => {
  it("renders title and formatted due date", () => {
    render(<TaskCard task={task} onOpen={() => {}} today="2026-04-17" />);
    expect(screen.getByText("Ship it")).toBeInTheDocument();
    // Editorial date format: "Apr 16"
    expect(screen.getByText(/Apr 16/)).toBeInTheDocument();
  });

  it("shows overdue indicator when past due and not done", () => {
    render(<TaskCard task={task} onOpen={() => {}} today="2026-04-17" />);
    expect(screen.getByText(/▲/)).toBeInTheDocument();
  });

  it("does not show overdue indicator when done", () => {
    render(
      <TaskCard
        task={{ ...task, status: "done" }}
        onOpen={() => {}}
        today="2026-04-17"
      />,
    );
    expect(screen.queryByText(/▲/)).toBeNull();
  });

  it("fires onOpen with id when clicked", async () => {
    const onOpen = vi.fn();
    render(<TaskCard task={task} onOpen={onOpen} today="2026-04-17" />);
    await userEvent.click(screen.getByRole("button", { name: /ship it/i }));
    expect(onOpen).toHaveBeenCalledWith("t1");
  });

  it("renders tags with a # prefix", () => {
    render(
      <TaskCard
        task={{ ...task, tags: ["design", "eng"] }}
        onOpen={() => {}}
        today="2026-04-17"
      />,
    );
    expect(screen.getByText("#design")).toBeInTheDocument();
    expect(screen.getByText("#eng")).toBeInTheDocument();
  });
});
