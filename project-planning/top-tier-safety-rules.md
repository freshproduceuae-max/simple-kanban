# Top-Tier Safety Rules

Use these stricter rules when the project is high-value, customer-facing, regulated, or operationally sensitive.

## Delivery Rules

- No implementation without an approved plan
- No merge without a blocking review
- No deploy without a release record
- No production change without a rollback path

## Documentation Rules

- Canonical docs must exist before feature execution begins
- Every feature must trace back to the PRD and feature list
- Every deployment must trace back to a PR and release record
- Every incident must trace back to the affected release

## Change-Control Rules

- Smallest viable diff only
- No speculative abstractions
- No unrelated refactors in delivery branches
- Hotfixes must use incident IDs

## Verification Rules

- Build, lint, and test status must be recorded
- Post-deploy verification must be recorded
- Migration status must be recorded
- Environment-variable changes must be recorded

## Recovery Rules

- Previous known-good deployment must always be identifiable
- Rollback instructions must be written before deployment completes
- Release and incident records must be easy to find under pressure
- If rollback readiness is weak, the release is not operationally ready

## Governance Rule

If a shortcut weakens traceability, rollback safety, review quality, or deployment confidence, do not take it.
