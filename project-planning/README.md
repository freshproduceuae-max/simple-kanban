# Project Planning Folder

Reusable project-planning skeleton for running a brand-new project through the same disciplined AI build workflow every time.

Read `START-HERE.md` first.

Helpful companion files:

- `NEW-PROJECT-CHECKLIST.md`
- `COPY-INSTRUCTIONS.md`
- `project-kickoff-prompt.md`
- `top-tier-safety-rules.md`
- `response-header-convention.md` — **required** communication format for every AI-to-human response in projects that use this folder

## Purpose

Use this folder when starting a new project from zero and you want:

- environment readiness checks
- vision capture
- global and project rule setup
- project bootstrap
- brand and design-system definition
- PRD creation
- feature-list creation
- tracking-doc setup
- scaffolding assessment
- a repeatable execution cycle
- deployment-safe release management

## Phases

1. `00-operating-model`
2. `01-readiness`
3. `02-vision`
4. `03-global-rules`
5. `04-project-rules`
6. `05-bootstrap`
7. `06-brand-identity`
8. `07-prd`
9. `08-feature-list`
10. `09-tracking-docs`
11. `10-scaffolding`
12. `11-execution-cycle`
13. `12-deployment`

## How To Use This Folder

1. Create or choose your new project folder.
2. Copy this entire `project-planning` folder into that project.
3. Tell the project AI: `refer to the project planning folder so we can begin our work`
4. The AI should start with `00-operating-model` and then work through the phases in order.
5. Copy the prompt from the relevant file into the correct tool when needed:
   - `claude.ai`
   - `Claude Code`
   - `Codex`
   - `Gemini`
6. Replace placeholders such as `[PROJECT_PATH]`, `[APP_NAME]`, or `[PLAN_TEXT]`.
7. Save each resulting artifact into the project being built, not into this planning folder.

## Tool Roles

- `Gemini`: brand identity, visual direction, design synthesis, high-level oversight
- `Codex`: architecture, bootstrap, PRD, feature list, tracking setup, plan review, blocking code review
- `Claude Code` or replacement implementation agents: execution, feature implementation, handoff docs, session wrap-up
- `You`: approve plans, approve merges, decide scope, keep the product honest

## Operating Model First

This folder supports three starting modes:

- single AI with multiple agents
- multi-AI specialist model
- hybrid

The first phase should ask the user which model to use for this project and record that choice before the rest of the skeleton runs.

## Important Operating Rule

This folder is intentionally structured.

- Do not jump ahead.
- Do not write code before the bootstrap, PRD, feature list, and tracking layers exist.
- Do not implement features without an approved plan.
- Do not merge without a blocking review.
- Do not deploy without release tracking and rollback readiness.

## Recommended Project Outputs

Each new project should end up with canonical files like:

- `CLAUDE.md`
- `docs/design-system/design-system.md`
- `docs/prd/prd.md`
- `docs/features/feature-list.json`
- `docs/tracking/progress.md`
- `docs/tracking/claude-progress.txt`
- `docs/plans/README.md`
- `docs/releases/release-<date>-<label>.rtf`
- `docs/incidents/INC-<date>-<nn>.md`

Adjust filenames only if the project bootstrap establishes a different canonical pattern.
