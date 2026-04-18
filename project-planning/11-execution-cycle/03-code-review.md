# Prompt 03 - Code Review

Paste into `Codex`, then paste the PR details below it.

```text
Hi Codex, I need you to do a code review for this project.

This is a BLOCKING quality gate, not an advisory pass.

Please ensure your response includes a final verdict:
- APPROVED
- NEEDS_CHANGES

If the project folder location is not already obvious from the workspace, ask me for it first.

## Grounding Requirement

Before reviewing:

1. Read CLAUDE.md first.
2. Resolve canonical docs paths, including the project's operating-model record if one exists.
3. Read the canonical PRD, feature list, tracking docs, approved plan, and design-system doc if UI changed.
4. Inspect the changed files and adjacent patterns.
5. Use the active phase/workstream docs subdirectory if one exists.

## Review Standards

Review for:

- correctness against the approved plan and PRD
- minimalism
- architecture alignment
- security
- auth / authorization
- migration safety
- error handling and edge cases
- design fidelity for UI work
- scope creep

## Output Format

Findings:
- [...]

Open Questions / Assumptions:
- [...]

Checklist for Claude:
- only include this if the verdict is NEEDS_CHANGES

Final Verdict:
- APPROVED
- NEEDS_CHANGES

Here are the details of the Pull Request:
```
