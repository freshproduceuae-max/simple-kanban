# Project Planning Folder

This folder is meant to be copied into a new project as a complete planning and execution skeleton.

## Simple Invocation

If you are an AI working in this project and the user says:

- `refer to the project planning folder`
- `use the project planning folder`
- `start from the project planning folder`

you should interpret that as the instruction to use this folder as the operating skeleton for the project.

## What You Should Do

1. Read this file first.
2. Read `README.md`.
3. Start with `00-operating-model`.
4. Ask the user which operating model they want to use for this project.
5. Record that choice in the target project's docs.
6. Read `project-folder-scaffold.md` and establish the canonical docs folders if needed.
7. Proceed through the rest of the phases in order.
8. Do not skip ahead to implementation before the planning skeleton says it is time.
9. Use `NEW-PROJECT-CHECKLIST.md` and `COPY-INSTRUCTIONS.md` as human-facing support documents when helpful.

## Default Interpretation

Unless the user explicitly says otherwise:

- use this folder as the source of truth for the project workflow
- treat the phases as ordered
- do not start coding before the bootstrap, PRD, feature-list, and tracking phases are complete
- do not merge without a blocking review

## Folder Intent

This folder governs:

- planning
- approvals
- reviews
- tracking
- scaffolding decisions
- execution sequencing
- deployment preparation when deployment materials are added

It does not itself replace the project's actual docs.
Instead, it tells you how to create and maintain those docs inside the target project.

## Production-Safe Reuse

This folder is designed to be reusable in serious projects.

That includes:

- canonical planning flow
- approval and review gates
- release tracking
- GitHub and Vercel traceability
- rollback readiness
- incident-response structure
