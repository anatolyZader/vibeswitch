# .cursor/hooks/

Optional Cursor hook script for this workspace:

- **grind.js** — Stop-hook script for long-running agent loops (e.g. “grind until tests pass”). Add a `stop` entry to `.cursor/hooks.json` pointing to `node .cursor/hooks/grind.js` if you use it. See [Agent loop and stop hook](../docs/AGENT-LOOP-STOP-HOOK.md).

This is the only hooks directory in the repo; the root `hooks/` folder was removed to avoid duplication.
