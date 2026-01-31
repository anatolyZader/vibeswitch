# DEV Mode Safety Mechanisms Review

## Executive Summary

The VibeSwitch extension implements a **defense-in-depth** approach to make DEV mode as safe as possible when working with AI agents. This document reviews all implemented mechanisms, their effectiveness, and limitations.

---

## 1. File Edit Protection (Auto-Revert System)

### Implementation
- **Component**: `AlertFileEditDetector` (`business_modules/mode-enforcement/app/alertFileEditDetector.js`)
- **Hook**: `afterFileEdit` → `detect-edit.sh`

### How It Works
```
Agent uses Write/StrReplace/Edit
       ↓
afterFileEdit hook fires
       ↓
detect-edit.sh writes to ~/.vibeswitch/state/alert.json
       ↓
Extension detects via chokidar (optimized, ~50ms latency)
       ↓
If DEV mode + file is git-tracked:
  → git checkout -- <file>  (AUTO-REVERT)
  → Multi-channel visual feedback
       ↓
Edit is "quasi-blocked" - file returns to committed state
```

### Visual Feedback (Multi-Channel)
| Channel | Description | Duration |
|---------|-------------|----------|
| Status bar | Red flash "🛡️ BLOCKED" | 3 seconds |
| Notification | Progress popup with message | 4 seconds |
| File opens | Affected file opens in editor | Immediate |
| Decoration | Yellow highlight on first line | 3 seconds |
| Console | Log message | Permanent |

### Effectiveness
| Scenario | Protection Level |
|----------|------------------|
| Edit to git-tracked file | ✅ **STRONG** - Auto-reverted |
| Edit to new/untracked file | ⚠️ **MEDIUM** - Modal warning, manual action needed |
| Edit to file outside git repo | ⚠️ **MEDIUM** - Modal warning only |

### Configuration
```json
{
  "vibeswitch.autoRevertUnapprovedEdits": true  // default
}
```

---

## 2. Shell Command Protection

### Implementation
- **Hook**: `beforeShellExecution` → `gate-shell.sh`
- **Location**: `~/.vibeswitch/hooks/gate-shell.sh`

### How It Works
```bash
# Allowlist-based filtering
ALLOWED_PREFIXES=(
  "git status" "git diff" "git log" "git branch"
  "npm test" "npm run" "npx jest"
  "ls" "cat" "head" "tail" "grep" "rg" "find"
  "node --version" "npm --version"
)

# Blocked metacharacters (prevent chaining/escapes)
DANGEROUS_CHARS='[;&|`$(){}]|\|\||&&|>\s*>|<\s*<'
```

### Effectiveness
| Command Type | Result |
|--------------|--------|
| `git status` | ✅ Allowed |
| `git diff` | ✅ Allowed |
| `npm test` | ✅ Allowed |
| `git add` | ❌ **BLOCKED** |
| `git commit` | ❌ **BLOCKED** |
| `rm -rf` | ❌ **BLOCKED** |
| `npm install` | ❌ **BLOCKED** |
| `cmd1 && cmd2` | ❌ **BLOCKED** (metachar) |
| `$(subshell)` | ❌ **BLOCKED** (metachar) |

### Protection Level: ✅ **STRONG** (Hard enforcement via exit code 2)

---

## 3. MCP Tool Gating

### Implementation
- **Hook**: `beforeMCPExecution` → `gate-mcp.sh`
- **Location**: `~/.vibeswitch/hooks/gate-mcp.sh`

### How It Works
In DEV mode, ALL MCP tools are blocked **except** those from the VibeSwitch server:
- `mcp__vibeswitch__submit_patch` - Submit patch for approval
- `mcp__vibeswitch__apply_patch` - Apply approved patch with token

### MCP Server Identity Verification
```bash
# Read expected identity from secure location
EXPECTED_FILE="$HOME/.vibeswitch/state/mcp-server.json"

# Verify server name/path/id matches expected
# If mismatch → DENY (prevents MCP spoofing)
```

### Protection Level: ✅ **STRONG** (Hard enforcement)

---

## 4. Prompt Context Injection

### Implementation
- **Hook**: `beforeSubmitPrompt` → `inject-context.sh`
- **Location**: `~/.vibeswitch/hooks/inject-context.sh`

### How It Works
Injects mode-aware context into every prompt:
```
DEV MODE: You are in collaborative mode. 
Ask for approval before making changes.
Use mcp__vibeswitch__submit_patch for file edits.
```

### Protection Level: ⚠️ **SOFT** (Advisory, agent can ignore)

---

## 5. Rules File (Agent Instructions)

### Implementation
- **File**: `.cursor/rules.dev.md` (copied to `.cursor/rules.md` when DEV active)

### Key Content
```
╔══════════════════════════════════════════════════════════════════╗
║   🚨🚨🚨 STOP - READ THIS BEFORE ANY FILE MODIFICATION 🚨🚨🚨   ║
║                                                                  ║
║   YOU ARE FORBIDDEN FROM USING THESE TOOLS:                      ║
║     ❌ Write, StrReplace, Edit, EditNotebook, Delete             ║
║                                                                  ║
║   If you use ANY of these tools:                                 ║
║     1. DETECTED by the system                                    ║
║     2. LOGGED to audit trail                                     ║
║     3. ALERTED to user                                           ║
║     4. AUTO-REVERTED                                             ║
╚══════════════════════════════════════════════════════════════════╝
```

### Protection Level: ⚠️ **SOFT** (Advisory, but reinforced by hard mechanisms)

---

## 6. Hooks Configuration Guard

### Implementation
- **Component**: `HooksJsonGuard` (`business_modules/mode-enforcement/app/hooksJsonGuard.js`)

### How It Works
```
Watches .cursor/hooks.json for tampering
       ↓
If modified (agent tries to disable hooks):
  → Auto-restore from backup
  → Force switch to DEV mode
  → Log to audit trail
  → Show alert
```

### Protection Level: ✅ **STRONG** (Prevents hook bypass)

---

## 7. Secure State Storage

### Implementation
All critical state stored **outside workspace** (agent cannot access):

| Data | Location | Purpose |
|------|----------|---------|
| Mode | `context.globalState` | Source of truth |
| Mode mirror | `~/.vibeswitch/state/mode.json` | For hooks to read |
| Private key | `context.secrets` | Token signing |
| Public key | `~/.vibeswitch/mcp/publicKey.pem` | Token verification |
| Hook scripts | `~/.vibeswitch/hooks/` | Tamper-resistant |
| Audit log | `~/.vibeswitch/state/audit.log` | Immutable record |
| Alerts | `~/.vibeswitch/state/alert.json` | Edit detection |

### Protection Level: ✅ **STRONG** (Out of agent's reach)

---

## 8. Cryptographic Approval Tokens

### Implementation
- **Component**: `KeypairManager`, `ApprovalManager`
- **Algorithm**: Ed25519 asymmetric signatures

### Token Structure
```json
{
  "requestId": "uuid",
  "nonce": "random",
  "iat": 1234567890,
  "exp": 1234567950,
  "scope": {
    "filePath": "path/to/file",
    "patchHash": "sha256-of-patch"
  },
  "sig": "ed25519-signature"
}
```

### Properties
- **Single-use**: Each token can only be used once
- **Time-limited**: Expires after 60 seconds
- **Scope-bound**: Only valid for specific file + patch
- **Unforgeable**: Requires private key (in `context.secrets`)

### Protection Level: ✅ **STRONG** (Cryptographic guarantee)

---

## 9. Audit Trail

### Implementation
- **File**: `~/.vibeswitch/state/audit.log`
- **Format**: NDJSON (newline-delimited JSON)

### Logged Events
```json
{"ts":"2026-01-25T17:07:51+00:00","action":"UNAPPROVED_EDIT","file":"/path/to/file.js"}
{"ts":"2026-01-25T17:08:12+00:00","action":"SHELL_BLOCKED","command":"git add -A"}
{"ts":"2026-01-25T17:08:30+00:00","action":"MCP_BLOCKED","tool":"other_mcp_tool"}
```

### Protection Level: ✅ **STRONG** (Append-only, outside workspace)

---

## Summary: Protection Matrix

| Threat | Mechanism | Protection |
|--------|-----------|------------|
| Agent edits file directly | Auto-revert + Alert | ✅ STRONG |
| Agent runs dangerous shell cmd | Shell allowlist | ✅ STRONG |
| Agent uses other MCP tools | MCP gating | ✅ STRONG |
| Agent modifies hooks.json | HooksJsonGuard | ✅ STRONG |
| Agent forges approval token | Ed25519 crypto | ✅ STRONG |
| Agent ignores rules.md | Backed by hard mechanisms | ✅ STRONG |
| Agent edits new file (untracked) | Modal warning | ⚠️ MEDIUM |
| Agent convinces user to approve | User judgment | ⚠️ SOFT |

---

## Limitations (Honest Assessment)

### What We CANNOT Block
1. **New file creation** - Can only warn, not auto-revert (no git history)
2. **User approval bypass** - If user clicks "approve", the edit goes through
3. **Non-git workspaces** - Auto-revert requires git

### What We CAN Guarantee
1. **Every file edit is detected** and logged
2. **Git-tracked files are auto-reverted** immediately
3. **Shell commands are hard-blocked** unless allowlisted
4. **MCP tools are hard-blocked** unless from VibeSwitch
5. **Hooks cannot be disabled** by the agent
6. **All violations are audited** for review

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CURSOR AGENT                                │
└─────────────────────────────────────────────────────────────────────┘
                │                    │                    │
                ▼                    ▼                    ▼
        ┌───────────┐        ┌───────────┐        ┌───────────┐
        │   Shell   │        │   File    │        │    MCP    │
        │  Command  │        │   Edit    │        │   Tool    │
        └─────┬─────┘        └─────┬─────┘        └─────┬─────┘
              │                    │                    │
              ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      CURSOR HOOKS LAYER                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │gate-shell.sh │  │detect-edit.sh│  │ gate-mcp.sh  │              │
│  │  ALLOWLIST   │  │   DETECT     │  │  DENYLIST    │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                 │                 │                       │
│    BLOCK/ALLOW       ALERT.JSON        BLOCK/ALLOW                 │
└─────────┼─────────────────┼─────────────────┼───────────────────────┘
          │                 │                 │
          │                 ▼                 │
          │    ┌────────────────────────┐     │
          │    │   VIBESWITCH EXTENSION │     │
          │    │  ┌──────────────────┐  │     │
          │    │  │AlertFileDetector │  │     │
          │    │  │   AUTO-REVERT    │  │     │
          │    │  │   git checkout   │  │     │
          │    │  └──────────────────┘  │     │
          │    │  ┌──────────────────┐  │     │
          │    │  │  HooksJsonGuard  │  │     │
          │    │  │  PROTECT CONFIG  │  │     │
          │    │  └──────────────────┘  │     │
          │    └────────────────────────┘     │
          │                                   │
          ▼                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   SECURE STATE (~/.vibeswitch/)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │ mode.json   │  │ audit.log   │  │ hooks/*.sh  │                 │
│  │ (read-only) │  │ (append)    │  │ (execute)   │                 │
│  └─────────────┘  └─────────────┘  └─────────────┘                 │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Conclusion

The VibeSwitch DEV mode implements **production-grade mode enforcement** through multiple layers:

1. **Hard enforcement** for shell commands and MCP tools (exit code 2 blocking)
2. **Quasi-blocking** for file edits (immediate auto-revert)
3. **Tamper resistance** for hooks configuration
4. **Cryptographic security** for approval tokens
5. **Complete auditability** for all agent actions

The system follows a **fail-closed** design philosophy: when in doubt, deny. This provides strong protection while maintaining usability through clear visual feedback and configurable options.
