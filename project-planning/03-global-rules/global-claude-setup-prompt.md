# Global CLAUDE.md Setup Prompt

Paste into `Claude Code`.

```text
Create my global CLAUDE.md file at ~/.claude/CLAUDE.md

I am building web apps with AI assistance. Create a lean, disciplined file that enforces professional standards across all my projects. Keep it under 100 lines.

## Create the file with this exact content:

# Global Preferences

Applied to every project on this machine.

## Stack Defaults

- Framework: Next.js 14 (App Router)
- Language: TypeScript (strict mode)
- Styling: Tailwind CSS
- Package manager: npm

## Workflow

### Before writing code
- Read existing code first. Understand what is already there.
- For changes over 20 lines, explain your plan and wait for approval.
- Ask before installing any new npm package.
- One feature at a time. Finish before starting the next.

### Subagent strategy
- Use subagents to keep the main context window clean.
- Offload research, exploration, and parallel analysis to subagents.
- One task per subagent for focused execution.

### While writing code
- Smallest diff that solves the problem. No speculative code.
- Reuse existing patterns. Do not invent new abstractions.
- Every user action needs loading, success, and error states.
- Mobile-first: design for phone, then scale up.

### Verification before done
- Never mark a task complete without proving it works.
- Run npm run build. Run npm run lint. Both must pass.
- Ask: "Would a senior engineer approve this?"

### Self-improvement loop
- After any correction from me, update CLAUDE.md with the pattern.
- Write rules that prevent the same mistake from recurring.

## Security

- Never trust user input. Validate everything server-side.
- Never expose secrets in client-side code.
- Secrets in environment variables only. Never hardcoded.
- Users access only their own data. Always filter by user_id.
- Operations must be safe to retry. No duplicate data on resubmit.

## PR Workflow

1. Feature branch created before any code is written
2. Code written on branch
3. PR created with clear title and description
4. Codex reviews the PR
5. Issues fixed, PR updated
6. My approval before merge
7. Merge to main, branch deleted

Never commit directly to main.

## Never do this

- Commit directly to main
- Merge without my approval
- Delete files without asking
- Skip error handling
- Hardcode secrets or API keys
- Add code just in case we need it later
- Refactor unrelated code while fixing something else

After creating the file, confirm with: "Global CLAUDE.md created at ~/.claude/CLAUDE.md"
```
