"use client";

import { useEffect, useReducer, useRef } from "react";
import { loadTasks, saveTasks } from "./storage";
import type { Task, TaskStatus } from "./types";

export type TasksAction =
  | { type: "hydrate"; tasks: Task[] }
  | { type: "add"; task: Task }
  | { type: "edit"; id: string; patch: Partial<Omit<Task, "id" | "createdAt">> }
  | { type: "delete"; id: string }
  | { type: "move"; id: string; status: TaskStatus };

export function tasksReducer(state: Task[], action: TasksAction): Task[] {
  switch (action.type) {
    case "hydrate":
      return action.tasks;
    case "add":
      return [...state, action.task];
    case "edit":
      return state.map((t) =>
        t.id === action.id ? { ...t, ...action.patch } : t,
      );
    case "delete":
      return state.filter((t) => t.id !== action.id);
    case "move":
      return state.map((t) =>
        t.id === action.id ? { ...t, status: action.status } : t,
      );
    default:
      return state;
  }
}

export function useTasks() {
  const [tasks, dispatch] = useReducer(tasksReducer, []);
  const hydrated = useRef(false);

  // Hydrate once on mount (client only).
  useEffect(() => {
    dispatch({ type: "hydrate", tasks: loadTasks() });
    hydrated.current = true;
  }, []);

  // Persist after hydration, on every change.
  useEffect(() => {
    if (!hydrated.current) return;
    saveTasks(tasks);
  }, [tasks]);

  return { tasks, dispatch };
}
