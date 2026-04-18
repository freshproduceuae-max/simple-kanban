# Before Day 1 Checklist

Confirm all of these before starting a project build:

- GitHub account created and accessible
- Vercel account created using GitHub sign-in
- Claude Pro subscription active on `claude.ai`
- Terminal tool installed
- Git installed and verified: `git --version`
- Node.js v20+ installed and verified
- Claude Code CLI installed and authenticated: `claude doctor`
- GitHub CLI installed: `gh --version`
- Vercel CLI installed: `vercel --version`
- Codex Desktop installed and signed in
- Diagnostic command shows `All tools ready`

Additional checkpoint items:

- `/plugin` shows installed skill packs
- Claude confirms `context7` and `playwright` when asked about available MCP servers
- Claude in Chrome extension is installed and pinned
- Any instructor-required CLIs are installed and verified

Recommended MCP setup:

- `claude mcp add context7 -- npx -y @upstash/context7-mcp@latest`
- `claude mcp add playwright -- npx -y @playwright/mcp@latest`
- `claude mcp list`
