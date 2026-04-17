import { describe, it, expect, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import { STORAGE_KEY, type Task } from "../types";
import { useTasks } from "../useTasks";

const seeded: Task[] = [
  {
    id: "x1",
    title: "Seeded",
    description: "",
    dueDate: null,
    status: "todo",
    createdAt: 1,
  },
];

function Probe() {
  const { tasks } = useTasks();
  return <div data-testid="count">{tasks.length}</div>;
}

describe("useTasks hydration", () => {
  beforeEach(() => localStorage.clear());

  it("does not overwrite localStorage with [] on first render when tasks exist", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    await act(async () => {
      render(<Probe />);
    });
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed).toEqual(seeded);
  });
});
