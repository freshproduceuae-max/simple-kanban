"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Task, TaskStatus } from "@/lib/types";

export type DialogMode =
  | { kind: "create" }
  | { kind: "edit"; task: Task };

type Props = {
  mode: DialogMode;
  onClose: () => void;
  onSubmit: (task: Task) => void;
  onDelete?: (id: string) => void;
};

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function TaskDialog({ mode, onClose, onSubmit, onDelete }: Props) {
  const titleId = useId();
  const descId = useId();
  const dateId = useId();

  const existing = mode.kind === "edit" ? mode.task : null;
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [dueDate, setDueDate] = useState<string>(existing?.dueDate ?? "");
  const [status, setStatus] = useState<TaskStatus>(existing?.status ?? "todo");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLFormElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Capture opener, focus first field, restore on unmount.
  useEffect(() => {
    previouslyFocused.current =
      (document.activeElement as HTMLElement | null) ?? null;
    firstFieldRef.current?.focus();
    return () => {
      const el = previouslyFocused.current;
      if (el && typeof el.focus === "function" && document.contains(el)) {
        el.focus();
      }
    };
  }, []);

  // Escape + focus-trap keydown handling.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => !el.hasAttribute("disabled"));
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !root.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !root.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Title is required.");
      return;
    }
    const payload: Task = existing
      ? {
          ...existing,
          title: trimmed,
          description,
          dueDate: dueDate || null,
          status,
        }
      : {
          id: newId(),
          title: trimmed,
          description,
          dueDate: dueDate || null,
          status,
          createdAt: Date.now(),
        };
    onSubmit(payload);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={existing ? "Edit task" : "New task"}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        ref={dialogRef}
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-lg bg-white p-4 shadow-lg"
      >
        <h2 className="mb-3 text-lg font-semibold">
          {existing ? "Edit task" : "New task"}
        </h2>

        <label htmlFor={titleId} className="block text-sm font-medium">
          Title
        </label>
        <input
          id={titleId}
          ref={firstFieldRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mb-2 w-full rounded border border-slate-300 p-1.5"
        />
        {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}

        <label htmlFor={descId} className="block text-sm font-medium">
          Description
        </label>
        <textarea
          id={descId}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mb-2 w-full rounded border border-slate-300 p-1.5"
          rows={3}
        />

        <label htmlFor={dateId} className="block text-sm font-medium">
          Due date
        </label>
        <input
          id={dateId}
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="mb-2 w-full rounded border border-slate-300 p-1.5"
        />

        <label className="block text-sm font-medium">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as TaskStatus)}
          className="mb-4 w-full rounded border border-slate-300 p-1.5"
        >
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
        </select>

        <div className="flex items-center justify-between gap-2">
          {existing && onDelete ? (
            confirmDelete ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onDelete(existing.id)}
                  className="rounded bg-red-600 px-3 py-1.5 text-sm text-white"
                >
                  Confirm delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="rounded border px-3 py-1.5 text-sm"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="rounded border border-red-500 px-3 py-1.5 text-sm text-red-600"
              >
                Delete
              </button>
            )
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border px-3 py-1.5 text-sm"
            >
              Close
            </button>
            <button
              type="submit"
              className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white"
            >
              Save
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
