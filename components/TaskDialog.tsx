"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Priority, Task, TaskStatus } from "@/lib/types";
import { PRIORITIES } from "@/lib/types";

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

function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function TaskDialog({ mode, onClose, onSubmit, onDelete }: Props) {
  const titleId = useId();
  const descId = useId();
  const dateId = useId();
  const tagsId = useId();

  const existing = mode.kind === "edit" ? mode.task : null;
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [dueDate, setDueDate] = useState<string>(existing?.dueDate ?? "");
  const [status, setStatus] = useState<TaskStatus>(existing?.status ?? "todo");
  const [priority, setPriority] = useState<Priority>(
    existing?.priority ?? "medium",
  );
  const [tagsInput, setTagsInput] = useState(
    existing?.tags.join(", ") ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLFormElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocused.current =
      (document.activeElement as HTMLElement | null) ?? null;
    firstFieldRef.current?.focus();
    firstFieldRef.current?.select();
    return () => {
      const el = previouslyFocused.current;
      if (el && typeof el.focus === "function" && document.contains(el)) {
        el.focus();
      }
    };
  }, []);

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
      ).filter(
        (el) =>
          !el.hasAttribute("disabled") &&
          el.getAttribute("tabindex") !== "-1",
      );
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
    const tags = parseTags(tagsInput);
    const payload: Task = existing
      ? {
          ...existing,
          title: trimmed,
          description,
          dueDate: dueDate || null,
          status,
          priority,
          tags,
        }
      : {
          id: newId(),
          title: trimmed,
          description,
          dueDate: dueDate || null,
          status,
          priority,
          tags,
          createdAt: Date.now(),
        };
    onSubmit(payload);
  };

  const inputCls =
    "w-full rounded-sm border border-rule bg-paper px-3 py-2 font-sans text-[14px] text-ink placeholder:text-ink-muted focus:border-terra focus:outline-none focus:ring-2 focus:ring-terra/25";
  const labelCls =
    "small-caps mb-1.5 block font-mono text-[10px] text-ink-muted";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={existing ? "Edit task" : "New task"}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/45 p-4 backdrop-blur-sm md:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        ref={dialogRef}
        onSubmit={handleSubmit}
        className="rise w-full max-w-lg rounded-sm border border-rule bg-paper p-7 shadow-[0_30px_80px_-20px_rgba(27,26,23,0.45)]"
      >
        <div className="mb-6 flex items-baseline justify-between">
          <div>
            <p className="small-caps font-mono text-[10px] text-ink-muted">
              {existing ? "Edit — entry" : "Compose — entry"}
            </p>
            <h2 className="font-serif text-3xl font-[600] leading-none text-ink">
              {existing ? "Edit task" : "New task"}
              <span className="text-terra">.</span>
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            tabIndex={-1}
            className="-mr-2 -mt-2 h-8 w-8 rounded-full text-ink-muted transition-colors hover:bg-paper-warm hover:text-ink"
          >
            ×
          </button>
        </div>

        <div className="mb-4">
          <label htmlFor={titleId} className={labelCls}>
            Title
          </label>
          <input
            id={titleId}
            ref={firstFieldRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Write the headline…"
            className={`${inputCls} font-serif text-[18px]`}
          />
          {error ? (
            <p className="mt-1.5 font-mono text-[11px] text-terra">{error}</p>
          ) : null}
        </div>

        <div className="mb-4">
          <label htmlFor={descId} className={labelCls}>
            Notes
          </label>
          <textarea
            id={descId}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputCls}
            rows={3}
            placeholder="Details, links, acceptance…"
          />
        </div>

        <div className="mb-4 grid grid-cols-2 gap-4">
          <div>
            <label htmlFor={dateId} className={labelCls}>
              Due date
            </label>
            <input
              id={dateId}
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={`${inputCls} font-mono text-[13px]`}
            />
          </div>
          <div>
            <label className={labelCls}>Column</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
              className={inputCls}
            >
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
            </select>
          </div>
        </div>

        <div className="mb-4">
          <label className={labelCls}>Priority</label>
          <div className="flex gap-2">
            {PRIORITIES.map((p) => {
              const active = priority === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPriority(p.id)}
                  className={`flex-1 rounded-sm border px-3 py-2 font-serif text-[14px] transition-colors ${
                    active
                      ? "border-ink bg-ink text-paper"
                      : "border-rule bg-paper text-ink-soft hover:border-ink/40"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-6">
          <label htmlFor={tagsId} className={labelCls}>
            Tags <span className="lowercase tracking-normal">(comma-separated)</span>
          </label>
          <input
            id={tagsId}
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="design, planning, writing"
            className={`${inputCls} font-serif italic`}
          />
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-rule pt-5">
          {existing && onDelete ? (
            confirmDelete ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onDelete(existing.id)}
                  className="rounded-sm bg-terra px-3 py-2 font-sans text-[13px] font-medium text-paper hover:bg-terra/90"
                >
                  Confirm delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-sm border border-rule px-3 py-2 font-sans text-[13px] text-ink-soft hover:border-ink/40"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="font-serif text-[13px] italic text-terra underline decoration-terra/40 decoration-1 underline-offset-4 hover:decoration-terra"
              >
                Delete this task
              </button>
            )
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-sm border border-rule px-4 py-2 font-sans text-[13px] text-ink-soft hover:border-ink/40"
            >
              Close
            </button>
            <button
              type="submit"
              className="rounded-sm bg-ink px-5 py-2 font-sans text-[13px] font-medium text-paper hover:bg-terra"
            >
              Save
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
