---
name: enforce-grind-hook
description: Enforces use of the Cursor stop hook (grind loop) for every agent interaction; tasks with goals loop until done, one-off answers write DONE to stop the loop.
---

# Enforce Grind Hook for Every Agent Interaction

Use this skill when the user wants the agent to **treat every interaction** as part of a grind loop: multi-step tasks run until the goal is met, and one-off questions end the loop by writing DONE.

## Prerequisites

- `.cursor/hooks.json` has a `stop` hook that runs the grind script (e.g. `node .cursor/hooks/grind.js`).
- `.cursor/scratchpad.md` exists; the grind script reads it and continues the loop unless it contains `DONE`.

## Instructions

### 1. For any task with a verifiable goal (grind by default)

When the user asks you to do something that has a clear success condition (fix a bug, add a feature, run tests until they pass, make lint clean, implement X):

- **Do not** write `DONE` in `.cursor/scratchpad.md` until the goal is actually met.
- Work, then stop. The stop hook will run and send a follow-up; you will get another turn and should continue until the goal is met.
- **When the goal is met:** write `DONE` on its own line in `.cursor/scratchpad.md` so the stop hook stops the loop.
- If the scratchpad already contains `DONE` from a previous run, remove it at the start of your work (or ask the user to clear it) so the loop can run.

### 2. For one-off questions (stop the loop)

When the user asks a simple question (explain this, what does X do, how does Y work) with no multi-step task:

- Answer fully.
- Then write `DONE` in `.cursor/scratchpad.md` so the stop hook does **not** start another turn. This prevents a pointless "Continue working..." follow-up.

### 3. Summary table

| User intent | Your action re: scratchpad |
|-------------|----------------------------|
| Task with goal (fix, implement, tests pass, etc.) | Do not write DONE until goal is met; then write DONE. |
| One-off question | Answer, then write DONE. |

## Integration with project rules

If the project has a "Grind loop (stop hook)" section in `.cursor/rules.md`, follow that section; this skill restates the same behavior so it can be applied when the skill is invoked or when the user asks to "enforce grind for every interaction."
