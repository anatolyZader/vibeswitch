# Mode Removal Verification

Mode switching and enforcement have been removed. This doc records what was removed and what remains.

## Removed

- Mode commands: switchMode, toVibe, toDev, showAlertLog, capabilitySelfTest, setupCapability, registerMcpServer (removed from package.json and vsCommandsFactory).
- .cursor/hooks.json: cleared to `{"version":1,"hooks":{}}` so no gate-shell, gate-mcp, inject-context, detect-edit run.
- DEV-only guards: Show unreviewed files and file decorations work regardless of mode.
- business_modules/mode and mode-enforcement, lib/modeDetection.js, lib/capabilitySetup.js, ui/modeSwitcherDisplay.js.

## Kept (display only)

- extensionState: currentMode set to 'vibe' once; getMode() for dashboard/display; setMode is no-op.
- switchModeInStatusBar in initializeHelpers only sets status bar text to "VibeSwitch" and refreshes meter (no picker).
- Single hooks dir: `.cursor/hooks/` with grind.js only (root `hooks/` removed). mcp/mode-enforcement is legacy.

## Check

- .cursor/hooks.json should be `{"version":1,"hooks":{}}`.
- No "FILE EDIT DETECTED IN DEV MODE" from VibeSwitch hooks when editing files.
- Command palette has no Show Capability Alert Log, Run Capability Self-Test, Setup Capability Scripts, Register MCP Server.
