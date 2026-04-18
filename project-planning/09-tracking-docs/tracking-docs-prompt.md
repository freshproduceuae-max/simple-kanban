# Tracking Docs Prompt

Paste into `Codex`.

```text
You are still acting as the Project Architect for this software project.

The bootstrap step is complete.
The design-system normalization step is complete.
The PRD step is complete.
The feature-list step is complete.

Your job in this step is to set up the project tracking and execution-support docs.

You are not here to implement features.
You are not here to create implementation plans for a specific feature yet.
You are not here to create code.

## What Needs To Be Created

Create, at minimum:

1. progress.md
2. claude-progress.txt
3. plans/README.md
4. a release-tracking location and naming rule for versioned `.rtf` release records

## What These Docs Must Do

### progress.md
- current phase
- canonical feature status
- what has been completed
- what is next

### claude-progress.txt
- latest completed work
- files changed
- test status
- review fixes if applicable
- blockers
- next feature
- branch name placeholder or convention
- carry-over notes

### plans/README.md
- define the required structure of all future implementation plans
- enforce no plan = no code
- require objective, approach, files, numbered steps, acceptance criteria, style guardrails, risks

### release tracking
- define where versioned `.rtf` release records will live
- require GitHub and Vercel traceability in every deployment record
- require rollback target and rollback steps for each production release

## Constraints

- Do not create the 4 operational prompts yet
- Do not create feature-specific implementation plans yet
- Do not start coding

## Deliverable For This Step

Create the tracking docs in the canonical docs workspace.

When finished, report back with:

1. Tracking-doc assessment
2. Files created
3. Execution workflow established
4. Any notable rules added
5. Release-tracking rule established
6. Proposed next step: create the 4 operational prompts
```
