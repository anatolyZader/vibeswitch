# .cursor/hooks/

Cursor hook scripts for this workspace. The **stop** hook is enabled in this repo via `.cursor/hooks.json` for long-running agent loops.

- **grind.js** — Stop-hook script for long-running agent loops (e.g. “grind until tests pass”). When the stop hook is configured, Cursor invokes it after each agent turn; the script may return a `followup_message` to continue the loop until the goal is met (e.g. scratchpad contains `DONE`) or max iterations are reached. See [Agent loop and stop hook](../docs/AGENT-LOOP-STOP-HOOK.md) and the “Grind loop” section in `.cursor/rules.md` for behavior.
- **grind.ts** — Same behavior as grind.js, for use with [Bun](https://bun.sh). Use `bun run .cursor/hooks/grind.ts` in the `stop` command if you prefer Bun; Node + grind.js remains the default and tested path.

This is the only hooks directory in the repo; the root `hooks/` folder was removed to avoid duplication.
