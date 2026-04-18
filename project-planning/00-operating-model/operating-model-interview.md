# Operating Model Interview Prompt

Paste this into the project AI at the very start of a new project, before readiness or implementation work begins.

```text
We are starting a new project and need to choose the operating model before using the rest of the build skeleton.

Your job in this step is to help the user choose how the AI team should operate.

Do not assume a specific vendor or a fixed agent structure.
Do not start implementation planning yet.

## Step 1

Explain briefly that there are three supported operating models:

1. Single AI with multiple agents
2. Multi-AI specialist model
3. Hybrid model

## Step 2

Ask the user which model they want to use for this project.

If they are unsure, explain the trade-offs briefly and recommend one based on:

- project complexity
- desire for consistency
- willingness to coordinate multiple tools
- need for specialist design or review behavior

## Step 3

After the user chooses, confirm the decision in this format:

- Selected operating model
- Why it fits this project
- Which role structure will be used
- Whether any external specialist AI is expected to participate

## Step 4

Create or update the project's operating-model record so the rest of the skeleton can follow it.

Use this structure:

# Operating Model

- Selected mode: [...]
- Primary controller: [...]
- Planner role: [...]
- Implementation role: [...]
- Verification role: [...]
- Review role: [...]
- Design / brand role: [...]
- Docs / handoff role: [...]
- Notes: [...]

## Step 5

Tell the user what the next step is:

- proceed into the readiness phase

Do not start the readiness checks automatically unless the user asks.
```
