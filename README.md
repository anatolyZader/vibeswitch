# VibeSwitch

**Stay Aware, Stay in Control: Steer Your AI Speed**

VibeSwitch is a VS Code / Cursor extension focused on **measuring developer behavior** and **objective code quality**: awareness scoring, AI suggestion tracking, research (Sonar/ESLint, plan and test adherence), and optional long-running agent loops. It does not switch or enforce VIBE/DEV modes.

## Install

- **From VSIX:** Install the packaged `.vsix` (e.g. **Extensions: Install from VSIX...**).
- **From source:** Clone the repo, run `npm install`, then use **Develop: Install Extension** from the workspace or package with `npm run package`. Before release, run **`npm run test:mvp`** (stable suites); see [Pre-publish checklist](docs/PRE-PUBLISH-CHECKLIST.md).

## Optional setup

- For agent loops, copy `.cursor/hooks/grind.js` to `~/.vibeswitch/hooks/` (or use it from the workspace). No hooks or enforcement are required for core features.

## Configuration

- **vibeswitch.showInStatusBar** — Show VibeSwitch label and awareness meter in the status bar (default: `true`).

## Long-running agent loops (stop hook)

You can use Cursor’s **stop** hook to run the agent in a loop until a goal is met (e.g. tests pass). Add a `stop` entry to `.cursor/hooks.json` that runs `node .cursor/hooks/grind.js` (or copy that script to `~/.vibeswitch/hooks/` and point the command there). See [Agent loop and stop hook](docs/AGENT-LOOP-STOP-HOOK.md) for setup and the grind script.

## Awareness and stats

- The extension tracks AI suggestions and review behavior and computes an awareness score (0–100).
- Usage stats (file opens, edits, saves, AI suggestion outcomes) are stored locally and can be exported via **VibeSwitch: Export Statistics to JSON**. Nothing is sent off-device.

## License

MIT.
