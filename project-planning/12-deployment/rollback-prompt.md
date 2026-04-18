# Rollback Prompt

Paste into the deployment-capable AI environment if a deployed release must be reverted.

```text
We need to evaluate or execute a rollback for the current deployment.

Your job is to use the existing release tracking, GitHub history, and Vercel deployment information to minimize downtime and revert safely.

## Step 1

Read CLAUDE.md and the canonical release-tracking docs first.

Identify:

- current live deployment
- affected release record
- previous known-good release
- PR and commit associated with the current release
- rollback instructions recorded for the release

## Step 2

Assess rollback options:

- Vercel rollback or redeploy previous known-good version
- Git revert or hotfix path if required
- migration or environment concerns that affect rollback safety

## Step 3

Before taking action, report:

1. suspected issue
2. safest rollback target
3. exact rollback action
4. expected downtime risk
5. post-rollback verification steps

## Step 4

If the user approves, execute the rollback and update the release record and tracking docs with:

- rollback timestamp
- rollback method
- restored deployment reference
- verification result
- follow-up remediation needed
```
