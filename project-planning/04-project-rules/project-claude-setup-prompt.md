# Project CLAUDE.md Setup Prompt

Paste into `Claude Code` from the root of the new project.

```text
Create a CLAUDE.md file at the root of this project.

Use the Vision Document below to understand what this app does and who it is for. Generate a lean, precise configuration file that gives Claude everything it needs to work on this project — and nothing it does not need.

## Requirements for the file

Structure it with these sections:

### Project
- App name and one-line description
- Who it is for and the core problem it solves
- The 3–5 core features
- What is explicitly out of scope

### Tech Stack
- Next.js 14 (App Router), TypeScript (strict), Tailwind CSS
- Supabase for database and authentication
- Vercel for deployment
- List any additional libraries required by the features

### Data Model
- Key entities and their primary fields
- Relationships between entities
- Any constraints that affect how data is stored or queried

### Workflow Rules
- Any patterns specific to this app that override global defaults
- Feature ordering preferences
- Any third-party integrations and their setup requirements

### @path Imports
- Reference the PRD with @docs/PRD.md once it is created
- Reference the feature list with @feature_list.json once it is created

### Project-Specific Never Do This
- Anything unique to this app that Claude must not do

## Format rules

- Under 150 lines
- Declarative bullet points only
- Do not repeat rules already in the global CLAUDE.md
- Leave @path import lines as placeholders until those files exist

After creating the file, summarise the key decisions you made and flag anything you were unsure about.

Note: The Vision Document is already saved in this project folder. Look for a file named vision.md, vision-document.md, or similar in the project root or docs/ directory. Read it from disk — do not ask me to paste it.
```
