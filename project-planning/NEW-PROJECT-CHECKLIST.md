# New Project Checklist

Use this when starting a new project with the `project-planning` folder.

## Copy-In Step

- Copy the full `project-planning/` folder into the new project root
- Confirm `project-planning/START-HERE.md` exists
- Open the AI in the new project folder

## Start Command

Tell the AI:

`Refer to the project planning folder so we can begin our work.`

## Phase Checklist

### 00 Operating Model
- AI reads `project-planning/START-HERE.md`
- AI asks which operating model to use
- Operating model is recorded in project docs

### 01 Readiness
- Required tools and accounts checked
- Missing tools or subscriptions identified
- Readiness status is clear before proceeding

### 02 Vision
- Vision interview completed
- Vision Document created and saved
- Core features and boundaries confirmed

### 03 Global Rules
- Global `~/.claude/CLAUDE.md` exists if needed
- Global standards confirmed

### 04 Project Rules
- Project `CLAUDE.md` created
- Canonical docs expectations established

### 05 Bootstrap
- Repo assessed
- Canonical docs workspace decided
- Naming conventions decided
- No coding started yet

### 06 Brand Identity
- Design direction created
- Canonical design-system doc established

### 07 PRD
- PRD created
- Functional requirements are testable
- Scope is realistic

### 08 Feature List
- Feature list JSON created
- Dependencies and order are clear
- All `passes` fields start as `false`

### 09 Tracking Docs
- `progress.md` created
- `claude-progress.txt` created
- `plans/README.md` created
- Release-tracking rule established

### 10 Scaffolding
- Need for scaffolding assessed
- If needed, scaffolding plan created and approved
- If not needed, move on

### 11 Execution Cycle
- No implementation starts without approved plan
- Review gate exists before merge
- Wrap-up updates tracking docs every session

### 12 Deployment
- Pre-deploy checklist completed
- Versioned `.rtf` release record created
- GitHub and Vercel traceability recorded
- Rollback target documented
- Post-deploy verification completed
- Incident record created if something went wrong

## Production Safety Checklist

- Release record saved in `docs/releases/`
- Previous known-good deployment identified
- PR, commit SHA, and deployment URL recorded
- Rollback steps written clearly
- Verification results recorded
- Incident handling path available

## Done Means

- Project has canonical docs
- Project has tracking and release history
- Project can be reviewed, deployed, and rolled back safely
- AI workflow is structured before coding begins
