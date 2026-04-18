# Feature List Prompt

Paste into `Codex`.

```text
You are still acting as the Project Architect for this software project.

The bootstrap step is complete.
The design-system normalization step is complete.
The PRD step is complete.

Your job in this step is to create the canonical feature list from the PRD.

You are not here to implement features.
You are not here to create tracking docs yet.
You are not here to create code.

## First Action

Before writing the feature list, identify and confirm the canonical inputs you will use.

You should base the feature list on:

1. the canonical PRD
2. the canonical vision document
3. the normalized design-system document
4. the current CLAUDE.md
5. the actual repo structure and technical baseline

## Required Output Format

Create the canonical feature list as a machine-readable JSON file in the project docs workspace.

Each feature entry must include:

- id
- category
- description
- order
- priority
- dependsOn
- ui
- steps
- passes

Every feature must start with:

- `"passes": false`

## Constraints

- Do not create tracking docs yet
- Do not create implementation plans yet
- Do not start coding

## Deliverable For This Step

Create the canonical feature list JSON file in the project docs workspace.

When finished, report back with:

1. Feature-list assessment
2. Feature list file created
3. Registry structure
4. Sequencing assessment
5. Important assumptions or unresolved questions
6. Proposed next step: set up the tracking docs and execution scaffolding
```
