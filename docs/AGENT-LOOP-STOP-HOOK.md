# Long-Running Agent Loops (Stop Hook)

Cursor supports a **stop** hook that runs when the agent finishes a turn. By returning a `followup_message`, you can make the agent loop until a goal is met (e.g. tests pass, UI matches a mockup).

## How it works

1. Configure a `stop` hook in `.cursor/hooks.json` that runs a script.
2. When the agent stops, Cursor invokes the script and passes JSON on stdin: `{ "conversation_id", "status", "loop_count" }`.
3. The script may print `{ "followup_message": "..." }` to stdout to continue the loop, or `{}` / nothing to end it.

## VibeSwitch and the stop hook

VibeSwitch no longer enforces or modifies `.cursor/hooks.json`. You can add or edit a `stop` entry in `.cursor/hooks.json` freely.

## Enabling the stop hook

1. **Add the `stop` key** to `.cursor/hooks.json` in your workspace. A `timeout` (e.g. 10 seconds) is recommended so the hook does not hang if the script stalls.

2. **Copy-paste ready `hooks.json`** (full file; merge with any existing hooks you have):

   ```json
   {
     "version": 1,
     "hooks": {
       "stop": [{ "command": "node .cursor/hooks/grind.js", "timeout": 10 }]
     }
   }
   ```

3. **Ensure the script exists** in one of these places:
   - **Workspace:** `.cursor/hooks/grind.js` (recommended for project-specific loops).
   - **Global:** Copy `.cursor/hooks/grind.js` to `~/.vibeswitch/hooks/` (or another path) and point the command at it, e.g. `node ~/.vibeswitch/hooks/grind.js`.

## Grind script (grind.js)

The repo includes a Node script that implements the “grind until done” pattern:

- **Location:** `.cursor/hooks/grind.js` (only hooks directory in the repo).
- **Behavior:** Reads a scratchpad file (default `.cursor/scratchpad.md`). If it contains `DONE` or the run is not `completed` or the iteration count reaches the max, it outputs `{}` and the loop ends. Otherwise it outputs a `followup_message` telling the agent to continue and update the scratchpad with `DONE` when complete.
- **Environment variables:**
  - `GRIND_MAX_ITERATIONS` — Max iterations (default `5`).
  - `GRIND_SCRATCHPAD` — Path to the scratchpad file (default `.cursor/scratchpad.md`).

Example: run the agent until tests pass by having the agent run tests and write `DONE` into `.cursor/scratchpad.md` when they succeed; the grind script will then stop the loop.

## Example: grind until tests pass

1. Add `stop` to `.cursor/hooks.json` as above, with `node .cursor/hooks/grind.js`.
2. The script is already at `.cursor/hooks/grind.js` in the repo.
3. In your prompt or rules, tell the agent to:
   - Run tests (e.g. `npm test`).
   - When all tests pass, write `DONE` into `.cursor/scratchpad.md`.
4. The stop hook will keep sending a followup until the scratchpad contains `DONE` or the max iterations are reached.

**Node (default):** No Bun dependency is required; the script runs with Node (`.cursor/hooks/grind.js`).

**Bun / TypeScript (optional):** If you have [Bun](https://bun.sh) on your PATH, you can use the TypeScript variant instead. Add a `stop` entry with:

```json
"stop": [{ "command": "bun run .cursor/hooks/grind.ts", "timeout": 10 }]
```

The repo includes `.cursor/hooks/grind.ts` with the same contract; it uses `GRIND_MAX_ITERATIONS` and `GRIND_SCRATCHPAD` the same way as the Node script.
