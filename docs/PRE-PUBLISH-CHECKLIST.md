# Pre-Publish Checklist

Run these steps before releasing a new version of the VibeSwitch extension.

## 0. Tests (recommended)

- Run **`npm run test:mvp`** (stable suites only: awareness, golden, property, persistence, mode-enforcement, scoring, ui, mcp-server). Use this for CI and pre-release; `npm test` runs the full suite including suites that may be broken or skipped.
- Optionally run **`npm run test:electron`** with `VIBESWITCH_INTEGRATION_TEST=1` if extension-host tests are set up.

## 1. Package

- Run `npm run package`.
- Confirm a `.vsix` file is produced in the project root.

## 2. Contents

- Inspect or extract the `.vsix` (e.g. rename to `.zip` and unzip, or use `vsce ls`).
- Verify the following are present:
  - `hooks/` with all four scripts: `gate-shell.sh`, `gate-mcp.sh`, `inject-context.sh`, `detect-edit.sh`
  - `lib/canonical.js`
  - `mcp-servers/mode-enforcement/` (entry point and dependencies)

## 3. Install

- In Cursor: **Extensions: Install from VSIX...** and select the packaged `.vsix`.
- Reload the window if prompted.

## 4. Setup

- After install, if the capability self-test fails, you will be prompted to set up. Choose **Setup** (or run **VibeSwitch: Setup Capability Scripts** from the Command Palette).
- Run **VibeSwitch: Run Capability Self-Test** and confirm it passes (hooks exist and are executable, `jq` is available).

## 5. MCP path

- Confirm the MCP server runs when Cursor invokes it. Path should be `<extensionPath>/mcp-servers/mode-enforcement/index.js`, where `<extensionPath>` is the installed extension directory (e.g. under Cursor’s `extensions` folder).
- The `@modelcontextprotocol/sdk` dependency must resolve from the extension’s `node_modules` when Cursor runs `node .../mcp-servers/mode-enforcement/index.js`.
- **Node on PATH:** Cursor invokes the MCP server with `node`; `node` must be on the system PATH. On Windows, depending on install, `node` may not be on PATH—document or fix for your environment. Post-MVP: consider using `process.execPath` or a bundled Node.

## 6. Manual E2E

In Cursor with the installed extension:

1. **DEV mode and built-in edit**
   - Switch to DEV mode (command palette or status bar).
   - Trigger a built-in agent edit (e.g. ask Cursor to edit a file).
   - Confirm you see the alert (and optional auto-revert if `autoRevertUnapprovedEdits` is enabled).

2. **MCP approve and apply**
   - Use the MCP flow: agent calls `submit_patch` → you approve → agent calls `apply_patch` with the token.
   - Confirm the file change is applied as expected.

3. **Awareness and mode**
   - Confirm the awareness meter and mode indicator update and behave as expected when switching modes and when activity occurs.

## 7. Publish prep (when publishing to Marketplace)

- Set the real `publisher` in `package.json` and update any tests that reference the extension ID (e.g. `your-publisher-name.vibeswitch`).
- Ensure docs (e.g. DEV vs VIBE restrictions) state that `autoRevertUnapprovedEdits` defaults to `false` and why.
