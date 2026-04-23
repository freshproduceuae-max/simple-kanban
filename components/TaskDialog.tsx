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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-space-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        ref={dialogRef}
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-lg border border-border-default bg-surface-card p-space-6 shadow-modal"
      >
        <h2 className="mb-space-3 font-family-display text-size-lg font-weight-semibold text-ink-900">
          {existing ? "Edit task" : "New task"}
        </h2>

        <label htmlFor={titleId} className="block text-size-sm font-weight-medium text-ink-700">
          Title
        </label>
        {/* F32 — every tap-targetable form field in the dialog clears
            the 44px mobile floor (design-system §6.2). */}
        <input
          id={titleId}
          ref={firstFieldRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mb-space-2 w-full rounded border border-border-default bg-surface-card min-h-tap p-space-2 text-ink-900 focus:outline-none focus:shadow-ring-focus"
        />
        {error ? (
          <p className="mb-space-2 text-size-sm text-accent-terra-700">{error}</p>
        ) : null}

        <label htmlFor={descId} className="block text-size-sm font-weight-medium text-ink-700">
          Description
        </label>
        <textarea
          id={descId}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          // F32 — three-row default already clears 44px, but the
          // token makes the guarantee explicit and stays consistent
          // with the other dialog fields if `rows` ever shrinks.
          className="mb-space-2 w-full rounded border border-border-default bg-surface-card min-h-tap p-space-2 text-ink-900 focus:outline-none focus:shadow-ring-focus"
          rows={3}
        />

        <label htmlFor={dateId} className="block text-size-sm font-weight-medium text-ink-700">
          Due date
        </label>
        <input
          id={dateId}
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="mb-space-2 w-full rounded border border-border-default bg-surface-card min-h-tap p-space-2 font-family-mono text-ink-900 focus:outline-none focus:shadow-ring-focus"
        />

        <label className="block text-size-sm font-weight-medium text-ink-700">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as TaskStatus)}
          className="mb-space-4 w-full rounded border border-border-default bg-surface-card min-h-tap p-space-2 text-ink-900 focus:outline-none focus:shadow-ring-focus"
        >
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
        </select>

        <div className="flex items-center justify-between gap-space-2">
          {/* F32 — every dialog button carries min-h-tap so the delete
              / save / close affordances all clear the 44px mobile floor
              (design-system §6.2). Inline-flex centres the label now
              that the box stretches vertically. */}
          {existing && onDelete ? (
            confirmDelete ? (
              <div className="flex gap-space-2">
                <button
                  type="button"
                  onClick={() => onDelete(existing.id)}
                  className="inline-flex items-center justify-center rounded bg-accent-terra-700 min-h-tap min-w-tap px-space-3 py-space-1 text-size-sm font-weight-medium text-surface-card"
                >
                  Confirm delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="inline-flex items-center justify-center rounded border border-border-default min-h-tap min-w-tap px-space-3 py-space-1 text-size-sm text-ink-700"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center justify-center rounded border border-accent-terra-500 min-h-tap min-w-tap px-space-3 py-space-1 text-size-sm text-accent-terra-700"
              >
                Delete
              </button>
            )
          ) : (
            <span />
          )}
          <div className="flex gap-space-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded border border-border-default min-h-tap min-w-tap px-space-3 py-space-1 text-size-sm text-ink-700"
            >
              Close
            </button>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded bg-ink-900 min-h-tap min-w-tap px-space-3 py-space-1 text-size-sm font-weight-medium text-surface-card"
            >
              Save
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
