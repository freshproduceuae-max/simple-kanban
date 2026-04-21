/**
 * F16 — Plan-mode structured-frame extractor.
 *
 * The Consolidator, when running in Plan mode, is instructed to append
 * a fenced code block at the very end of its reply with the tag
 * `json-plan`:
 *
 *   ```json-plan
 *   { "tasks": ["title one", "title two"], "chips": ["scope?", "by when?"] }
 *   ```
 *
 * `tasks` drives proposal-row creation (one `kind:'task'` proposal per
 * title). `chips` are Consolidator-requested clarifying prompts that
 * render as chip inputs under the reply (design-system §8.5). `chips`
 * is OPTIONAL — if the Consolidator judges the topic concrete enough,
 * it omits the field and the client renders no chips.
 *
 * The extractor is deliberately lenient: a missing fence, a parse
 * error, or a malformed structure all yield an empty result rather
 * than throwing. Plan replies are useful even without structured
 * draft-tasks — the user still read the reply.
 *
 * We only look at the LAST `json-plan` fence in the text so the model
 * can change its mind mid-reply (rare but cheap to handle).
 */

export type PlanFrame = {
  tasks: string[];
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
  const tasks = Array.isArray(obj.tasks)
    ? obj.tasks
        .filter((t): t is string => typeof t === 'string')
        .map((t) => t.trim())
        .filter(Boolean)
    : [];
  const chips = Array.isArray(obj.chips)
    ? obj.chips
        .filter((c): c is string => typeof c === 'string')
        .map((c) => c.trim())
        .filter(Boolean)
    : [];

  return { tasks, chips };
}
