import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Board } from "../Board";

describe("Board (shell)", () => {
  it("renders three columns with correct labels", () => {
    render(<Board />);
    expect(screen.getByRole("region", { name: "To Do" })).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "In Progress" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Done" })).toBeInTheDocument();
  });

  it("shows empty-state placeholder in each column on first render", () => {
    render(<Board />);
    expect(screen.getAllByText("No tasks")).toHaveLength(3);
  });

  it("has an Add task button", () => {
    render(<Board />);
    expect(
      screen.getByRole("button", { name: /add task/i }),
    ).toBeInTheDocument();
  });
});
