# Operating Model Options

Use these as the standard choices offered at the start of a new project.

## Option 1 — Single AI, Multiple Agents

One core AI system runs the project with multiple bounded agents, for example:

- planner
- repo reader
- implementation
- verification
- docs / handoff
- review support

Use this when:

- you want one consistent reasoning style
- you want simpler coordination
- you want lower process complexity

Trade-off:

- weaker specialization if one provider is not strong across every phase

## Option 2 — Multi-AI Specialist Model

Different AIs own different responsibilities, for example:

- design / brand AI
- architecture / planning AI
- implementation AI
- review AI

Use this when:

- you want best-of-breed strengths by phase
- you are comfortable switching systems
- you want explicit specialization

Trade-off:

- more coordination overhead
- more handoff discipline required

## Option 3 — Hybrid

One AI is the primary controller, but other AIs are used selectively for specific high-value tasks.

Example:

- one controller AI for the main workflow
- one design AI for brand / design-system work
- one review AI for blocking quality gates if needed

Use this when:

- you want a stable main workflow
- you still want specialist help where it matters most

Trade-off:

- slightly more complexity than single-AI mode
- less purity than a fully specialized setup

## Decision Rule

The project should ask the user to choose one of these before proceeding with the rest of the skeleton.

That choice becomes the project's initial operating model, but it may be revised later if the team decides a different mode is better.
