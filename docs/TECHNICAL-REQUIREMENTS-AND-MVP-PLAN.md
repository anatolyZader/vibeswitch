# VibeSwitch Extension — Technical Requirements & MVP Plan

**Date:** January 29, 2026  
**Purpose:** Technical requirements and plan to complete MVP.

---

## 1. Product Overview

### 1.1 What VibeSwitch Is

VibeSwitch is a **VS Code / Cursor extension** that lets you switch between two AI collaboration modes:

| Mode | Intent | File edits | Shell | MCP |
|------|--------|------------|-------|-----|
| **VIBE** | Fast, autonomous | Allowed (built-in + MCP) | All except catastrophic | All tools |
| **DEV** | Slow, aware | Built-in blocked (auto-revert); MCP via approval token | Allowlist only | Only vibeswitch MCP |

- **Awareness engine**: Tracks AI suggestions, review behavior, debt; computes a 0–100 awareness score.
- **Usage stats**: Local-only telemetry (file opens, edits, saves, AI suggestions, outcomes).
- **Capability enforcement**: Mode is the source of truth; Cursor hooks + MCP server enforce edits/shell/MCP by mode.

### 1.2 Target Users

- Developers using Cursor who want a clear “fast vs careful” switch.
- Teams that want DEV mode (approval workflow, restricted shell/MCP) without giving up VIBE for routine work.

### 1.3 Non-Goals for MVP

- No cloud/remote sync of stats or mode.
- No mandatory LLM-based insights (optional, off by default).
- No mandatory multi-agent (QA/Security/Architecture) integration (optional, off by default).
- No TypeScript; extension remains JavaScript.

---

## 2. Current State Analysis

### 2.1 Implemented and Working

| Area | Status | Notes |
|------|--------|------|
| **Extension entry** | Done | `extension.js` activates on `onStartupFinished`, composes DI, registers commands. |
| **Mode management** | Done | `ModeManager`: globalState + `~/.vibeswitch/state/mode.json`; `.cursor/rules.md` (or rules.dev.md / rules.vibe.md) for Cursor context. |
| **Commands** | Done | Switch mode, to VIBE/DEV, show stats, reset/export stats, show logs, status bar, diagnose monitor/decorations, unreviewed files, capability self-test, alert log. |
| **Status bar** | Done | Mode indicator (clickable), awareness meter; configurable visibility. |
| **Awareness engine** | Done | Classification (AI/user/formatter), scoring, debt, sessions, suggestion lifecycle; callbacks for usage stats. |
| **Usage stats** | Done | File open/edit/save, AI suggestion/outcome/keep-all/debt-cleared; export JSON; 100% local. |
| **Capability – core** | Done | ModeManager, WorkspaceAllowlist, CapabilitySelfTest, HooksJsonGuard, AlertFileEditDetector, KeypairManager, ApprovalManager. |
| **MCP server** | Done | `submit_patch` / `apply_patch`; token verify (Ed25519); path safety; mode read from `mode.json`; consumed tokens. |
| **Keypair & approval** | Done | Ed25519 keypair in context.secrets; approval UI; token generation with canonical payload + signature. |
| **Config** | Done | `vibeswitch.*` settings: status bar, logging, rules path, telemetry, auto-revert, LLM, agents. |
| **Tests** | Partial | Awareness (scoring, lifecycle, adapters), mode-enforcement (mode, allowlist, hooks guard, keypair, alert detector, self-test), MCP path safety; extension smoke. |

### 2.2 Gaps and Dependencies

| Gap | Severity | Detail |
|-----|----------|--------|
| **Hook scripts not in repo** | High | `gate-shell.sh`, `gate-mcp.sh`, `inject-context.sh`, `detect-edit.sh` must exist under `~/.vibeswitch/hooks/` and be executable. CapabilitySelfTest fails if missing. Repo has **no** `.sh` files; scripts are referenced in docs/plans only. |
| **Hook script installation** | High | No post-install or first-run step copies/creates scripts in `~/.vibeswitch/hooks/`. Users must create or install them elsewhere. |
| **MCP server packaging** | Medium | MCP server lives in `mcp/mode-enforcement/` with its own `package.json`. Not clear if it’s packaged with extension or run separately; Cursor MCP config (e.g. `mcp-server.json` in `~/.vibeswitch/state/`) must point to it. |
| **`canonical.js` for MCP** | Medium | MCP server `require()`s `~/.vibeswitch/lib/canonical.js`. That file is not in the repo (keypair/token canonicalization). Must be shipped or generated (e.g. from extension). |
| **File coloring** | Low | Disabled in `initializeHelpers.js` (noise/load). Optional for MVP. |
| **Auto-revert default** | Low | `package.json` has `autoRevertUnapprovedEdits: false`; docs say “default true”. Align default and docs for MVP. |
| **Publisher/identity** | Low | `package.json` uses `your-publisher-name`; tests reference it. Set real publisher for release. |

### 2.3 External Assumptions

- **Cursor** provides:
  - `.cursor/hooks.json` (beforeSubmitPrompt, beforeShellExecution, beforeMCPExecution, afterFileEdit).
  - Hooks invoke scripts under `~/.vibeswitch/hooks/` (or equivalent path).
- **User environment**: `jq` installed (self-test and hook scripts depend on it).
- **Workspace**: For DEV mode file revert, workspace is a git repo and edited files are git-tracked (otherwise only modal warning).

---

## 3. MVP Scope Definition

MVP = “A user can install the extension, switch between VIBE and DEV, and in DEV mode have edits and shell/MCP enforced as designed, with awareness and stats working.”

### 3.1 In Scope for MVP

1. **Install & first run**
   - Install VS Code/Cursor extension.
   - On first run: create `~/.vibeswitch/state` and `~/.vibeswitch/hooks` (and optionally `~/.vibeswitch/mcp`, `~/.vibeswitch/lib`) as needed.
   - **Ship or generate** hook scripts and `canonical.js` so CapabilitySelfTest passes after install (or after a one-time “Setup VibeSwitch” action).

2. **Mode switch**
   - User can switch mode via command palette / status bar / keybinding.
   - Mode is persisted (globalState + `mode.json`); `.cursor/rules.md` (or rules.dev/vibe) updated so Cursor sees the chosen mode.

3. **DEV mode enforcement**
   - **Hooks**: Cursor runs scripts from `~/.vibeswitch/hooks/` (inject-context, gate-shell, gate-mcp, detect-edit). Extension ensures `hooks.json` points to these and restores it if tampered.
   - **File edits**: Built-in edits in DEV → detect-edit writes alert → extension (optional) auto-reverts git-tracked files if `autoRevertUnapprovedEdits` is true. MCP edits only via submit_patch → approve → apply_patch with token.
   - **Shell/MCP**: gate-shell and gate-mcp enforce allowlist and MCP server identity.

4. **MCP server**
   - MCP server runnable (e.g. `node path/to/mcp-server/index.js` or `vibeswitch-mcp`) and registerable in Cursor. Extension or install flow documents or writes `mcp-server.json` (or equivalent) so Cursor can start it.
   - `canonical.js` available at `~/.vibeswitch/lib/canonical.js` for token verification.

5. **Awareness & stats**
   - Awareness score and meter work; usage stats collect and export; no regression in existing behavior.

6. **Docs**
   - README: what VibeSwitch is, how to install, how to run MCP server and hook scripts (or that they’re installed by extension), how to switch mode, and link to DEV vs VIBE restrictions.

### 3.2 Out of Scope for MVP

- LLM insights (optional feature; keep off by default).
- Multi-agent (QA/Security/Architecture) integration (optional; keep off by default).
- File decoration / “file coloring” (can stay disabled).
- Slash commands (already documented; no code change required for MVP).
- New awareness algorithms or new mode-enforcement checks beyond what’s already implemented.

---

## 4. Plan to Finish MVP

### 4.1 Phase 1: Hook scripts and canonical lib (critical path)

| Task | Owner | Notes |
|------|--------|--------|
| **1.1** Add hook scripts to repo | Dev | Create `scripts/hooks/` (or `assets/hooks/`) with `inject-context.sh`, `gate-shell.sh`, `gate-mcp.sh`, `detect-edit.sh`. Implement behavior per `docs/2026-01-26_15-30-dev-vs-vibe-mode-restrictions.md` and `.cursor/plans/mode_behavior_options_dc780365.plan.md` (allowlist, blocklist, mode read from `mode.json`, alert write for detect-edit). |
| **1.2** Add `canonical.js` to repo | Dev | Implement canonical JSON serialization (RFC 8785–style) used by KeypairManager and MCP server; place in e.g. `business_modules/mode-enforcement/app/` or shared `lib/`; MCP server and extension both use it. |
| **1.3** First-run / post-install setup | Dev | On activation (or dedicated command “VibeSwitch: Setup capability scripts”): if `~/.vibeswitch/hooks/` is missing or scripts missing, copy from extension install path to `~/.vibeswitch/hooks/` and chmod +x. Same for `~/.vibeswitch/lib/canonical.js` if MCP expects it there. Ensure CapabilitySelfTest checks pass after setup. |
| **1.4** MCP server use of canonical | Dev | MCP server: either bundle `canonical.js` in its own tree and require it from there, or document that `~/.vibeswitch/lib/canonical.js` is written by extension on setup so MCP can require it. Prefer single source (repo) and copy to `~/.vibeswitch/lib` for MCP. |

### 4.2 Phase 2: MCP packaging and Cursor config

| Task | Owner | Notes |
|------|--------|--------|
| **2.1** Document or automate MCP registration | Dev | Document in README: add MCP server to Cursor (e.g. path to `node .../mcp/mode-enforcement/index.js` or `npx`/binary). Optionally: command “VibeSwitch: Register MCP server” that writes Cursor’s MCP config (path/args) for vibeswitch. |
| **2.2** Package MCP with extension | Dev | Ensure `mcp/mode-enforcement` is included in extension package and that its dependency `@modelcontextprotocol/sdk` is installed (e.g. bundle in extension node_modules or document `npm install` in mcp-server dir). |
| **2.3** Workspace allowlist sync | Done | Extension already syncs workspace folders to `~/.vibeswitch/state/workspaces.json`; MCP server reads it. Verify on first workspace open. |

### 4.3 Phase 3: Config and docs alignment

| Task | Owner | Notes |
|------|--------|--------|
| **3.1** Auto-revert default and docs | Dev | Decide MVP default for `autoRevertUnapprovedEdits` (e.g. `false` to avoid surprise reverts; document clearly). Update `docs/2026-01-26_15-30-dev-vs-vibe-mode-restrictions.md` to match. |
| **3.2** README | Dev | Add/update: what VibeSwitch is, install steps, first-run/setup (hooks + lib), how to add MCP server in Cursor, how to switch mode, link to DEV vs VIBE doc. |
| **3.3** Publisher/identity | Dev | Replace `your-publisher-name` in package.json and tests when publishing; optional for “local” MVP. |

### 4.4 Phase 4: Testing and release

| Task | Owner | Notes |
|------|--------|--------|
| **4.1** Test hook scripts | Dev | Manual or script: run each hook with sample inputs (mode.json, shell command, MCP payload, file edit); assert allow/deny and alert write. |
| **4.2** End-to-end DEV flow | Dev | In Cursor: switch to DEV, trigger built-in edit → expect alert and optional revert; submit_patch → approve → apply_patch with token → success. |
| **4.3** Self-test green after setup | Dev | After “Setup capability scripts”, CapabilitySelfTest passes (hooks exist + executable, jq present, config files/dirs created as needed). |
| **4.4** Package and smoke-test | Dev | `vsce package`; install .vsix in Cursor; run through MVP flows. |

### 4.5 Dependency Order

```
1.1 (hook scripts) ──┬── 1.3 (first-run setup)
1.2 (canonical.js) ──┘         │
         │                     │
         └── 1.4 (MCP canonical) ── 2.1, 2.2 (MCP packaging/registration)
                                          │
3.1, 3.2, 3.3 (config + README) ──────────┴── 4.x (testing & release)
```

### 4.6 Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Cursor hook contract changes | Pin expected hook names and payloads; document; add minimal compatibility layer if needed. |
| Hook scripts fail in some envs | CapabilitySelfTest already checks jq and executables; document OS/Shell (e.g. bash). |
| Users skip setup | Show one-time info message or “Setup VibeSwitch” prompt if self-test fails; README clear. |
| MCP server path differs per install | Use relative path from extension install location when writing Cursor MCP config. |

### 4.7 Rough Effort (MVP only)

- Phase 1: 2–4 days (scripts + canonical + first-run).
- Phase 2: 0.5–1 day (packaging + README for MCP).
- Phase 3: 0.5 day (config/docs).
- Phase 4: 1–2 days (testing, packaging, smoke).

**Total: ~4–8 days** for one developer, depending on existing hook script specs and Cursor MCP config format.

---

## 5. Success Criteria for MVP

- [ ] User installs extension; runs once (or “Setup” command); CapabilitySelfTest passes.
- [ ] User can switch to VIBE and DEV via command/status bar; mode persists and is visible in status bar.
- [ ] In DEV: built-in file edit triggers alert (and optional auto-revert if enabled); MCP edit works only via submit → approve → apply with token.
- [ ] In DEV: shell and MCP hooks enforce allowlist and vibeswitch-only MCP (when hooks are enabled by Cursor).
- [ ] Awareness meter and usage stats work; export stats works.
- [ ] README explains install, setup, mode switch, and DEV vs VIBE behavior.

---

## 5.1 Post-MVP (documented follow-ups)

Intentional follow-ups to be implemented after MVP release:

1. **Electron score deltas:** Add 1–2 more assertions in extension-host tests (e.g. “after checkpoint restore → score recovers”) to lock the full behavioral loop.
2. **Trace replay semantics:** Allow `.trace.json` files to optionally include `expected.finalScore` or `expected.trend`; replay tests treat them like lightweight golden scenarios (not just safety: score in [0,100], no NaN).
3. **Explainability:** ScoreBreakdown / explanation snapshots so users can see “why did the meter move?”—UI/UX and trust, not correctness; safe to defer.
4. **Terminal blocks in scoring:** Wire terminal-block count into real awareness scoring only when you decide the product behavior: penalize attempts (discourages risky behavior) or only warn (avoids punishing “trying things”). Either is defensible; keep it explicit. Then optionally add an electron assertion on score delta. Today the adapter exposes `counters.terminalAttemptsBlocked` and `flags.terminalBlocked`; scoring semantics stay in golden/property tests.
5. **Terminal-block flags (UI):** Consider splitting `flags.terminalBlocked` into `flags.recentTerminalBlocked` (within last N minutes / since last tick) and `flags.terminalBlockedEver` (lifetime/session) so one early block does not make the UI “sticky red” forever.

---

## 6. References

- `docs/2026-01-26_15-30-dev-vs-vibe-mode-restrictions.md` — DEV vs VIBE matrix and enforcement.
- `docs/2026-01-25_17-20-dev-mode-safety-mechanisms-review.md` — Safety mechanisms.
- `.cursor/plans/mode_behavior_options_dc780365.plan.md` — Hook script behavior and config.
- `package.json` — Commands, config, activation.
- `extension.js` — Activation and composition.
- `business_modules/mode-enforcement/app/capabilitySelfTest.js` — Required hooks and config.
- `mcp/mode-enforcement/index.js` — MCP tools and token/path checks.
