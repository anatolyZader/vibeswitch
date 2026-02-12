# VibeSwitch Extension Specification (Code-Derived)

## 1. Scope and methodology

This specification is derived from executable source code and manifest wiring in this repository, primarily:

- `package.json`
- `extension.js`
- `initializeHelpers.js`
- `compositionRoot.js`
- `vsCommandsFactory.js`
- `business_modules/**`
- `ui/**`
- `hooks/**`
- `mcp/mode-enforcement/index.js`

This document intentionally treats implementation as authoritative. It does not rely on historical markdown documentation or inline comments as a source of truth.

## 2. Product definition

VibeSwitch is a VS Code/Cursor extension that combines:

1. **Mode control**: switches between `vibe` and `dev` collaboration profiles by rewriting `.cursor/rules.md` and applying workspace settings.
2. **Awareness monitoring**: continuously classifies edits, tracks AI suggestion lifecycle, computes a risk score, and surfaces dashboard/status signals.
3. **Mode enforcement**: installs and guards hook-based controls, approval workflow, and an MCP patch server.
4. **Optional enrichments**: semantic LLM insights, dashboard chat, token usage fetch, and agent orchestration.

## 3. Extension lifecycle and runtime architecture

## 3.1 Activation contract

- **Activation event**: `onStartupFinished`
- **Entry point**: `./out/extension.js`
- **Activation sequence** (high level):
  1. Create `ExtensionState` + `DIContainer`
  2. Create output channel and initialize logger policy
  3. Initialize mode-enforcement stack (mode manager, allowlist, hook setup, self-test, hook guard, edit detector, keypair, approval manager)
  4. Optionally initialize agents integration (if `vibeswitch.agents.enabled`)
  5. Compose awareness engine + usage stats + optional LLM + antipattern + token usage client
  6. Initialize helpers and register all command handlers
  7. Detect initial mode from `.cursor/rules.md`
  8. Start awareness monitor (single continuous monitor, not per-mode)
  9. Register usage stats event listeners

## 3.2 Runtime state container

`ExtensionState` holds:

- UI handles: `statusBarItem`, `awarenessBarItem`, `outputChannel`
- Mode: `currentMode`
- Services: `usageStats`, `awarenessEngine`, optional integrations
- Enforcement references: `modeEnforcement`
- Timer references

`setMode()` also asynchronously syncs to `ModeManager`.

## 3.3 Dependency composition

`compositionRoot.compose()` wires:

- Adapters: VS Code, workspace-state persistence, logger, id/hash generators
- Domain services: range operations, URI/path operations
- `AwarenessEngine`
- `UsageStatsService`
- Optional: LLM insight services
- Optional: antipattern event store + code analysis service
- Optional: Cursor usage API client

## 4. Mode subsystem

## 4.1 Mode values

Allowed modes are strictly `dev` or `vibe` (`business_modules/mode/domain/value_objects/mode.js`).

## 4.2 Mode detection

`modeDetection()`:

- Reads `.cursor/rules.md` first
- Detects by markers:
  - Vibe: `VIBE MODE` or `cursor.chat.defaultMode="agent"`/`'agent'`
  - Dev: `DEV MODE` or `cursor.chat.defaultMode="ask"`/`'ask'`
- Falls back to `rules.dev.md`/`rules.vibe.md` only if `rules.md` is absent
- Uses 2-second in-memory cache with explicit invalidation

## 4.3 Mode switching behavior

`modeService` flow:

1. Validate mode
2. Ensure workspace and `.cursor/` directory
3. Assemble effective rules from:
   - `.cursor/rules.common.md`
   - `.cursor/rules.dev.md` or `.cursor/rules.vibe.md`
4. Atomic write to `.cursor/rules.md` via temp file + rename
5. Optional backup/rollback (`rules.md.bak`) around settings application
6. Invalidate mode-detection cache
7. Apply mode-specific workspace settings (`modeSettingsAdapter`)

## 4.4 Mode-specific settings applied

- `vibe`:
  - `cursor.chat.defaultMode = agent`
  - `cursor.agent.requireApproval = false`
  - `cursor.agent.autoApplyEdits = true`
  - `cursor.ai.autoApply = true`
  - `files.autoSave = afterDelay`
  - `files.autoSaveDelay = 1000`
- `dev`:
  - `cursor.chat.defaultMode = ask`
  - `cursor.agent.requireApproval = true`
  - `cursor.agent.autoApplyEdits = false`
  - `cursor.ai.autoApply = false`
  - `files.autoSave = afterDelay`
  - `files.autoSaveDelay = 3000`

## 5. Awareness subsystem

## 5.1 Always-on monitor

The awareness monitor is started once during activation and runs in both modes. Mode affects classifier thresholds/config but not monitor existence.

## 5.2 Event ingestion

The engine subscribes to:

- text changes
- file creation
- file save/open/close
- cursor move
- visible range (scroll)
- active editor change
- filesystem create watcher (`**/*`) for external file creation detection

## 5.3 Classification pipeline

`ClassificationService` + `ChangeClassifier`:

- Debounce window: 200ms
- Produces labels: `ai`, `user`, `formatter`, `unknown`
- Signals include marker detection, insertion/size/scatter heuristics, formatter detection
- Each batch is written to `ChangeLedgerService` with metrics and diff bullets
- AI batches create suggestions; user batches can adapt pending suggestions
- Optional async LLM enrichment writes `llm_insight` ledger entries

## 5.4 Suggestion lifecycle

`SuggestionLifecycleService` manages:

- Creation of suggestions (single or batched)
- Status transitions: `pending -> accepted/rejected/adapted`
- Keep-all pattern detection
- Review tracking via dwell/engagement
- Scheduling/coalesced status checks

Key timing/thresholds:

- Initial status check around 5s after suggestion creation
- Pending timeout to allow blind acceptance observability: 30s (`PENDING_MAX_AGE_MS`)
- Dwell threshold for review marking: 3s
- Engagement timeout: 5s inactivity
- Max per-suggestion review accumulation: 60s

## 5.5 Debt model

Two distinct debt channels:

1. **File-level debt** (`FileDebt` map): unreviewed file changes
2. **Suggestion-level debt**: pending suggestion entities

Important implemented rule:

- File debt is added immediately for file operations (`isFileWrite`, `isFileCreation`, `isExternalCreation`)
- For normal text suggestions, file debt is added only when suggestion resolves, avoiding double counting with pending debt

## 5.6 Scoring model

Primary output: **risk score 0..100 (higher is worse)**.

Component scores:

- Review quality: 0..40 (higher is better)
- Blind acceptance risk: 0..30 (higher is worse)
- Adaptation quality: 0..30 (higher is better)
- Debt risk: 0..30 (higher is worse)

Risk aggregation:

- `reviewRisk = (40 - review)/40`
- `adaptationRisk = (30 - adaptation)/30`
- `blindRisk = blindAcceptance/30`
- `debtRisk = debt/30`
- `risk = 100 * (0.30*reviewRisk + 0.30*blindRisk + 0.20*adaptationRisk + 0.20*debtRisk)`
- EMA smoothing alpha: `0.3`

Windows:

- Recent activity window: 10s
- Scoring horizon: max(last 15m, last 20 resolved suggestions)

## 5.7 Antipattern outputs

Engine produces antipattern bundles (enveloped values + metadata) for dashboard usage. Implemented metrics include:

- flooding
- responseDrill
- contextSpread
- diffFlooding
- comprehensionDebt
- verificationDebt
- testTheater (heuristic)
- boundaryViolations (async path)
- observabilityNeglect
- duplication (async)

## 6. UI subsystem

## 6.1 Status bar

Two status items:

- Mode indicator (`vibeswitch.modeIndicator`, command: `vibeswitch.switchMode`)
- Awareness indicator (`vibeswitch.awarenessMeter`, command: `vibeswitch.openDashboard`)

`showInStatusBar` currently controls awareness item visibility only; mode item is force-shown.

## 6.2 Dashboard

`ui/dashboardDisplay.js` opens a persistent webview panel:

- Uses React bundle (`out/dashboard-app.js`) if available
- Falls back to static HTML renderer otherwise
- Pulls score, breakdowns, antipattern events, token usage, capability flags
- Supports read-only chat message flow through dashboard-chat module

## 6.3 Frame flash behavior

High-risk flash triggers editor decoration + status bar pulse, with cooldown.

Current implementation does **not** write window border settings; it uses in-process visual effects only.

## 7. Mode enforcement and MCP security model

## 7.1 State and file layout

Primary local directories:

- `~/.vibeswitch/state`
- `~/.vibeswitch/hooks`
- `~/.vibeswitch/lib`
- `~/.vibeswitch/mcp`

## 7.2 Enforcement components

- `ModeManager`: globalState mode source of truth + mirror `state/mode.json`
- `HooksJsonGuard`: protects `.cursor/hooks.json`, restores tamper, forces DEV, audits
- `CapabilitySelfTest`: validates jq, hook scripts executability, required state files
- `WorkspaceAllowlist`: writes trusted roots to `state/workspaces.json`
- `AlertFileEditDetector`: watches `state/alert.json`, warns and optional auto-revert
- `KeypairManager`: Ed25519 keys (`context.secrets` private, filesystem public key)
- `ApprovalManager`: watches patch requests, prompts user, writes signed approval tokens

## 7.3 Hook scripts

- `inject-context.sh`: injects mode-dependent prompt constraints
- `gate-shell.sh`: DEV allowlist with operator and command blocking; VIBE catastrophic blocking only
- `gate-mcp.sh`: DEV allows only `mcp__vibeswitch__*` and validates server identity
- `detect-edit.sh`: writes `alert.json` + audit entry for DEV edits

## 7.4 MCP server (`mcp/mode-enforcement/index.js`)

Tools:

- `mcp__vibeswitch__submit_patch`
- `mcp__vibeswitch__apply_patch`

Controls:

- Workspace allowlist check
- Path safety and blocklists
- Token verification in DEV (signature, expiry, request, path, patch hash, one-time use)
- Patch size limit in DEV (500 lines)
- `git apply --check --no-fuzz` precheck in DEV
- Audit log append for key events

## 8. LLM insight and dashboard chat

## 8.1 LLM insight pipeline

- Optional (`vibeswitch.llm.enabled`)
- Providers:
  - `local` deterministic heuristics
  - `openai` via Chat Completions
- Trigger policy:
  - AI batches
  - optional large batch trigger
- Privacy controls:
  - diff bullets on/off
  - snippet on/off + char cap
- Budgets:
  - per minute and per day in-memory limiter
- Cache:
  - workspaceState TTL cache
- Output:
  - normalized insight schema
  - in-memory semantic multiplier for debt risk

## 8.2 Dashboard chat

- Read-only assistant, no tool execution
- Uses dashboard payload + optional workspace snippets
- OpenAI-backed when key configured
- Falls back to informative error/stub behavior when disabled or key missing

## 9. Agents subsystem (current implementation status)

Intended flow exists (gateway, orchestrator, findings store, diagnostics), but current codebase is incomplete:

- `business_modules/agents/index.js` requires modules that are not present in tree:
  - `./infrastructure/gateway/agentGateway`
  - `./domain/contracts/finding`
  - `./domain/contracts/agentResponse`

Activation path is wrapped in `try/catch`, so extension startup continues if agents fail to load.

## 10. Persistence map

| Store | Key / file | Purpose |
|---|---|---|
| `context.globalState` | `vibeswitch.mode` | Secure mode source of truth |
| `context.globalState` | `vibeswitch.setupPromptShown` | One-time setup prompt gating |
| `context.workspaceState` | `debt` | File-debt persistence |
| `context.workspaceState` | `vibeswitch.changeLedger.v1` | Change ledger entries |
| `context.workspaceState` | `vibeswitch.changeLedger.checkpoint.v1` | Ledger checkpoint |
| `context.workspaceState` | `vibeswitch.agents.findings` | Findings cache |
| `context.workspaceState` | `vibeswitch.llm.insight.v1.*` | LLM insight cache entries |
| `context.secrets` | `vibeswitch.ed25519PrivateKey` | Signing private key |
| `context.secretStorage` (as coded) | `vibeswitch.cursorUsageToken` | Cursor usage token (see caveat) |
| Global storage file | `telemetry.json` | Usage stats |
| Filesystem | `~/.vibeswitch/state/mode.json` | Mode mirror for hooks |
| Filesystem | `~/.vibeswitch/state/workspaces.json` | Workspace allowlist |
| Filesystem | `~/.vibeswitch/state/mcp-server.json` | Expected MCP server identity |
| Filesystem | `~/.vibeswitch/state/alert.json` | Unapproved edit signal |
| Filesystem | `~/.vibeswitch/state/audit.log` | Enforcement audit log |
| Filesystem | `~/.vibeswitch/state/requests/*.json` | Pending approval requests |
| Filesystem | `~/.vibeswitch/state/approved/*.token` | Approved short-lived tokens |
| Filesystem | `~/.vibeswitch/mcp/publicKey.pem` | Public key for token verify |
| Filesystem | `~/.vibeswitch/mcp/consumed.json` | Consumed token/request tracking |
| Filesystem | `~/.cursor/mcp.json` | MCP server registration |

## 11. Command surface reconciliation

## 11.1 Contributed commands (package.json -> implemented)

All contributed command IDs are implemented in `vsCommandsFactory.js`.

| Command ID | Implemented behavior |
|---|---|
| `vibeswitch.switchMode` | Opens quick pick for mode selection or stats |
| `vibeswitch.toVibe` | Switches directly to `vibe` |
| `vibeswitch.toDev` | Switches directly to `dev` |
| `vibeswitch.showStats` | Opens markdown usage report |
| `vibeswitch.resetStats` | Confirms and resets usage data |
| `vibeswitch.exportStats` | Opens raw usage JSON document |
| `vibeswitch.showLogs` | Shows VibeSwitch output channel |
| `vibeswitch.showStatusBar` | Force-shows status items |
| `vibeswitch.flashWindowBorder` | Manual flash test trigger |
| `vibeswitch.restartAwarenessMeter` | Clears suggestions, debt, score |
| `vibeswitch.showAwarenessState` | Writes detailed awareness snapshot to output |
| `vibeswitch.showStatsToOutput` | Writes stats summary to output |
| `vibeswitch.refreshAwarenessMeter` | Triggers meter/decorations refresh |
| `vibeswitch.verbalReview` | Writes natural-language risk summary |
| `vibeswitch.openDashboard` | Opens/refreshes dashboard webview |
| `vibeswitch.setCursorUsageToken` | Prompts for cursor usage token storage |
| `vibeswitch.diagnoseMonitor` | Dumps monitor diagnostic data |
| `vibeswitch.diagnoseDecorations` | Dumps decoration/provider diagnostics |
| `vibeswitch.detectTestingFiles` | Detects JS files in `testing/` as external suggestions |
| `vibeswitch.showUnreviewedFiles` | Quick-pick open for debt/pending files |
| `vibeswitch.testAddAICode` | Inserts `@ai` test snippet into active editor |
| `vibeswitch.showAlertLog` | Opens `~/.vibeswitch/state/audit.log` |
| `vibeswitch.capabilitySelfTest` | Runs capability setup checks |
| `vibeswitch.setupCapability` | Installs hooks/lib into `~/.vibeswitch` |
| `vibeswitch.registerMcpServer` | Writes `~/.cursor/mcp.json` server entry |

Keybinding:

- `Ctrl+Shift+M` / `Cmd+Shift+M` -> `vibeswitch.switchMode`

## 11.2 Registered internal/test-only commands (not contributed)

These are registered at runtime but not exposed in `contributes.commands`:

- `vibeswitch._testGetScore`
- `vibeswitch._testResetState`
- `vibeswitch._testSimulateTerminalBlocked`
- `vibeswitch._testCheckpointSave`
- `vibeswitch._testCheckpointRestore`
- `vibeswitch._testGetDebugSnapshot`

Most are gated by `VIBESWITCH_INTEGRATION_TEST=1`.

## 12. Configuration surface reconciliation (41 keys)

Status legend:

- **Active**: read and used in runtime behavior
- **Declared-only**: present in manifest but not read by runtime code
- **Partial**: partly wired

## 12.1 Core/UI/logging/mode keys

| Key | Status | Runtime use |
|---|---|---|
| `vibeswitch.showInStatusBar` | Active | Awareness status bar visibility |
| `vibeswitch.awarenessHighScoreFrameFlash` | Active | Enables high-score flash |
| `vibeswitch.awarenessHighScoreFrameFlashThreshold` | Active | Flash threshold |
| `vibeswitch.awarenessHighScoreFrameFlashDurationMs` | Active | Flash duration |
| `vibeswitch.awarenessHighScoreFrameFlashColor` | Active | Flash color |
| `vibeswitch.disableLogging` | Active | Logging suppression policy |
| `vibeswitch.debugLogging` | Active | Verbose debug logging policy |
| `vibeswitch.rulesPath` | Declared-only | No runtime read path |
| `vibeswitch.autoReload` | Declared-only | No runtime read path |
| `vibeswitch.skipCursorSettings` | Declared-only | Manifest key not read (adapter arg exists but not config-bound) |
| `vibeswitch.enableTelemetry` | Active | Gates usage stats tracking |
| `vibeswitch.autoRevertUnapprovedEdits` | Active | Controls alert detector auto-revert |
| `vibeswitch.recordTraceToFile` | Active | Enables trace recording |
| `vibeswitch.recordTracePath` | Active | Trace file path override |

## 12.2 LLM insight keys

All LLM keys below are actively read by `VSCodeLLMConfigAdapter` and used in compose/service flow:

- `vibeswitch.llm.enabled`
- `vibeswitch.llm.provider`
- `vibeswitch.llm.timeoutMs`
- `vibeswitch.llm.triggerOnAI`
- `vibeswitch.llm.triggerOnLargeBatches`
- `vibeswitch.llm.largeBatchThreshold`
- `vibeswitch.llm.sendDiffBullets`
- `vibeswitch.llm.maxDiffBullets`
- `vibeswitch.llm.sendSnippets`
- `vibeswitch.llm.snippetCharLimit`
- `vibeswitch.llm.maxPerMinute`
- `vibeswitch.llm.maxPerDay`
- `vibeswitch.llm.cacheTtlMs`
- `vibeswitch.llm.openai.apiKey`
- `vibeswitch.llm.openai.model`

## 12.3 Dashboard chat keys

All dashboard chat keys are active:

- `vibeswitch.dashboardChat.enabled`
- `vibeswitch.dashboardChat.useWorkspaceContext`
- `vibeswitch.dashboardChat.timeoutMs`
- `vibeswitch.dashboardChat.includeKeyFiles`
- `vibeswitch.dashboardChat.openai.apiKey`
- `vibeswitch.dashboardChat.openai.model`

## 12.4 Agents keys

| Key | Status | Runtime use |
|---|---|---|
| `vibeswitch.agents.enabled` | Active | Toggles agents integration init attempt |
| `vibeswitch.agents.gatewayUrl` | Active | Gateway URL for integration |
| `vibeswitch.agents.authToken` | Active | Token read callback |
| `vibeswitch.agents.triggerOnSave` | Active | Save-trigger toggle |
| `vibeswitch.agents.triggerOnCommit` | Declared-only | Not read in current implementation |
| `vibeswitch.agents.triggerOnPush` | Declared-only | Not read in current implementation |

## 13. Implementation caveats (code-observed)

1. **File decoration feature is effectively disabled** in helper initialization, while diagnostics commands still exist.
2. **`showInStatusBar` does not hide mode indicator**, only awareness indicator.
3. **Frame flash behavior differs from config description**: implemented as editor/status-bar pulse, not window border config writes.
4. **Agents feature is partially wired** due missing required modules in `business_modules/agents`.
5. **`rulesPath`, `autoReload`, `skipCursorSettings` are declared but not runtime-configurable paths/flags.**
6. **`agents.triggerOnCommit` and `agents.triggerOnPush` are declared but unused.**
7. **Cursor usage token path likely mismatched**: code uses `context.secretStorage` while keypair uses `context.secrets` (VS Code standard).
8. **Hardcoded localhost debug POST calls** (`http://localhost:7242/ingest/...`) exist in activation/setup/settings paths; failures are swallowed.

## 14. External network interactions

Observed outbound endpoints:

- OpenAI Chat Completions (`https://api.openai.com/v1/chat/completions`) for LLM insight and dashboard chat (when enabled/configured)
- Cursor usage API (`https://www.cursor.com/api/dashboard/get-filtered-usage-events`) for token usage display
- Local debug telemetry endpoint (`http://localhost:7242/ingest/...`) from several setup/activation code paths

## 15. Non-functional characteristics

- Heavy use of asynchronous and best-effort failure isolation in optional modules
- Throttled logging with per-source and message-level controls
- Atomic file writes in core enforcement/mode operations
- Bounded caches (change ledger, classifier batching, dependency analyzer caches, rate limiter, LLM cache TTL)

---

This specification captures implemented behavior at repository state date `2026-02-12` on branch `cursor/vibeswitch-extension-spec-15a9`.
