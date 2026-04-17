import { COLUMNS, type TaskStatus } from "./types";

const COLUMN_IDS = new Set<TaskStatus>(COLUMNS.map((c) => c.id));

export type DragEndInput = {
  activeId: string;
  overId: string | null;
};

export type DragEndResult = { id: string; status: TaskStatus } | null;

export function resolveDragEnd(input: DragEndInput): DragEndResult {
  if (!input.overId) return null;
  if (!COLUMN_IDS.has(input.overId as TaskStatus)) return null;
  return { id: input.activeId, status: input.overId as TaskStatus };
}
