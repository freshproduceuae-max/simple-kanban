# Project Folder Scaffold

> **Superseded for this project by [`docs/releases/README.md`](../docs/releases/README.md).**
> This file remains as the methodology-level default for *new* projects copying
> the planning template. The Plan project ships as a serial sequence of releases,
> each with its own sub-folder under `docs/releases/`. Where this scaffold and
> the release roster disagree, the release roster wins.

When this planning folder is copied into a new project, the project AI should create canonical docs folders early if they do not already exist.

Recommended structure:

```text
docs/
  design-system/
  prd/
  features/
  tracking/
  plans/
  releases/
  incidents/
```

Minimum expected outputs over time:

- `docs/design-system/design-system.md`
- `docs/prd/prd.md`
- `docs/features/feature-list.json`
- `docs/tracking/progress.md`
- `docs/tracking/claude-progress.txt`
- `docs/plans/README.md`
- `docs/releases/release-<date>-<label>.rtf`
- `docs/incidents/INC-<date>-<nn>.md`

Rule:

If the project bootstrap establishes a different canonical naming pattern, follow that pattern consistently and record it in `CLAUDE.md`.
