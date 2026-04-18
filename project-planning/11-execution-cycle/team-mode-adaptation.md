# Team Mode Adaptation

This playbook originally assumes `Claude Code` plus `TeamCreate`.

For this project system, adapt that role model to:

- `Codex controller`: primary orchestrator and quality owner
- `Gemini supervisor`: optional oversight for design, product direction, and plan sanity
- `Repo reader agent`: reads canonical docs and repo state
- `Implementation agent`: writes the feature code
- `Verification agent`: runs tests and validates acceptance steps
- `Docs agent`: updates plan files and tracking docs
- `Review support agent`: prepares context for blocking review

## Replacement Rule

When an older prompt says `Claude`, interpret it as:

- the implementation environment for code-writing steps
- or a bounded internal agent team if the task should be parallelized

When an older prompt says `TeamCreate`, implement the same idea using:

- your app's built-in team abstraction
- or multiple independent spawned agents with clear scopes

## Non-Negotiables

- every agent gets the same scope guardrails
- every agent must respect canonical docs
- no implementation starts before plan approval
- no merge happens before blocking review

## Operating Model Awareness

Before using the execution prompts, check the project's recorded operating model.

- If the project selected `Single AI, Multiple Agents`, keep all roles within one main AI system.
- If the project selected `Multi-AI Specialist Model`, assign roles by specialty and preserve explicit handoffs.
- If the project selected `Hybrid`, keep one primary controller and use specialists only where the operating-model record says they should be used.

Do not silently switch the mode.
If the team wants to change it, update the operating-model record first.
