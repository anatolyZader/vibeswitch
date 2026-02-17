# Report Button: Required Files and Where the Bug Can Hide

This document lists every file involved in making the Report status bar button appear, and where the bug can hide in each.

---

## 1. `extension.js` (main entry)

**Required for:** Creating the status bar item, showing it, and reacting to config.

| Location | What it does | Where the bug can hide |
|----------|----------------|------------------------|
| **Top of `try` block (~116–134)** | Reads `showInStatusBar` config, creates `state.statusBarItem` with `createStatusBarItem(Right, 50)`, sets `name`, `command`, `text`, `tooltip`, pushes to `context.subscriptions`, calls `show()` if config true. | Activation never reaches this block if something earlier throws or blocks (we moved it first to avoid that). `show()` may throw and be swallowed in catch. Wrong alignment/priority (e.g. 50) could put the item in overflow so it never appears. |
| **~275–276** | After `startAwarenessMonitor()`, calls `state.statusBarItem.show()` again if config true. | Runs only if activation gets this far; if activation threw before here, this never runs (we already create/show first). |
| **~281–294** | Delayed re-show at 200, 800, 2000 ms via `setTimeout(showReportIfEnabled, ms)`. | If the workbench only renders the item after a delay, one of these should show it; if all run with `hasItem`/`showCfg` true and the button still doesn’t appear, the issue is host/workbench rendering, not timing. |
| **~298–306** | `onDidChangeConfiguration`: when `vibeswitch.showInStatusBar` changes, calls `show()` or `hide()`. | If this fires on load with `show === false` (e.g. config read before default applied), we hide the item and the user never sees it. |
| **~361–362** | In `catch` block: re-shows the item so the user can open the dashboard after an error. | Only runs if activation threw; if we never threw, this doesn’t run. |

**Other:** `state` must be the same `ExtensionState` instance that holds `statusBarItem`; `context.subscriptions` must be the extension context so the item isn’t disposed early.

---

## 2. `extensionState.js`

**Required for:** Holding the status bar item reference.

| Location | What it does | Where the bug can hide |
|----------|----------------|------------------------|
| **Constructor: `this.statusBarItem = null`** | Initial value before `extension.js` assigns the created item. | If `extension.js` ever overwrote `state` or used a different state instance, `state.statusBarItem` could stay null or point to a disposed item. Unlikely given current flow. |

---

## 3. `initializeHelpers.js`

**Required for:** `switchModeInStatusBar()` which is called after the monitor starts and only calls `state.statusBarItem.show()` when config is true.

| Location | What it does | Where the bug can hide |
|----------|----------------|------------------------|
| **`switchModeInStatusBar` (~90–99)** | Reads `state.statusBarItem` and `showInStatusBar` config; if both truthy, calls `state.statusBarItem.show()`. | If `state` passed into `initializeHelpers(state, …)` were a different object than the one that received the item in `extension.js`, we’d be calling `show()` on the wrong reference (or null). Same `state` is used in `extension.js`, so this is unlikely. |

---

## 4. `vsCommandsFactory.js`

**Required for:** Registering the command the button invokes and the “Show Status Bar” command.

| Location | What it does | Where the bug can hide |
|----------|----------------|------------------------|
| **`vibeswitch.openDashboard` (~103)** | Handler that opens the dashboard. | If this command weren’t registered, the button would still *appear* but click would do nothing. Not the cause of “button doesn’t appear”. |
| **`vibeswitch.showStatusBar` (~58–64)** | If `state.statusBarItem` is null, shows error; else calls `state.statusBarItem.show()`. | Only affects manual “Show Status Bar” command; doesn’t create the item. Not the cause of initial non-appearance. |

---

## 5. `package.json`

**Required for:** Activation, main entry, command and config contributions.

| Location | What it does | Where the bug can hide |
|----------|----------------|------------------------|
| **`main`** | `"./out/extension.js"` – the loaded entry is the **built** file. | If the build is stale or broken, the running code might not include the “create status bar first” logic. Always build after changing `extension.js` (e.g. `npm run compile`). |
| **`activationEvents`** | `"onStartupFinished"` – activation runs after the workbench is ready. | Theoretically the status bar could be ready; if Cursor/VS Code had a bug with `onStartupFinished` and status bar lifecycle, the item might be created “too early” or “too late”. |
| **`contributes.commands`** | Declares `vibeswitch.openDashboard` (and others). | Required for the button’s `command` to be valid; missing command could affect rendering in some hosts. |
| **`contributes.configuration["vibeswitch.showInStatusBar"]`** | Default `true`, description for the setting. | If the default were false or the setting were missing, we’d read false and never show. Default is true. |

---

## 6. `ui/reportButtonDisplay.js`

**Required for:** *Not* required for the button to **appear**. Only used if something calls `updateReportButton()`.

| Location | What it does | Where the bug can hide |
|----------|----------------|------------------------|
| **`updateReportButton()`** | Can call `statusBarItem.hide()` when `!showInStatusBar`, or set `text`/`command`/`backgroundColor`/`tooltip` and `show()`. | Nothing in the codebase calls this for the Report button anymore. If any code path did call it with `showInStatusBar === false`, it would hide the item. If it set MarkdownString tooltip or raw hex `backgroundColor`, the workbench might hide the item (Trusted Types). |

---

## 7. `ui/frameFlash.js`

**Required for:** A *different* status bar item (flash pulse). Does not reference `state.statusBarItem`.

| Location | What it does | Where the bug can hide |
|----------|----------------|------------------------|
| **`ensureFlashStatusBarItem()`** | Creates `vscode.window.createStatusBarItem(Left, 1000)`. | Separate item; doesn’t replace or hide the Report item. No conflict. |

---

## 8. Build output: `out/extension.js`

**Required for:** This is what actually runs when the extension loads (`package.json` `main`).

| Location | What it does | Where the bug can hide |
|----------|----------------|------------------------|
| **Whole file** | Compiled/copied from `extension.js`. | If you edit `extension.js` but don’t rebuild, the running code is old. Run `npm run compile` (or your build script) and reload the window. |

---

## 9. Logger and early activation (`extension.js` and `logger`)

**Required for:** Log is created *after* the status bar block; the status bar block runs before `initializeLogger` / `createLogWrapperFunc()`.

| Location | What it does | Where the bug can hide |
|----------|----------------|------------------------|
| **After status bar block** | `state.outputChannel = vscode.window.createOutputChannel(...)`, `initializeLogger`, `applyVSCodeLoggingSettings`, `log = createLogWrapperFunc()`. | If any of these threw or made the extension host unresponsive before we moved the status bar first, we’d never create the item. With the current order, the bug is not here for “never reached”; it could still be that later code throws and the catch block’s re-show isn’t enough if the host is in a bad state. |

---

## Summary: Most likely places the bug can hide

1. **extension.js**  
   - Config listener fires with `show === false` and hides the item (H8).  
   - Alignment/priority (Right, 50) causes the host to put the item in overflow or not render it (H6).  
   - Initial or delayed `show()` is ignored by the workbench (Cursor/VS Code rendering).

2. **package.json / build**  
   - Stale or broken build so the “create first” and minimal tooltip/color code isn’t in `out/extension.js`.

3. **Host/workbench**  
   - Cursor or VS Code doesn’t show the item for a given alignment/priority or due to Trusted Types / security policy even with plain tooltip and no custom color.

No other file in the list is currently in the “create and show Report item” path in a way that would prevent the button from appearing, except indirectly (e.g. `state` identity in `initializeHelpers.js`).
