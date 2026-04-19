# Operating Model

- Selected mode: Hybrid
- Primary controller: Claude Code (this assistant) — drives planning, implementation, session docs, and day-to-day decisions
- Planner role: Claude Code, using the `superpowers:writing-plans` skill; plans live in `docs/plans/` and must be approved before implementation
- Implementation role: Claude Code subagents dispatched via `superpowers:subagent-driven-development`, one task at a time, on a feature branch
- Verification role: Claude Code runs `npm run lint && npm run test && npm run build` before opening any PR; GitHub Actions CI re-runs the same on every push
- Review role: Codex as the blocking PR reviewer on every PR before merge; Claude Code's `superpowers:requesting-code-review` may be used as a pre-review sanity pass, but Codex is the gate
- Design / brand role: Claude Code using the `frontend-design` skill for incremental UI work; Gemini invoked only when a dedicated brand / visual-direction pass is explicitly requested (not expected for v0.4)
- Docs / handoff role: Claude Code, writing to `docs/tracking/` (progress + claude-progress) and `docs/plans/` at session wrap
- External specialist AI used: Codex (blocking PR review). Gemini reserved for optional brand passes, not assumed in the default flow.
- Reason for this choice:
    - Claude Code already owns the full history of v0.1.0 and the v0.4 brainstorm; fracturing state across multiple AIs would cost more than it earns for a project at this size.
    - v0.4 is itself a multi-agent backend — we want clear separation between *how we build* (this operating model) and *what we build* (the Research Council). Hybrid keeps the build loop simple while the product stays ambitious.
    - Codex-as-blocking-reviewer is the one external specialist whose value is unambiguous: an independent reviewer that was not present during implementation catches the things an implementing author misses.
    - v0.1.0's editorial design shipped without Gemini; promoting Gemini from optional to required would be over-engineering.
- Revision rule: This operating model is the default for now and may be changed later by explicit user decision. If v0.4 grows a dedicated brand / marketing surface, promote Gemini from optional to active.

## Per-release agent split

Up to four agents work in parallel **within** each release. Releases ship **serially** (v0.4 → v0.5 → v0.6 → v1.0). The split pattern varies:

- **v0.4 Council — by domain (P1, methodology deviation).**
    - Agent A: Backend / Data (API routes, persistence, env)
    - Agent B: Frontend / UX (shelf, chat thread, chips, proposal cards, thinking-stream aesthetic)
    - Agent C: AI / Council (Researcher + Consolidator + Critic prompts, orchestration, streaming)
    - Agent D: Quality (tests, lint, build, Codex handoff prep)
    - **Why deviate:** the Council is novel; concentrating orchestration + prompt design under one domain-owner prevents it from being squeezed by UI polish. Documented deviation from `project-planning/11-execution-cycle/team-mode-adaptation.md`.
- **v0.5 Teams and later — by lifecycle (P2, methodology default).**
    - Repo reader, Implementation, Verification, Docs, Review support (as prescribed in the methodology).
    - Reason to snap back: v0.5/v0.6/v1.0 work is more mechanical; lifecycle roles scale better once the domain shape is known.

Both splits operate under the Hybrid rules above — Claude Code is still the primary controller for each agent, and Codex is still the blocking PR reviewer.
