import { describe, it, expect } from "vitest";
import { resolveDragEnd } from "../dragEnd";

describe("resolveDragEnd", () => {
  it("returns null when there is no over target", () => {
    expect(resolveDragEnd({ activeId: "t1", overId: null })).toBeNull();
  });

  it("returns null when overId is not a known column", () => {
    expect(resolveDragEnd({ activeId: "t1", overId: "random" })).toBeNull();
  });

  it("returns move payload when dropped on a column id", () => {
    expect(resolveDragEnd({ activeId: "t1", overId: "done" })).toEqual({
      id: "t1",
      status: "done",
    });
  });

  it("works for in_progress column id", () => {
    expect(resolveDragEnd({ activeId: "t1", overId: "in_progress" })).toEqual({
      id: "t1",
      status: "in_progress",
    });
  });
});
