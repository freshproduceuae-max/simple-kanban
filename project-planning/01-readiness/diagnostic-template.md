# Diagnostic Template

Use this as the target behavior for a readiness checker in your tool.

## Expected Sections

- Accounts
- Local CLIs
- Provider auth
- Plugins / MCP
- Optional extras

## Expected Final Status

- `All tools ready` when all required checks pass
- otherwise a concise list of missing or manual-confirmation items

## Required Auto Checks

- `git --version`
- `node --version`
- `claude --version`
- `claude doctor`
- `gh --version`
- `vercel --version`
- `codex` availability
- `gemini --version` if Gemini is part of the workflow

## Manual Confirmation Items

- GitHub account access
- Vercel account access
- Claude Pro status
- Codex Desktop sign-in
- Claude in Chrome extension
- plugin installation state if direct verification is unavailable
