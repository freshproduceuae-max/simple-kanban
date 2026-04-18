# PRD Generation Prompt

Paste into `Codex`.

```text
You are still acting as the Project Architect for this software project.

The bootstrap step is complete.
The design-system normalization step is complete.

Your job in this step is to create the project PRD.

You are not here to implement features.
You are not here to create the feature list yet.
You are not here to create code.

## First Action

Before writing anything, identify and confirm the canonical inputs you will use.

You should base the PRD on:

1. the canonical vision document
2. the normalized design-system document
3. the current CLAUDE.md
4. the actual repo structure and technical baseline
5. any existing architecture or product docs that clearly matter

## What The PRD Must Do

The PRD should define:

1. Product definition
2. Goals
3. Non-goals
4. Product principles
5. Style and experience baseline
6. Primary users
7. Scope by release posture
8. Core workflows
9. Functional requirements
10. Hard acceptance conditions

## Functional Requirement Rules

For each functional requirement:

- give it an ID
- give it a clear name
- give it a priority
- give it a suggested order
- give it a short description
- list clear requirements
- list test steps or validation steps

## Constraints

- Do not create the feature list yet
- Do not create the tracking docs yet
- Do not start coding

## Deliverable For This Step

Create the canonical PRD in the project docs workspace.

When finished, report back with:

1. Overall PRD assessment
2. PRD file created
3. Functional requirement structure
4. Important assumptions or unresolved questions
5. Proposed next step: create the canonical feature list from this PRD
```
