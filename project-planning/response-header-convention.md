# Response Header Convention

Every AI response in a project that uses this planning folder begins with
a 2-line header so the Creative Director (the human owner) knows at a
glance where the project is, who the message is for, and what — if
anything — they need to do about it.

The body below the header stays as detailed as the content requires.
This convention only governs the first two lines.

---

## 1. The required header shape

```
**Current: [Phase N · Name] > [Sub-step · Name] > [Immediate purpose]**
**For: [Audience] — [what you need from them]**
```

Both lines are bold. Both lines appear at the very top of the reply,
before any other content — including before any skill invocation output
that the AI surfaces to the user.

If the task is nested deeper, the AI may extend the breadcrumb with
additional `>` segments and name the deepest segment itself. Keep the
whole first line readable on one screen line when possible.

### Examples

```
**Current: Phase 02 · Vision > Interview > Q3 of ~10 — persona scope**
**For: Creative Director — multiple-choice answer needed**
```

```
**Current: Phase 07 · PRD > Drafting > F1 acceptance criteria review**
**For: Creative Director — FYI, no action**
```

```
**Current: Phase 11 · Execution > Task 4 · Orchestrator loop > Handoff to Codex**
**For: Creative Director — action required: paste prompt into Codex**
```

```
**Current: Phase 11 · Execution > Task 4 · Orchestrator loop > Subagent dispatch**
**For: Internal Claude — no action**
```

---

## 2. Audience tags

Pick exactly one audience tag per response. If the response has multiple
audiences (rare), split into multiple replies.

| Tag | Meaning | What the Creative Director should do |
|---|---|---|
| `Creative Director — approval needed` | A decision is required before the AI can proceed. | Read, decide, reply. |
| `Creative Director — action required: paste into Codex` | A prompt block follows that the user copies into Codex. | Copy the prompt block, paste into Codex, return with Codex's output. |
| `Creative Director — action required: paste into Gemini` | Same as above, for Gemini. | Same pattern. |
| `Creative Director — action required: paste into claude.ai` | Same, for `claude.ai` (web). | Same. |
| `Creative Director — action required: run in terminal` | A command or manual step the user runs outside the AI's reach. | Run, confirm back. |
| `Creative Director — action required: other` | Anything not covered above. | The body explains what's needed. |
| `Creative Director — FYI, no action` | Status update while the AI continues working. | Skim. No reply required. |
| `Internal Claude — no action` | Subagent output, intermediate reasoning, debugging noise. | Usually collapsed or ignored. |

---

## 3. When the response contains a prompt to hand off to another AI

Prompts that the Creative Director must copy into another tool live
inside a fenced block with explicit copy markers. This removes every
ambiguity about what to copy.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROMPT FOR: [Codex | Gemini | claude.ai | other]
PURPOSE: [one line — what this prompt accomplishes]
COPY EVERYTHING BETWEEN THE DIVIDERS BELOW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<the actual prompt text, exactly as it should be pasted>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
END PROMPT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Rules for prompt blocks:

- Exactly one prompt per block. If two tools need prompts, two blocks.
- Never embed commentary, variables the user must replace, or
  assumptions inside the block unless they are explicitly marked
  `[REPLACE WITH: ...]` — the default contract is that the block is
  copy-paste ready.
- The response header's audience tag must match the prompt target
  (`paste into Codex` for a Codex prompt, etc.).

---

## 4. What does NOT go in the header

The header is for orientation, not for state reporting. These belong in
the body:

- Long status dumps
- Test / lint / build output
- File diffs or lists of files touched
- Follow-up questions beyond the immediate purpose
- Reasoning chains

Keep the header to two lines so the Creative Director can parse
purpose-and-audience in under a second.

---

## 5. When this convention applies

- Every response in a project governed by this planning folder.
- Every phase (00 through 12).
- Every operating model (single-AI, multi-AI, hybrid).
- Subagent reports to the main AI do NOT need this header — only the
  main AI's responses to the Creative Director do.

---

## 6. When this convention may be temporarily relaxed

- Trivial one-word acknowledgements (`"ok"`, `"done"`) from either side.
- Emergency incident response where speed matters more than form — but
  the post-incident record must be written back in the conventional
  format.

Any other exception requires explicit Creative Director approval,
recorded in the relevant session's tracking note.
