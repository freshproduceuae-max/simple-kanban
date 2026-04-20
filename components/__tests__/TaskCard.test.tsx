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
  createdAt: 0,
};

describe("TaskCard", () => {
  it("renders title and due date", () => {
    render(<TaskCard task={task} onOpen={() => {}} today="2026-04-17" />);
    expect(screen.getByText("Ship it")).toBeInTheDocument();
    expect(screen.getByText("2026-04-16")).toBeInTheDocument();
  });

  it("applies overdue styling when past due and not done", () => {
    render(<TaskCard task={task} onOpen={() => {}} today="2026-04-17" />);
    const card = screen.getByRole("button", { name: /ship it/i });
    expect(card.className).toMatch(/border-accent-terra-500/);
  });

  it("does not apply overdue styling when done", () => {
    render(
      <TaskCard
        task={{ ...task, status: "done" }}
        onOpen={() => {}}
        today="2026-04-17"
      />,
    );
    const card = screen.getByRole("button", { name: /ship it/i });
    expect(card.className).not.toMatch(/border-accent-terra-500/);
  });

  it("fires onOpen with id when clicked", async () => {
    const onOpen = vi.fn();
    render(<TaskCard task={task} onOpen={onOpen} today="2026-04-17" />);
    await userEvent.click(screen.getByRole("button", { name: /ship it/i }));
    expect(onOpen).toHaveBeenCalledWith("t1");
  });
});
