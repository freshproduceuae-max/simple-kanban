# Deployment Prompt

Paste into the deployment-capable AI environment after implementation and review are complete.

```text
We are in the deployment phase for this project.

Your job is to prepare and execute a safe deployment process with strong rollback readiness.

Do not treat deployment as complete until release tracking and rollback data are recorded.

## Step 1: Resolve Canonical Paths

Read CLAUDE.md first.

Identify the canonical paths for:

- PRD
- feature list
- progress tracking docs
- plan file for the work being deployed
- release records folder
- deployment / rollout docs if they exist

## Step 2: Read Current Release Context

Read the tracking docs, relevant plan, and release-tracking docs if they exist.

Determine:

- which features are included in this deployment
- which PR and commit are being deployed
- whether migrations or environment changes are involved
- what the previous known-good deployment is

## Step 3: Prepare Release Record

Create or update a versioned RTF release record for this deployment.

The release record must include:

- release label
- deployment date and time
- Git branch
- merge commit SHA
- PR number / link
- included feature IDs
- Vercel project
- Vercel deployment URL or ID once available
- migration status
- env var notes
- verification checklist
- rollback target
- rollback steps

## Step 4: Deployment Safety Gate

Before deployment, report back with:

1. what is being deployed
2. what release record was created
3. rollback target
4. any migration or env risk
5. whether deployment is safe to proceed

If rollback readiness is weak, stop and say so clearly.

## Step 5: Deploy

Execute the deployment only after the user approves.

## Step 6: Record Outcome

After deployment:

- update the release record with the actual Vercel deployment details
- record post-deploy verification results
- record any issues found
- record whether rollback was required

## Step 7: Report Back

Tell me:

1. deployment status
2. release record path
3. Vercel deployment reference
4. verification result
5. whether the release is stable
6. exact rollback action if the release must be reverted
```
