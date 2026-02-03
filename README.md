# VibeSwitch

**Stay Aware, Stay in Control: Steer Your AI Speed**

VibeSwitch is a VS Code / Cursor extension that lets you switch between two AI collaboration modes:

- **VIBE** — Fast, autonomous: file edits and most shell/MCP actions allowed.
- **DEV** — Slow, aware: built-in file edits blocked (or auto-reverted); MCP file edits only via approval token; shell and MCP restricted to allowlist / vibeswitch-only.

See [DEV vs VIBE mode restrictions](docs/2026-01-26_15-30-dev-vs-vibe-mode-restrictions.md) for the full matrix.

## Install

- **From VSIX:** Install the packaged `.vsix` (e.g. **Extensions: Install from VSIX...**).
- **From source:** Clone the repo, run `npm install`, then use **Develop: Install Extension** from the workspace or package with `npm run package`. Before release, run **`npm run test:mvp`** (stable suites); see [Pre-publish checklist](docs/PRE-PUBLISH-CHECKLIST.md).

## First-run setup

Capability enforcement (hooks and MCP) requires scripts and a shared module under `~/.vibeswitch/`:

1. **Prerequisite:** [jq](https://stedolan.github.io/jq/) must be installed (used by hook scripts).
2. On first activation, if the capability self-test fails, you’ll be prompted: **Setup VibeSwitch?** Choose **Setup** to copy hook scripts and `canonical.js` to `~/.vibeswitch/hooks/` and `~/.vibeswitch/lib/`.
3. Or run **VibeSwitch: Setup Capability Scripts (hooks and canonical.js)** from the Command Palette anytime.
4. Run **VibeSwitch: Run Capability Self-Test** to verify. It checks that hook scripts exist and are executable, and that `jq` is available.

## Switching mode

- **Command Palette:** **VibeSwitch: Switch AI Collaboration Mode** (or **Switch to VIBE Mode** / **Switch to DEV Mode**).
- **Status bar:** Click the mode indicator (e.g. VIBE / DEV) on the right.
- **Keybinding:** `Ctrl+Shift+M` (Windows/Linux) or `Cmd+Shift+M` (macOS).

Mode is persisted and reflected in the status bar and in `.cursor/rules.md` (or rules.dev.md / rules.vibe.md) for Cursor.

## MCP server (DEV mode file edits)

In DEV mode, the agent cannot use built-in Write/StrReplace/Edit; it must use the VibeSwitch MCP tools:

1. **Add the MCP server in Cursor:**
   - **Option A:** Run **VibeSwitch: Register MCP Server** from the Command Palette. This writes the VibeSwitch MCP server into Cursor’s global MCP config (`~/.cursor/mcp.json`). Restart Cursor or reload the window if needed.
   - **Option B:** Add the MCP server manually in Cursor MCP / settings:
     - **Command:** `node`
     - **Args:** path to the MCP server entry point, e.g. `<extensionPath>/mcp/mode-enforcement/index.js`  
       (Replace `<extensionPath>` with your VibeSwitch extension install path, e.g. under `.vscode/extensions/` or Cursor’s extensions directory.)
     - **Server name:** use a fixed name, e.g. `vibeswitch`.

2. **Create `~/.vibeswitch/state/mcp-server.json`** so the shell hook can verify the server:
   ```json
   { "serverName": "vibeswitch" }
   ```
   The `serverName` must match the name Cursor uses for this MCP server in the hook payload.

3. After setup, the agent can call `mcp__vibeswitch__submit_patch` and, after your approval, `mcp__vibeswitch__apply_patch` with the token.

## Configuration

- **vibeswitch.showInStatusBar** — Show mode and awareness meter in the status bar (default: `true`).
- **vibeswitch.autoRevertUnapprovedEdits** — In DEV mode, auto-revert git-tracked files when built-in edits are detected (default: `false`). Defaults to `false` to avoid unexpected reverts; set to `true` to enforce automatic revert of unapproved built-in edits in DEV mode. See [DEV vs VIBE](docs/2026-01-26_15-30-dev-vs-vibe-mode-restrictions.md).

## Awareness and stats

- The extension tracks AI suggestions and review behavior and computes an awareness score (0–100).
- Usage stats (file opens, edits, saves, AI suggestion outcomes) are stored locally and can be exported via **VibeSwitch: Export Statistics to JSON**. Nothing is sent off-device.

## License

MIT.
