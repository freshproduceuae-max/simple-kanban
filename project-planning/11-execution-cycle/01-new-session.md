# Prompt 01 - New Session

Paste into the implementation environment at the start of a feature session.

```text
New session starting. Catch yourself up on the project before doing any work.

If the project folder location is not already obvious from the current workspace, ask me for it first.
Do not assume the path.

Project rules:
- Follow CLAUDE.md exactly
- Use the canonical docs workspace and document names established during bootstrap
- If the project has an active phase/workstream docs subdirectory, use that as the execution workspace instead of older background docs unless CLAUDE.md says otherwise
- Read the project's operating-model record before deciding how to structure agents or external AI involvement
- Do not write code until I approve the session plan
- You are in agent team mode: use the TeamCreate tool by default to spin up multiple agents in parallel for repo reading, implementation, verification, and review work where appropriate
- Every agent you create must receive the same scope, design, and process guardrails

## Step 1: Resolve Canonical Paths

Read CLAUDE.md first.

From CLAUDE.md and the canonical docs workspace, identify the actual current paths for:
- project operating-model record
- canonical vision document
- canonical design-system document
- canonical PRD
- canonical feature list JSON
- canonical progress doc
- canonical claude-progress.txt
- canonical high-level plan / architecture handoff doc if one exists
- plans workspace and plan rules doc
- any architecture / data model / migration docs explicitly named as canonical

## Step 2: Read Current State

Read the canonical project docs in the established order.

Use the operating-model record to determine whether this session should run as:

- single AI with multiple agents
- multi-AI specialist mode
- hybrid mode

## Step 3: Report Back Concisely

Tell me:
1. What was completed last session
2. Current progress
3. What is next
4. Which system / app / service owns the next feature
5. Any blockers, assumptions, or important notes

## Step 4: Apply Sequencing Rule

Use the canonical feature order.

## Step 5: Present Today's Plan

Propose:
- which feature we are working on
- why it is the correct next item
- which app(s) / service(s) / package(s) it touches
- key steps to complete it
- what done looks like
- which files you expect to create or modify
- which agents you will create

## Step 6: Wait for Approval

Do not write code, create a branch, or edit files until I approve the plan.
```
