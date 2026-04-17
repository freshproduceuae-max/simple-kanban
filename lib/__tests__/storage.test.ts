import { describe, it, expect, beforeEach } from "vitest";
import { loadTasks, saveTasks } from "../storage";
import { STORAGE_KEY, type Task } from "../types";

const sample: Task[] = [
  {
    id: "a",
    title: "Hello",
    description: "",
    dueDate: null,
    status: "todo",
    createdAt: 1,
  },
];

describe("storage", () => {
  beforeEach(() => localStorage.clear());

  it("returns [] when key is missing", () => {
    expect(loadTasks()).toEqual([]);
  });

  it("returns [] when value is malformed JSON", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    expect(loadTasks()).toEqual([]);
  });

  it("returns [] when value is not an array", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ foo: 1 }));
    expect(loadTasks()).toEqual([]);
  });

  it("round-trips an array of tasks", () => {
    saveTasks(sample);
    expect(loadTasks()).toEqual(sample);
  });

  it("drops entries that don't match the Task shape", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([sample[0], { id: 2 }, null]),
    );
    expect(loadTasks()).toEqual(sample);
  });
});
