import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Board } from "../Board";

describe("Board", () => {
  beforeEach(() => localStorage.clear());

  it("shows an empty-state hero on first load", async () => {
    await act(async () => {
      render(<Board />);
    });
    expect(screen.getByText(/nothing planned/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /load demo data/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /new task/i }),
    ).toBeInTheDocument();
  });

  it("renders three columns once demo data is loaded", async () => {
    await act(async () => {
      render(<Board />);
    });
    await userEvent.click(
      screen.getByRole("button", { name: /load demo data/i }),
    );
    expect(screen.getByRole("region", { name: "To Do" })).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "In Progress" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Done" })).toBeInTheDocument();
  });

  it("has a New task button in the masthead", async () => {
    await act(async () => {
      render(<Board />);
    });
    expect(
      screen.getByRole("button", { name: /new task/i }),
    ).toBeInTheDocument();
  });
});
