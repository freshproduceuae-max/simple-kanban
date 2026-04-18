# Deployment Safety Rules

These rules apply to every production deployment.

## Non-Negotiables

- Every deployment must create or update a versioned release record in RTF format.
- Every release record must include GitHub traceability and Vercel traceability.
- Every release record must include rollback instructions specific to that release.
- No production deployment should proceed without a known rollback path.
- If rollback data is incomplete, do not treat the deployment process as complete.

## Required Release Record Data

Each deployment record should capture:

- release version or release label
- deployment date and time
- environment
- Git branch
- merge commit SHA
- PR number and PR link if available
- feature IDs included
- files or areas changed at a high level
- Vercel project name
- Vercel deployment URL
- Vercel deployment ID if available
- environment variables added, changed, or confirmed unchanged
- migrations applied or confirmed not needed
- health checks performed
- known risks
- rollback target
- rollback steps
- rollback validation steps

## Storage Rule

Keep release records in the target project under a canonical location such as:

- `docs/releases/`

Keep incident records under a canonical location such as:

- `docs/incidents/`

Use durable names such as:

- `release-2026-04-18-v001.rtf`
- `release-2026-04-18-auth-fix.rtf`

## Operational Rule

The project should be able to answer these questions quickly after any production issue:

- What changed?
- Which PR introduced it?
- Which deployment is live?
- What was the previous known-good deployment?
- What exact rollback action should be taken?

If those answers are not available within minutes, the release-tracking process is not sufficient.
