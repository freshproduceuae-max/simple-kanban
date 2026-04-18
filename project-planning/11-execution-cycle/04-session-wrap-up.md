# Prompt 04 - Session Wrap-Up

Paste into the implementation environment after the PR is approved.

```text
PR approved. Please merge to main and push to remote. Clean up agent teams. Update the tracking docs.

Session wrap-up. Update the project docs so the next session can pick up cleanly.

If the project folder location is not already obvious from the workspace, ask me for it first.

Project rules:
- Follow CLAUDE.md exactly
- Use the canonical docs workspace and document names established during bootstrap
- Preserve the project's chosen operating model unless the user explicitly changed it during this session

## Step 1: Resolve Canonical Paths

Read CLAUDE.md first.

## Step 2: Merge And Clean Up

1. Merge the approved PR into main
2. Push main to remote
3. Clean up agent teams
4. Shut down background work
5. Confirm no orphaned tasks remain active

## Step 3: Update Project Tracking

Update:

1. canonical claude-progress.txt
2. canonical progress.md
3. canonical feature list JSON
4. the relevant plan file
5. release-tracking docs if deployment or rollout state changed

## Step 4: What To Record

Record:

1. What was completed
2. What files changed
3. Whether the item now satisfies its validation steps
4. Follow-up notes, blockers, or rollout concerns
5. What the next feature should be
6. Any GitHub, Vercel, or release-history details that must be preserved for rollback safety

## Step 5: Feature Pass Rule

Only mark a feature as passed if all validation / test steps are satisfied.

## Step 6: Report Back Concisely

Tell me:
1. Which feature was worked on
2. Whether it was marked as passed
3. Which docs were updated
4. What the next feature is
5. Any important carry-over note
6. Confirm all agent teams and background tasks were shut down
```
