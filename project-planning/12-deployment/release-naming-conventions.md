# Release Naming Conventions

Use these conventions so GitHub, Vercel, release records, and incident notes can be matched quickly.

## Branch Naming

Recommended feature branch patterns:

- `feature/<feature-id>-<short-name>`
- `fix/<feature-id>-<short-name>`
- `hotfix/<issue-or-feature-id>-<short-name>`
- `release/<release-label>`

Examples:

- `feature/FR-003-user-signup`
- `fix/FR-009-empty-state-copy`
- `hotfix/INC-2026-04-18-auth-loop`
- `release/2026-04-18-v001`

## Pull Request Naming

Recommended PR title patterns:

- `[<feature-id>] <clear change summary>`
- `[HOTFIX:<issue-id>] <clear change summary>`
- `[RELEASE] <release label>`

Examples:

- `[FR-003] Add user signup flow`
- `[HOTFIX:INC-2026-04-18-01] Fix login redirect loop`
- `[RELEASE] 2026-04-18-v001`

## Release Labels

Recommended release labels:

- `YYYY-MM-DD-vNNN`
- `YYYY-MM-DD-<short-release-name>`

Examples:

- `2026-04-18-v001`
- `2026-04-18-auth-fix`

## Vercel Deployment Correlation

Each release record should include:

- Vercel project name
- Vercel deployment URL
- Vercel deployment ID if available
- release label

If possible, use the release label in deployment notes, tags, or comments so GitHub and Vercel histories line up.

## Incident Naming

Recommended incident IDs:

- `INC-YYYY-MM-DD-NN`

Examples:

- `INC-2026-04-18-01`
- `INC-2026-04-18-02`

Use the incident ID in:

- hotfix branch name
- PR title
- incident report
- rollback note

## Rule

The same release label or incident ID should appear across:

- release record
- PR or hotfix PR
- deployment notes
- incident report

That consistency is what makes rollback and root-cause tracing fast under pressure.
