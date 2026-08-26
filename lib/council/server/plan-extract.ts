/**
 * F16 — Plan-mode structured-frame extractor.
 *
 * The Consolidator, when running in Plan mode, is instructed to append
 * a fenced code block at the very end of its reply with the tag
 * `json-plan`:
 *
 *   ```json-plan
 *   { "tasks": [{ "title": "title one", "column": "backlog" }],
 *     "chips": ["scope?", "by when?"] }
 *   ```
 *
 * `tasks` drives proposal-row creation (one `kind:'task'` proposal per
 * title). `column` is one of the five board stages and tells the
 * proposal which column to land in once approved; it's optional per
 * task and defaults to `backlog` (a freshly-drafted, unconfirmed task
 * belongs in Backlog, not To Do, until the user has actually approved
 * it and is ready to act on it). For backward-compatibility with
 * older Consolidator output (or a model that forgets the object form),
 * a plain string task title is also accepted and defaults to
 * `backlog`. `chips` are Consolidator-requested clarifying prompts
 * that render as chip inputs under the reply (design-system §8.5).
 * `chips` is OPTIONAL — if the Consolidator judges the topic concrete
 * enough, it omits the field and the client renders no chips.
 *
 * The extractor is deliberately lenient: a missing fence, a parse
 * error, or a malformed structure all yield an empty result rather
 * than throwing. Plan replies are useful even without structured
 * draft-tasks — the user still read the reply.
 *
 * We only look at the LAST `json-plan` fence in the text so the model
 * can change its mind mid-reply (rare but cheap to handle).
 */

import type { BoardColumn } from '@/lib/persistence/types';

const VALID_COLUMNS: readonly BoardColumn[] = [
  'backlog',
  'todo',
  'in_progress',
  'review',
  'done',
];

function isBoardColumn(value: unknown): value is BoardColumn {
  return (
    typeof value === 'string' &&
    (VALID_COLUMNS as readonly string[]).includes(value)
  );
}

export type PlanTask = {
  title: string;
  column: BoardColumn;
};

export type PlanFrame = {
  tasks: PlanTask[];
  chips: string[];
};

const FENCE_REGEX = /```json-plan\s*\n([\s\S]*?)\n```/g;

export function extractPlanFrame(fullText: string): PlanFrame {
  if (!fullText) return { tasks: [], chips: [] };

  // Grab the LAST fence — later "drafts" override earlier ones.
  let match: RegExpExecArray | null;
  let lastBody: string | null = null;
  while ((match = FENCE_REGEX.exec(fullText)) !== null) {
    lastBody = match[1];
  }
  if (lastBody === null) return { tasks: [], chips: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(lastBody);
  } catch {
    return { tasks: [], chips: [] };
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return { tasks: [], chips: [] };
  }

  const obj = parsed as { tasks?: unknown; chips?: unknown };
  const tasks: PlanTask[] = Array.isArray(obj.tasks)
    ? obj.tasks
        .map((t): PlanTask | null => {
          if (typeof t === 'string') {
            const title = t.trim();
            return title ? { title, column: 'backlog' } : null;
          }
          if (typeof t === 'object' && t !== null) {
            const { title: rawTitle, column: rawColumn } = t as {
              title?: unknown;
              column?: unknown;
            };
            const title =
              typeof rawTitle === 'string' ? rawTitle.trim() : '';
            if (!title) return null;
            return {
              title,
              column: isBoardColumn(rawColumn) ? rawColumn : 'backlog',
            };
          }
          return null;
        })
        .filter((t): t is PlanTask => t !== null)
    : [];
  const chips = Array.isArray(obj.chips)
    ? obj.chips
        .filter((c): c is string => typeof c === 'string')
        .map((c) => c.trim())
        .filter(Boolean)
    : [];

  return { tasks, chips };
}
