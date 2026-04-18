# Incident Response Prompt

Paste into the project AI when a production issue occurs and structured incident handling is needed.

```text
We have a production incident and need a disciplined response with minimal downtime.

Your job is to coordinate incident handling using the project's release tracking, deployment history, GitHub history, and rollback materials.

## Step 1: Resolve Incident Context

Read:

- CLAUDE.md
- release-tracking docs
- the latest release record
- rollback docs or prompts
- tracking docs
- any prior incident reports if relevant

Identify:

- current live release
- suspected affected feature(s)
- current user impact
- previous known-good release

## Step 2: Create Incident Record

Create an incident record using the canonical incident template.

Assign an incident ID using:

- `INC-YYYY-MM-DD-NN`

## Step 3: Immediate Safety Assessment

Report back with:

1. suspected impact
2. affected release
3. safest immediate action
4. whether rollback is recommended
5. what evidence is still missing

## Step 4: Execute Approved Mitigation

If the user approves:

- execute the safest mitigation
- prefer the smallest action that restores service quickly
- if rollback is fastest and safest, use the recorded rollback path

## Step 5: Record Outcome

Update:

- incident record
- release record
- tracking docs if needed

Include:

- exact mitigation used
- restored state
- verification results
- follow-up actions
```
