# Incident Response Template

Save incident reports in the target project under a canonical location such as:

- `docs/incidents/`

Suggested filename:

- `INC-YYYY-MM-DD-NN.md`

Template:

```markdown
# Incident Report - INC-YYYY-MM-DD-NN

- Status:
- Severity:
- Start time:
- End time:
- Environment:
- Reported by:
- Owner:

## Summary

- What happened:
- User impact:
- Systems affected:

## Detection

- How it was detected:
- First alert or symptom:
- Links to logs, dashboards, or reports:

## Release Correlation

- Release label:
- Release record path:
- PR number / link:
- Commit SHA:
- Vercel deployment URL / ID:

## Timeline

- HH:MM -
- HH:MM -
- HH:MM -

## Immediate Mitigation

- Rollback performed: Yes / No
- Rollback target:
- Rollback method:
- Stabilization result:

## Root Cause

- Direct cause:
- Contributing factors:
- Why it was not caught earlier:

## Resolution

- What fixed it:
- Verification performed:
- Residual risk:

## Follow-Up Actions

- [ ] Action 1
- [ ] Action 2
- [ ] Action 3

## Notes

- Lessons learned:
- Required process updates:
```
