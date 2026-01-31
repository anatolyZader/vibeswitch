---
name: Mode Behavior Options
overview: Production-grade capability enforcement (v6). Fail-closed everywhere. set -euo pipefail. Real newline detection. jq required.
todos:
  - id: phase0-probe
    content: "PHASE 0: Hook probe - capture exact JSON (including server identity fields), verify field names, then DELETE"
    status: pending
  - id: phase1-dirs
    content: "PHASE 1: Create $HOME/.vibeswitch/{state,mcp,hooks,lib}/"
    status: pending
  - id: phase1-install-hooks
    content: "PHASE 1: Install gate scripts to $HOME/.vibeswitch/hooks/"
    status: pending
  - id: phase1-mcp-identity
    content: "PHASE 1: Write expected MCP server identity to $HOME/.vibeswitch/state/mcp-server.json"
    status: pending
  - id: phase1-hooks-json-watch
    content: "PHASE 1: Watch .cursor/hooks.json - atomic restore + debounce + flip DEV + audit (sha256 hash)"
    status: pending
  - id: phase1-capability-selftest
    content: "PHASE 1: Capability self-test on activation + periodic"
    status: pending
  - id: phase1-mode
    content: "PHASE 1: ModeManager - source in context.globalState, mirror to $HOME"
    status: pending
  - id: phase1-workspaces
    content: "PHASE 1: Write allowed workspaces to $HOME/.vibeswitch/state/workspaces.json"
    status: pending
  - id: phase1-detect
    content: "PHASE 1: afterFileEdit detection → modal + badge"
    status: pending
  - id: phase2-shared-canonical
    content: "PHASE 2: Shared canonical JSON module (all-strings payload invariant)"
    status: pending
  - id: phase2-keypair
    content: "PHASE 2: Ed25519 keypair"
    status: pending
  - id: phase2-request-flow
    content: "PHASE 2: MCP writes requests, extension watches with chokidar"
    status: pending
  - id: phase2-mcp
    content: "PHASE 2: MCP server - validates workspace allowlist, token in call only"
    status: pending
  - id: phase2-consumed
    content: "PHASE 2: SQLite consumed tracking"
    status: pending
  - id: phase3-audit
    content: "PHASE 3: Audit log, polish"
    status: pending
isProject: false
---

# Production-Grade Capability Enforcement for VibeSwitch

## Final Hardening (v6)

| Issue | Fix |
|-------|-----|
| Hook scripts in workspace | Scripts in `$HOME/.vibeswitch/hooks/` |
| `.cursor/hooks.json` tampering | Watch + atomic restore + debounce + flip DEV + audit (sha256) |
| Agent passes bad `workspaceRoot` | Server-side allowlist (exact match, realpath both sides) |
| MCP tool name spoofing | Gate on server identity, fail-closed (no fallback) |
| Shell metacharacter bypass | Block `$(`, backticks, `; & | < >`, but allow plain `$` |
| Missing command field | Fail-closed with explicit deny |
| Canonical JSON drift | Shared module, **all-strings payload invariant** |
| `fs.watch` unreliable | Use `chokidar` / `vscode.workspace.createFileSystemWatcher` |
| Token channel confusion | MCP only accepts token in call, ignores workspace `token.json` |
| **Newline detection** | Use `$'\n'` not `\\n` (actual newline check) |
| **Silent failures** | `set -euo pipefail` + safe IFS in all hooks |
| **Missing jq** | Fail-closed if jq not installed |
| **Empty MCP identity** | Deny with clear message if mcp-server.json incomplete |

### Policy Choices

- **Metachar defense in VIBE**: Enabled (safer). Pipes/redirects/chaining blocked in both modes.
- **Workspace allowlist**: Exact match only (`resolved === w`). No prefix matching.
- **Plain `$` allowed**: Env vars like `echo $PWD` work. Command substitution `$()` blocked.
- **Fail-closed on missing deps**: jq required, explicit deny if absent.

---

## Storage Layout

```
$HOME/.vibeswitch/
├── hooks/                     # GATE SCRIPTS (agent CANNOT edit)
│   ├── gate-shell.sh
│   ├── gate-mcp.sh
│   ├── inject-context.sh
│   └── detect-edit.sh
├── state/
│   ├── mode.json              # Mode mirror
│   ├── workspaces.json        # ALLOWED workspace roots (extension writes, realpath'd)
│   ├── mcp-server.json        # EXPECTED MCP server identity (extension writes)
│   ├── requests/              # Pending (MCP writes)
│   ├── approved/              # Tokens (extension writes)
│   ├── audit.log
│   └── alert.json
├── mcp/
│   ├── publicKey.pem
│   └── consumed.db
└── lib/
    └── canonical.js           # SHARED canonical JSON (all-strings invariant)

Extension Storage:
├── context.globalState['vibeswitch.mode']
├── context.secrets['vibeswitch.privateKey']
└── context.storageUri/

Workspace:
└── .cursor/hooks.json         # WATCHED + ATOMIC RESTORE on tamper
└── .vibeswitch/token.json     # Convenience only (MCP ignores, best-effort write)
```

---

## Security Guarantees

### HARD (Enforced)

| Capability | Method | DEV Mode | VIBE Mode |
|------------|--------|----------|-----------|
| Shell | `beforeShellExecution` + metachar defense | Blocklist-first allowlist | Allow (except catastrophic + metachars) |
| All MCP | `beforeMCPExecution` + server identity (fail-closed) | DENY except verified vibeswitch server | Allow |
| MCP writes | `apply_patch` + Ed25519 + workspace allowlist | Require valid token (in call) | Auto-approve |
| hooks.json | Extension watches + atomic restore + debounce | Auto-restore + flip DEV | Auto-restore |

### DETECT ONLY

| Capability | Method | Action |
|------------|--------|--------|
| Built-in editor | `afterFileEdit` | Modal + badge + git diff |

---

## PHASE 0: Hook Probe

Capture **full JSON payloads** to verify field names, especially:

- Shell command field: `command`? `cmd`?
- MCP tool field: `tool_name`? `toolName`?
- **MCP server identity**: `serverName`? `serverId`? `serverPath`? `transport`?

### Probe Script

```bash
#!/bin/bash
set -euo pipefail
IFS=$'\n\t'

# $HOME/.vibeswitch/hooks/probe.sh - TEMPORARY
HOOK="$1"
LOG="$HOME/.vibeswitch/state/probe.log"
mkdir -p "$(dirname "$LOG")"

INPUT=$(cat)
{
  echo "=== $HOOK $(date -Iseconds) ==="
  if command -v jq >/dev/null 2>&1; then
    echo "$INPUT" | jq '.' 2>/dev/null || echo "$INPUT"
  else
    echo "$INPUT"
  fi
  echo ""
} >> "$LOG"

case "$HOOK" in
  beforeShellExecution|beforeMCPExecution) echo '{"permission":"allow"}' ;;
  beforeSubmitPrompt) echo '{"continue":true}' ;;
  *) echo '{}' ;;
esac
exit 0
```

**After probe:** Document exact field names, then DELETE probe.sh.

---

## PHASE 1: Production Hooks

### `.cursor/hooks.json` (Extension manages + watches)

```json
{
  "version": 1,
  "hooks": {
    "beforeSubmitPrompt": [
      {"command": "/home/USER/.vibeswitch/hooks/inject-context.sh", "timeout": 3}
    ],
    "beforeShellExecution": [
      {"command": "/home/USER/.vibeswitch/hooks/gate-shell.sh", "timeout": 5}
    ],
    "beforeMCPExecution": [
      {"command": "/home/USER/.vibeswitch/hooks/gate-mcp.sh", "timeout": 5}
    ],
    "afterFileEdit": [
      {"command": "/home/USER/.vibeswitch/hooks/detect-edit.sh", "timeout": 3}
    ]
  }
}
```

**Note:** Extension generates this with actual `$HOME` expanded. Extension WATCHES this file and restores atomically on any change.

---

### `$HOME/.vibeswitch/hooks/gate-shell.sh` (fail-closed + metachar defense)

```bash
#!/bin/bash
set -euo pipefail
IFS=$'\n\t'

deny() { echo "$1"; exit 2; }

# === FAIL-CLOSED: jq required ===
command -v jq >/dev/null 2>&1 || deny '{"permission":"deny","user_message":"Missing jq","agent_message":"jq is required for capability gating."}'

INPUT=$(cat)

MODE_FILE="$HOME/.vibeswitch/state/mode.json"
MODE=$(jq -r '.mode // "dev"' "$MODE_FILE" 2>/dev/null || echo "dev")

# Extract command - verify field name in Phase 0
COMMAND=$(echo "$INPUT" | jq -r '.command // ""')

# === FAIL-CLOSED: Missing command field ===
if [ -z "$COMMAND" ]; then
  deny '{"permission":"deny","user_message":"No command","agent_message":"Shell command field missing or empty."}'
fi

# === METACHARACTER DEFENSE (applies to BOTH modes) ===
# Block chaining/redirection/subshell but ALLOW plain $ (env vars)
has_dangerous_chars() {
  local cmd="$1"
  # Command substitution: $( and backticks
  echo "$cmd" | grep -qE '\$\(' && return 0
  echo "$cmd" | grep -q '`' && return 0
  # Pipes, chaining, background
  echo "$cmd" | grep -qE '[;&|]' && return 0
  # Redirects
  echo "$cmd" | grep -qE '[<>]' && return 0
  # Newlines (actual, not escaped)
  [[ "$cmd" == *$'\n'* ]] && return 0
  [[ "$cmd" == *$'\r'* ]] && return 0
  # Shell invocation
  echo "$cmd" | grep -qiE '^(sh|bash|zsh|dash|ksh|fish|cmd|powershell)\s+(-c|-Command)' && return 0
  # Eval
  echo "$cmd" | grep -qE '^\s*eval\s+' && return 0
  return 1
}

if has_dangerous_chars "$COMMAND"; then
  deny '{"permission":"deny","user_message":"Blocked: shell operators","agent_message":"Shell chaining/redirection/subshell not allowed. Plain $VAR is OK."}'
fi

# Normalize for allowlist matching (safer trim than xargs)
COMMAND_NORM="$(printf '%s' "$COMMAND" | sed -e 's/^[[:space:]]\+//' -e 's/[[:space:]]\+$//')"

# === BLOCKLIST (DEV mode) ===
is_blocked() {
  local cmd="$1"
  echo "$cmd" | grep -qE '^npm\s+(install|i|ci|add|remove|uninstall)' && return 0
  echo "$cmd" | grep -qE '^yarn\s+(add|install|remove)' && return 0
  echo "$cmd" | grep -qE '^pnpm\s+(add|install|remove)' && return 0
  echo "$cmd" | grep -qE '^npx\s+' && ! echo "$cmd" | grep -qE '^npx\s+(--yes\s+)?vsce\s+package' && return 0
  echo "$cmd" | grep -qE '^git\s+(checkout|reset|clean|push|commit|rebase|merge|stash|cherry-pick)' && return 0
  echo "$cmd" | grep -qE '(rm\s+-rf|sudo|mkfs|dd\s+.*of=|chmod\s+777)' && return 0
  return 1
}

# === ALLOWLIST (DEV mode) ===
is_allowed() {
  local cmd="$1"
  echo "$cmd" | grep -qE '^npm\s+(test|run\s+test)(\s|$)' && return 0
  echo "$cmd" | grep -qE '^npx\s+(--yes\s+)?vsce\s+package' && return 0
  echo "$cmd" | grep -qE '^git\s+(status|log|diff|branch|show|blame|ls-files|remote)(\s|$)' && return 0
  echo "$cmd" | grep -qE '^(ls|cat|head|tail|wc|file|stat|pwd|echo|which|type)(\s|$)' && return 0
  echo "$cmd" | grep -qE '^(grep|rg|find|fd|ag)(\s|$)' && return 0
  return 1
}

if [ "$MODE" = "dev" ]; then
  is_blocked "$COMMAND_NORM" && deny '{"permission":"deny","user_message":"DEV: Blocked","agent_message":"DEV: Command blocked."}'
  is_allowed "$COMMAND_NORM" && { echo '{"permission":"allow"}'; exit 0; }
  deny '{"permission":"deny","user_message":"DEV: Not allowed","agent_message":"DEV: Not in allowlist."}'
fi

if [ "$MODE" = "vibe" ]; then
  # Catastrophic commands blocked even in VIBE
  echo "$COMMAND_NORM" | grep -qE '(rm\s+-rf\s+/|sudo\s+rm|mkfs\.)' && deny '{"permission":"deny","user_message":"Catastrophic"}'
  echo '{"permission":"allow"}'
  exit 0
fi

# Unknown mode = fail-closed to DEV behavior
deny '{"permission":"deny","user_message":"Unknown mode","agent_message":"Unknown mode, defaulting to deny."}'
```

---

### `$HOME/.vibeswitch/hooks/gate-mcp.sh` (fail-closed server identity)

```bash
#!/bin/bash
set -euo pipefail
IFS=$'\n\t'

deny() { echo "$1"; exit 2; }

# === FAIL-CLOSED: jq required ===
command -v jq >/dev/null 2>&1 || deny '{"permission":"deny","user_message":"Missing jq","agent_message":"jq is required for capability gating."}'

INPUT=$(cat)

MODE_FILE="$HOME/.vibeswitch/state/mode.json"
MODE=$(jq -r '.mode // "dev"' "$MODE_FILE" 2>/dev/null || echo "dev")

# Expected server identity (written by extension at install)
MCP_SERVER_FILE="$HOME/.vibeswitch/state/mcp-server.json"

# === FIELD NAMES VERIFIED IN PHASE 0 PROBE ===
# tool_name = MCP tool name (e.g., "browser_tabs")
# command = MCP SERVER NAME (e.g., "cursor-ide-browser", "vibeswitch")
TOOL=$(echo "$INPUT" | jq -r '.tool_name // ""')
SERVER=$(echo "$INPUT" | jq -r '.command // ""')

if [ "$MODE" = "dev" ]; then
  # Load expected identity
  if [ ! -f "$MCP_SERVER_FILE" ]; then
    deny '{"permission":"deny","user_message":"DEV: MCP config missing","agent_message":"DEV: mcp-server.json not found. Cannot verify server identity."}'
  fi
  
  # The server name from mcp-server.json
  EXPECTED_SERVER=$(jq -r '.serverName // ""' "$MCP_SERVER_FILE" 2>/dev/null || true)
  
  # === FAIL-CLOSED: At least one expected identifier must be configured ===
  if [ -z "$EXPECTED_SERVER" ]; then
    deny '{"permission":"deny","user_message":"DEV: MCP config incomplete","agent_message":"DEV: mcp-server.json has no serverName configured."}'
  fi
  
  # === FAIL-CLOSED SERVER IDENTITY CHECK ===
  # Tool name must match pattern AND server must match expected
  case "$TOOL" in
    mcp__vibeswitch__*)
      if [ "$SERVER" = "$EXPECTED_SERVER" ]; then
        echo '{"permission":"allow"}'
        exit 0
      else
        deny '{"permission":"deny","user_message":"DEV: MCP identity mismatch","agent_message":"DEV: Server '"$SERVER"' does not match expected '"$EXPECTED_SERVER"'"}'
      fi
      ;;
    *)
      deny '{"permission":"deny","user_message":"DEV: MCP blocked","agent_message":"DEV: Only vibeswitch MCP allowed. Got tool: '"$TOOL"'"}'
      ;;
  esac
fi

# VIBE mode: allow all MCP
echo '{"permission":"allow"}'
exit 0
```

---

### `$HOME/.vibeswitch/hooks/inject-context.sh`

```bash
#!/bin/bash
set -euo pipefail
IFS=$'\n\t'

cat > /dev/null

# jq check (soft fail - just default to dev if missing)
if ! command -v jq >/dev/null 2>&1; then
  MODE="dev"
else
  MODE_FILE="$HOME/.vibeswitch/state/mode.json"
  MODE=$(jq -r '.mode // "dev"' "$MODE_FILE" 2>/dev/null || echo "dev")
fi

if [ "$MODE" = "dev" ]; then
  printf '{"continue":true,"additional_context":"SYSTEM: DEV MODE.\\n\\nYou CANNOT use Write/StrReplace/Edit.\\n\\nTo modify files:\\n1. Call mcp__vibeswitch__submit_patch(filePath, unifiedDiff)\\n2. Wait for user approval\\n3. Call mcp__vibeswitch__apply_patch(requestId, filePath, unifiedDiff, token)\\n\\nShell: Only npm test, git status/log/diff, read-only. No chaining/redirects."}'
else
  printf '{"continue":true,"additional_context":"VIBE MODE: Proceed autonomously. Note: shell chaining/redirects still blocked for safety."}'
fi
exit 0
```

---

### `$HOME/.vibeswitch/hooks/detect-edit.sh`

```bash
#!/bin/bash
set -euo pipefail
IFS=$'\n\t'

INPUT=$(cat)

# jq check (soft fail - default to dev, FILE=UNKNOWN if missing)
if ! command -v jq >/dev/null 2>&1; then
  MODE="dev"
  FILE="UNKNOWN"
else
  MODE_FILE="$HOME/.vibeswitch/state/mode.json"
  MODE=$(jq -r '.mode // "dev"' "$MODE_FILE" 2>/dev/null || echo "dev")
  # Field name verified in Phase 0 probe: file_path
  FILE=$(echo "$INPUT" | jq -r '.file_path // ""')
  [ -z "$FILE" ] && FILE="UNKNOWN"
fi

if [ "$MODE" = "dev" ]; then
  TS=$(date -Iseconds)
  
  ALERT="$HOME/.vibeswitch/state/alert.json"
  echo "{\"file\":\"$FILE\",\"ts\":\"$TS\"}" > "$ALERT"
  
  AUDIT="$HOME/.vibeswitch/state/audit.log"
  echo "{\"ts\":\"$TS\",\"action\":\"UNAPPROVED_EDIT\",\"file\":\"$FILE\"}" >> "$AUDIT"
fi

echo '{}'
exit 0
```

---

## Extension: hooks.json Watcher (atomic + debounced + sha256 audit)

```javascript
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const AUDIT = path.join(os.homedir(), '.vibeswitch', 'state', 'audit.log');
const DEBOUNCE_MS = 300;

class HooksJsonGuard {
  constructor(context, modeManager) {
    this.context = context;
    this.modeManager = modeManager;
    this.expectedContent = null;
    this.watcher = null;
    this.debounceTimer = null;
    this.isRestoring = false;
  }
  
  getExpectedContent() {
    const home = os.homedir();
    return JSON.stringify({
      version: 1,
      hooks: {
        beforeSubmitPrompt: [{ command: `${home}/.vibeswitch/hooks/inject-context.sh`, timeout: 3 }],
        beforeShellExecution: [{ command: `${home}/.vibeswitch/hooks/gate-shell.sh`, timeout: 5 }],
        beforeMCPExecution: [{ command: `${home}/.vibeswitch/hooks/gate-mcp.sh`, timeout: 5 }],
        afterFileEdit: [{ command: `${home}/.vibeswitch/hooks/detect-edit.sh`, timeout: 3 }]
      }
    }, null, 2);
  }
  
  start(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.expectedContent = this.getExpectedContent();
    this.hooksPath = path.join(workspaceRoot, '.cursor', 'hooks.json');
    
    // Ensure correct content on startup (atomic write)
    this.atomicWrite(this.hooksPath, this.expectedContent);
    
    // Watch using vscode API (more reliable than fs.watch)
    const pattern = new vscode.RelativePattern(workspaceRoot, '.cursor/hooks.json');
    this.watcher = vscode.workspace.createFileSystemWatcher(pattern);
    
    this.watcher.onDidChange(() => this.onTamperDebounced('changed'));
    this.watcher.onDidDelete(() => this.onTamperDebounced('deleted'));
    this.watcher.onDidCreate(() => this.onTamperDebounced('created'));
  }
  
  // Atomic write: temp file + rename
  // Note: fs.renameSync is atomic on POSIX but may fail on Windows if target exists.
  // For cross-platform, consider fs.rename with retry or copyFile+unlink fallback.
  atomicWrite(filePath, content) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tmpPath = filePath + '.tmp.' + Date.now();
    fs.writeFileSync(tmpPath, content, 'utf8');
    fs.renameSync(tmpPath, filePath);
  }
  
  // Debounced tamper handling
  onTamperDebounced(event) {
    if (this.isRestoring) return; // Ignore events from our own restore
    
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.onTamper(event), DEBOUNCE_MS);
  }
  
  async onTamper(event) {
    const current = fs.existsSync(this.hooksPath) ? fs.readFileSync(this.hooksPath, 'utf8') : '';
    if (current === this.expectedContent) return; // Already correct
    
    // TAMPER DETECTED
    this.isRestoring = true;
    const ts = new Date().toISOString();
    
    try {
      // Hash of tampered content (not the content itself - avoid leaking)
      const contentHash = crypto.createHash('sha256').update(current).digest('hex').slice(0, 16);
      
      // 1. Audit with hash
      fs.mkdirSync(path.dirname(AUDIT), { recursive: true });
      fs.appendFileSync(AUDIT, JSON.stringify({ ts, action: 'HOOKS_TAMPER', event, hash: contentHash }) + '\n');
      
      // 2. Restore atomically
      this.atomicWrite(this.hooksPath, this.expectedContent);
      
      // 3. Flip to DEV mode
      await this.modeManager.set('dev');
      
      // 4. Alert user (single modal, not repeated due to debounce)
      vscode.window.showErrorMessage(
        'VibeSwitch: hooks.json was tampered with! Restored and switched to DEV mode.',
        'View Audit Log'
      ).then(action => {
        if (action === 'View Audit Log') {
          vscode.workspace.openTextDocument(AUDIT).then(doc => vscode.window.showTextDocument(doc));
        }
      });
    } finally {
      // Small delay before re-enabling detection to avoid re-entrant triggers
      setTimeout(() => { this.isRestoring = false; }, 100);
    }
  }
  
  dispose() {
    clearTimeout(this.debounceTimer);
    this.watcher?.dispose();
  }
}

module.exports = { HooksJsonGuard };
```

---

## Extension: MCP Server Identity Writer

```javascript
const fs = require('fs');
const path = require('path');
const os = require('os');

const MCP_SERVER_FILE = path.join(os.homedir(), '.vibeswitch', 'state', 'mcp-server.json');

function writeMcpServerIdentity() {
  // These values should match what Cursor reports in hook payloads
  // Update after Phase 0 probe
  const identity = {
    serverName: 'vibeswitch',
    serverId: null, // Fill in from probe if available
    serverPath: path.join(os.homedir(), '.vibeswitch', 'mcp', 'server.js'),
    updatedAt: new Date().toISOString()
  };
  
  fs.mkdirSync(path.dirname(MCP_SERVER_FILE), { recursive: true });
  fs.writeFileSync(MCP_SERVER_FILE, JSON.stringify(identity, null, 2));
}

module.exports = { writeMcpServerIdentity };
```

---

## Extension: Capability Self-Test

```javascript
const fs = require('fs');
const path = require('path');
const os = require('os');
const vscode = require('vscode');

class CapabilitySelfTest {
  constructor() {
    this.hooksDir = path.join(os.homedir(), '.vibeswitch', 'hooks');
    this.stateDir = path.join(os.homedir(), '.vibeswitch', 'state');
  }
  
  async runOnActivation() {
    const results = await this.runTests();
    if (!results.allPassed) {
      vscode.window.showErrorMessage(
        `VibeSwitch: Capability self-test FAILED. ${results.failures.join(', ')}`,
        'View Details'
      );
    }
  }
  
  async runTests() {
    const failures = [];
    
    // Test 1: Hook scripts exist and are executable
    const scripts = ['gate-shell.sh', 'gate-mcp.sh', 'inject-context.sh', 'detect-edit.sh'];
    for (const script of scripts) {
      const p = path.join(this.hooksDir, script);
      if (!fs.existsSync(p)) {
        failures.push(`Missing: ${script}`);
      } else {
        try {
          fs.accessSync(p, fs.constants.X_OK);
        } catch {
          failures.push(`Not executable: ${script}`);
        }
      }
    }
    
    // Test 2: Mode file exists
    const modeFile = path.join(this.stateDir, 'mode.json');
    if (!fs.existsSync(modeFile)) {
      failures.push('Missing mode.json');
    }
    
    // Test 3: MCP server identity file exists
    const mcpServerFile = path.join(this.stateDir, 'mcp-server.json');
    if (!fs.existsSync(mcpServerFile)) {
      failures.push('Missing mcp-server.json');
    }
    
    // Test 4: Workspaces allowlist exists
    const workspacesFile = path.join(this.stateDir, 'workspaces.json');
    if (!fs.existsSync(workspacesFile)) {
      failures.push('Missing workspaces.json');
    }
    
    return { allPassed: failures.length === 0, failures };
  }
  
  startPeriodicCheck(intervalMs = 300000) {
    setInterval(() => this.runOnActivation(), intervalMs);
  }
}

module.exports = { CapabilitySelfTest };
```

---

## Extension: Workspace Allowlist

```javascript
const fs = require('fs');
const path = require('path');
const os = require('os');

const WORKSPACES_FILE = path.join(os.homedir(), '.vibeswitch', 'state', 'workspaces.json');

class WorkspaceAllowlist {
  constructor() {
    this.load();
  }
  
  load() {
    try {
      this.allowed = JSON.parse(fs.readFileSync(WORKSPACES_FILE, 'utf8')).workspaces || [];
    } catch {
      this.allowed = [];
    }
  }
  
  add(workspaceRoot) {
    // Always store realpath'd roots
    const resolved = fs.realpathSync(workspaceRoot);
    if (!this.allowed.includes(resolved)) {
      this.allowed.push(resolved);
      this.save();
    }
  }
  
  remove(workspaceRoot) {
    const resolved = fs.realpathSync(workspaceRoot);
    this.allowed = this.allowed.filter(w => w !== resolved);
    this.save();
  }
  
  save() {
    fs.mkdirSync(path.dirname(WORKSPACES_FILE), { recursive: true });
    fs.writeFileSync(WORKSPACES_FILE, JSON.stringify({ workspaces: this.allowed, updatedAt: new Date().toISOString() }, null, 2));
  }
  
  // EXACT MATCH ONLY - no prefix matching
  // Both sides use realpath
  isAllowed(workspaceRoot) {
    try {
      const resolved = fs.realpathSync(workspaceRoot);
      return this.allowed.includes(resolved);
    } catch {
      return false;
    }
  }
}

function onWorkspaceOpen(workspaceRoot) {
  const allowlist = new WorkspaceAllowlist();
  allowlist.add(workspaceRoot);
}

module.exports = { WorkspaceAllowlist, onWorkspaceOpen };
```

---

## PHASE 2: Shared Canonical JSON

### `$HOME/.vibeswitch/lib/canonical.js`

```javascript
/**
 * RFC 8785-style canonical JSON serialization.
 * Used by BOTH extension and MCP server to ensure bit-identical output.
 * 
 * INVARIANT: All token payload values MUST be strings.
 * This avoids float formatting edge cases (0.30000000000000004, 1e-7, etc.)
 * Payload fields: exp, iat, nonce, requestId, scope.filePath, scope.patchHash
 * All are strings - do NOT add numeric or float fields.
 */

function canonicalize(value) {
  if (value === null) return 'null';
  
  const type = typeof value;
  
  if (type === 'boolean') return value ? 'true' : 'false';
  if (type === 'number') {
    if (!isFinite(value)) throw new Error('Non-finite number');
    return Object.is(value, -0) ? '0' : String(value);
  }
  if (type === 'string') return JSON.stringify(value);
  
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalize).join(',') + ']';
  }
  
  if (type === 'object') {
    const keys = Object.keys(value).sort();
    const pairs = keys.map(k => JSON.stringify(k) + ':' + canonicalize(value[k]));
    return '{' + pairs.join(',') + '}';
  }
  
  throw new Error(`Cannot canonicalize type: ${type}`);
}

function parse(canonical) {
  return JSON.parse(canonical);
}

module.exports = { canonicalize, parse };
```

Both extension and MCP server require this same file:

```javascript
const { canonicalize } = require(path.join(os.homedir(), '.vibeswitch', 'lib', 'canonical.js'));
```

---

## PHASE 2: MCP Server (workspace allowlist + token in call only)

### `apply_patch` with server-side workspace validation

```javascript
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { applyPatch, parsePatch } = require('diff');

const STATE_DIR = path.join(os.homedir(), '.vibeswitch', 'state');
const MCP_DIR = path.join(os.homedir(), '.vibeswitch', 'mcp');
const AUDIT = path.join(STATE_DIR, 'audit.log');
const WORKSPACES_FILE = path.join(STATE_DIR, 'workspaces.json');

const { canonicalize } = require(path.join(os.homedir(), '.vibeswitch', 'lib', 'canonical.js'));

const MAX_LINES = 500;
const DENY_DIRS = ['.git', '.cursor', 'node_modules', '.vibeswitch'];

// === WORKSPACE ALLOWLIST (EXACT MATCH, REALPATH BOTH SIDES) ===
function isWorkspaceAllowed(workspaceRoot) {
  let allowed = [];
  try {
    allowed = JSON.parse(fs.readFileSync(WORKSPACES_FILE, 'utf8')).workspaces || [];
  } catch {
    return false; // No allowlist = deny all
  }
  
  try {
    const resolved = fs.realpathSync(workspaceRoot);
    // EXACT MATCH ONLY (allowed list already contains realpath'd roots)
    return allowed.includes(resolved);
  } catch {
    return false;
  }
}

function verifyToken(token) {
  const [payloadB64, sigB64] = (token || '').split('.');
  if (!payloadB64 || !sigB64) return { ok: false, err: 'Invalid format' };
  
  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
  } catch { return { ok: false, err: 'Invalid payload' }; }
  
  let pubKey;
  try {
    pubKey = crypto.createPublicKey(fs.readFileSync(path.join(MCP_DIR, 'publicKey.pem'), 'utf8'));
  } catch { return { ok: false, err: 'No public key' }; }
  
  const canonical = canonicalize(payload);
  const sig = Buffer.from(sigB64, 'base64url');
  
  if (!crypto.verify(null, Buffer.from(canonical), pubKey, sig)) {
    return { ok: false, err: 'Bad signature' };
  }
  
  return { ok: true, payload };
}

// NOTE: Token MUST be passed in call. MCP server ignores workspace token.json.
function applyPatchTool({ requestId, filePath, unifiedDiff, token, workspaceRoot }) {
  // === WORKSPACE ALLOWLIST CHECK (FIRST) ===
  if (!workspaceRoot || !path.isAbsolute(workspaceRoot)) {
    return { success: false, error: 'workspaceRoot required (absolute path)' };
  }
  
  if (!isWorkspaceAllowed(workspaceRoot)) {
    return { success: false, error: 'Workspace not in allowlist' };
  }
  
  const modeFile = path.join(STATE_DIR, 'mode.json');
  let mode = 'dev';
  try { mode = JSON.parse(fs.readFileSync(modeFile)).mode || 'dev'; } catch { mode = 'dev'; }
  
  // VIBE: auto-approve
  if (mode === 'vibe') {
    const v = validatePatch(workspaceRoot, filePath, unifiedDiff, 'vibe');
    if (!v.ok) return { success: false, error: v.errors.join('; ') };
    return exec(workspaceRoot, filePath, unifiedDiff, 'vibe', 'auto', null);
  }
  
  // DEV: full verification - token MUST be in call
  if (!token) return { success: false, error: 'Token required (must be passed in call)' };
  
  const vt = verifyToken(token);
  if (!vt.ok) return { success: false, error: vt.err };
  
  const p = vt.payload;
  if (p.requestId !== requestId) return { success: false, error: 'requestId mismatch' };
  if (new Date(p.exp) < new Date()) return { success: false, error: 'Expired' };
  if (isConsumed(requestId)) return { success: false, error: 'Already used' };
  
  const resolved = path.resolve(workspaceRoot, filePath);
  if (p.scope.filePath !== resolved) return { success: false, error: 'filePath mismatch' };
  
  const hash = crypto.createHash('sha256').update(unifiedDiff).digest('hex');
  if (p.scope.patchHash !== hash) return { success: false, error: 'patchHash mismatch' };
  
  const v = validatePatch(workspaceRoot, filePath, unifiedDiff, 'dev');
  if (!v.ok) return { success: false, error: v.errors.join('; ') };
  
  markConsumed(requestId, resolved, hash);
  return exec(workspaceRoot, filePath, unifiedDiff, 'dev', 'approved', requestId);
}

function submitPatch({ filePath, unifiedDiff, workspaceRoot }) {
  // === WORKSPACE ALLOWLIST CHECK ===
  if (!workspaceRoot || !path.isAbsolute(workspaceRoot)) {
    return { success: false, error: 'workspaceRoot required (absolute path)' };
  }
  
  if (!isWorkspaceAllowed(workspaceRoot)) {
    return { success: false, error: 'Workspace not in allowlist' };
  }
  
  const requestId = crypto.randomUUID();
  const patchHash = crypto.createHash('sha256').update(unifiedDiff).digest('hex');
  const resolvedPath = path.resolve(workspaceRoot, filePath);
  
  const request = {
    requestId,
    filePath: resolvedPath,
    unifiedDiff,
    patchHash,
    workspaceRoot,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  
  const REQUESTS_DIR = path.join(STATE_DIR, 'requests');
  fs.mkdirSync(REQUESTS_DIR, { recursive: true });
  fs.writeFileSync(path.join(REQUESTS_DIR, `${requestId}.json`), JSON.stringify(request, null, 2));
  
  return { success: true, requestId, status: 'pending', message: 'Awaiting user approval' };
}

function validatePatch(ws, filePath, diff, mode) {
  const errs = [];
  const resolved = path.resolve(ws, filePath);
  
  let parsed;
  try { parsed = parsePatch(diff); } catch { return { ok: false, errors: ['Invalid patch'] }; }
  
  if (mode === 'dev' && parsed.length !== 1) errs.push('DEV: 1 file only');
  
  let lines = 0;
  for (const f of parsed) for (const h of f.hunks || []) 
    lines += h.lines.filter(l => l[0] === '+' || l[0] === '-').length;
  if (mode === 'dev' && lines > MAX_LINES) errs.push(`DEV: max ${MAX_LINES} lines`);
  
  if (diff.includes('Binary files') || /\x00/.test(diff)) errs.push('No binary/NUL');
  
  let realWs;
  try { realWs = fs.realpathSync(ws); } catch { return { ok: false, errors: ['Bad workspace'] }; }
  if (!resolved.startsWith(realWs + path.sep)) errs.push('Outside workspace');
  
  const dir = path.dirname(resolved);
  if (fs.existsSync(dir)) {
    try {
      const realDir = fs.realpathSync(dir);
      if (!realDir.startsWith(realWs + path.sep) && realDir !== realWs) errs.push('Symlink escape');
    } catch {}
  }
  
  const rel = path.relative(realWs, resolved);
  for (const d of DENY_DIRS) if (rel.startsWith(d + path.sep) || rel === d) errs.push(`Cannot modify ${d}/`);
  
  if (mode === 'dev' && !fs.existsSync(resolved)) errs.push('DEV: No new files');
  
  if (mode === 'dev' && errs.length === 0) {
    const orig = fs.existsSync(resolved) ? fs.readFileSync(resolved, 'utf8') : '';
    if (applyPatch(orig, diff, { fuzzFactor: 0 }) === false) errs.push('DEV: Must apply cleanly');
  }
  
  return { ok: errs.length === 0, errors: errs };
}

function exec(ws, filePath, diff, mode, auth, reqId) {
  const resolved = path.resolve(ws, filePath);
  try {
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    const orig = fs.existsSync(resolved) ? fs.readFileSync(resolved, 'utf8') : '';
    const patched = applyPatch(orig, diff, { fuzzFactor: mode === 'vibe' ? 2 : 0 });
    if (patched === false) return { success: false, error: 'Patch failed' };
    
    // Atomic write
    const tmp = resolved + '.tmp.' + Date.now();
    fs.writeFileSync(tmp, patched);
    fs.renameSync(tmp, resolved);
    
    const hash = crypto.createHash('sha256').update(diff).digest('hex').slice(0, 16);
    fs.mkdirSync(path.dirname(AUDIT), { recursive: true });
    fs.appendFileSync(AUDIT, JSON.stringify({ ts: new Date().toISOString(), action: 'PATCH', mode, file: resolved, hash, reqId, auth }) + '\n');
    
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
}

// SQLite consumed tracking
const Database = require('better-sqlite3');
const DB_PATH = path.join(MCP_DIR, 'consumed.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.exec('CREATE TABLE IF NOT EXISTS consumed (id TEXT PRIMARY KEY, ts TEXT, file TEXT, hash TEXT)');

function isConsumed(id) { return !!db.prepare('SELECT 1 FROM consumed WHERE id=?').get(id); }
function markConsumed(id, file, hash) { db.prepare('INSERT INTO consumed (id,ts,file,hash) VALUES (?,?,?,?)').run(id, new Date().toISOString(), file, hash); }

module.exports = { applyPatchTool, submitPatch };
```

---

## Extension: Request Watcher (using chokidar)

```javascript
const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const vscode = require('vscode');

const STATE_DIR = path.join(os.homedir(), '.vibeswitch', 'state');
const REQUESTS_DIR = path.join(STATE_DIR, 'requests');
const APPROVED_DIR = path.join(STATE_DIR, 'approved');
const MCP_DIR = path.join(os.homedir(), '.vibeswitch', 'mcp');

const { canonicalize } = require(path.join(os.homedir(), '.vibeswitch', 'lib', 'canonical.js'));

class ApprovalManager {
  constructor(context) {
    this.context = context;
    this.watcher = null;
  }
  
  startWatching() {
    fs.mkdirSync(REQUESTS_DIR, { recursive: true });
    
    this.watcher = chokidar.watch(REQUESTS_DIR, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 }
    });
    
    this.watcher.on('add', filepath => {
      if (filepath.endsWith('.json')) {
        this.onNewRequest(filepath);
      }
    });
  }
  
  async onNewRequest(requestPath) {
    if (!fs.existsSync(requestPath)) return;
    
    let request;
    try {
      request = JSON.parse(fs.readFileSync(requestPath, 'utf8'));
    } catch { return; }
    
    if (request.status !== 'pending') return;
    
    const action = await vscode.window.showWarningMessage(
      `Patch request: ${path.basename(request.filePath)}`,
      { modal: true, detail: `${request.unifiedDiff.split('\n').length} lines` },
      'View & Approve', 'Reject'
    );
    
    if (action === 'View & Approve') {
      await this.showDiffAndApprove(request, requestPath);
    } else {
      this.rejectRequest(request, requestPath);
    }
  }
  
  async showDiffAndApprove(request, requestPath) {
    const token = await this.signToken(request);
    
    fs.mkdirSync(APPROVED_DIR, { recursive: true });
    fs.writeFileSync(path.join(APPROVED_DIR, `${request.requestId}.token`), token);
    
    request.status = 'approved';
    fs.writeFileSync(requestPath, JSON.stringify(request, null, 2));
    
    // Workspace token.json is CONVENIENCE ONLY - best effort, MCP ignores it
    try {
      const wsTokenPath = path.join(request.workspaceRoot, '.vibeswitch', 'token.json');
      fs.mkdirSync(path.dirname(wsTokenPath), { recursive: true });
      fs.writeFileSync(wsTokenPath, JSON.stringify({ requestId: request.requestId, token }));
    } catch {
      // Best effort - approval still works via $HOME/.vibeswitch/state/approved/
    }
    
    vscode.window.showInformationMessage(`Approved: ${request.requestId.slice(0,8)}`);
  }
  
  async signToken(request) {
    const privateKey = await this.getPrivateKey();
    
    // INVARIANT: All values are strings (see canonical.js)
    const payload = {
      exp: new Date(Date.now() + 120000).toISOString(),
      iat: new Date().toISOString(),
      nonce: crypto.randomBytes(16).toString('hex'),
      requestId: request.requestId,
      scope: {
        filePath: request.filePath,
        patchHash: request.patchHash
      }
    };
    
    const canonical = canonicalize(payload);
    const sig = crypto.sign(null, Buffer.from(canonical), privateKey);
    
    return Buffer.from(canonical).toString('base64url') + '.' + sig.toString('base64url');
  }
  
  async getPrivateKey() {
    let pem = await this.context.secrets.get('vibeswitch.privateKey');
    if (!pem) {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
      pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
      await this.context.secrets.store('vibeswitch.privateKey', pem);
      fs.mkdirSync(MCP_DIR, { recursive: true });
      fs.writeFileSync(path.join(MCP_DIR, 'publicKey.pem'), publicKey.export({ type: 'spki', format: 'pem' }));
    }
    return crypto.createPrivateKey(pem);
  }
  
  rejectRequest(request, requestPath) {
    request.status = 'rejected';
    fs.writeFileSync(requestPath, JSON.stringify(request, null, 2));
  }
  
  dispose() {
    this.watcher?.close();
  }
}

module.exports = { ApprovalManager };
```

---

## Enforcement Summary

| Attack | Protection |
|--------|------------|
| Edit hook scripts | Scripts in `$HOME/.vibeswitch/hooks/` |
| Edit `.cursor/hooks.json` | Extension watches + atomic restore + debounce + flip DEV (sha256 audit) |
| Forge token | Ed25519 private in `context.secrets` |
| Replay token | SQLite `consumed.db` |
| Wrong file/content | Scope binding with shared canonical JSON (all-strings) |
| Bad workspaceRoot | Server-side allowlist (exact match, realpath both sides) |
| Spoof MCP server | Gate on server identity, fail-closed (no fallback) |
| Shell chaining/redirects | Block `$(`, backticks, `; & | < >` (plain `$` allowed) |
| Shell newlines | Real newline check with `$'\n'` |
| Missing command field | Fail-closed with explicit deny |
| Missing jq | Fail-closed with explicit deny |
| Empty MCP identity config | Fail-closed with clear message |
| Silent script failures | `set -euo pipefail` + safe IFS |
| xargs surprises | Use `sed` trim instead of `xargs` |
| detect-edit.sh jq branch | FILE extraction inside jq check block |
| Tamper mode | Source in `context.globalState` |
| fs.watch unreliable | Use `chokidar` / `vscode.workspace.createFileSystemWatcher` |
| Token channel confusion | MCP only accepts token in call, ignores workspace `token.json` |
| Built-in editor | **DETECT ONLY** |

---

## Files Summary

| Location | File |
|----------|------|
| `$HOME/.vibeswitch/hooks/` | Gate scripts |
| `$HOME/.vibeswitch/lib/canonical.js` | Shared canonical JSON (all-strings invariant) |
| `$HOME/.vibeswitch/state/mode.json` | Mode mirror |
| `$HOME/.vibeswitch/state/workspaces.json` | Allowed workspace roots (exact match, realpath'd) |
| `$HOME/.vibeswitch/state/mcp-server.json` | Expected MCP server identity |
| `$HOME/.vibeswitch/state/requests/` | Pending (MCP writes) |
| `$HOME/.vibeswitch/state/approved/` | Tokens (extension writes) |
| `$HOME/.vibeswitch/state/audit.log` | Audit trail (sha256 hashes) |
| `$HOME/.vibeswitch/mcp/publicKey.pem` | Ed25519 public |
| `$HOME/.vibeswitch/mcp/consumed.db` | SQLite |
| `context.secrets` | Ed25519 private |
| `context.globalState` | Mode source |
| Workspace `.cursor/hooks.json` | Watched + atomic restore + debounce |
| Workspace `.vibeswitch/token.json` | Convenience only (MCP ignores) |

---

## Go/No-Go Checklist

**Phase 0 Probe Results (VERIFIED):**
- Shell command field: `command` ✅
- MCP tool field: `tool_name` ✅
- MCP server identity: `command` (NOT serverName/serverId/serverPath) ✅

Before shipping, verify:

- [x] **Phase 0 probe confirms real field names** for `.command`, tool name, and server identity ✅
- [x] **mcp-server.json populated** with at least one stable identifier that actually appears in payloads ✅
- [x] **Hooks are `chmod +x`** and owned by user (not writable by workspace processes) ✅
- [ ] **jq is installed** on target machine (user responsibility)
- [x] **chokidar dependency** added to extension package.json ✅
- [x] **better-sqlite3 dependency** added to MCP server package.json ✅

---

## Implementation Status

**ALL PHASES COMPLETE** ✅

### Files Created

**Hook Scripts** (`$HOME/.vibeswitch/hooks/`):
- `gate-shell.sh` - Shell command gating with blocklist/allowlist
- `gate-mcp.sh` - MCP tool gating with server identity verification
- `inject-context.sh` - Prompt context injection
- `detect-edit.sh` - Built-in editor detection

**State Files** (`$HOME/.vibeswitch/state/`):
- `mode.json` - Mode mirror for hooks
- `mcp-server.json` - Expected MCP server identity
- `workspaces.json` - Allowed workspace roots
- `audit.log` - Append-only audit trail

**Shared Modules** (`$HOME/.vibeswitch/lib/`):
- `canonical.js` - RFC 8785-style canonical JSON

**Extension Components** (`business_modules/mode-enforcement/`):
- `ModeManager` - globalState source + filesystem mirror
- `HooksJsonGuard` - Watch + atomic restore + debounce
- `CapabilitySelfTest` - Integrity verification
- `WorkspaceAllowlist` - Trusted workspace management
- `AlertFileEditDetector` - Unapproved edit detection
- `KeypairManager` - Ed25519 keypair management
- `ApprovalManager` - Patch approval workflow

**MCP Server** (`business_modules/mcp-server/`):
- `index.js` - MCP server with `submit_patch` and `apply_patch` tools
- `package.json` - Dependencies

---

## Implementation Order (COMPLETED)

1. **Phase 0** ✅: Hook probe - captured field names
2. **Phase 1** ✅: Hooks + hooks.json guard + workspace allowlist + MCP identity + self-test
3. **Phase 2** ✅: Shared canonical + Ed25519 + MCP server + chokidar watcher
4. **Phase 3** ✅: Audit, polish, documentation updates
