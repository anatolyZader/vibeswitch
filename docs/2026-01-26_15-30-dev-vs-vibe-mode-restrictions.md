# DEV Mode vs VIBE Mode: Complete Restriction List

**Date:** January 26, 2026  
**Purpose:** Clear comparison of what is blocked/requires approval in each mode

---

## Summary Table

| Capability | DEV Mode | VIBE Mode |
|------------|----------|-----------|
| **File Edits (Built-in)** | ❌ **BLOCKED** (auto-reverted) | ✅ Allowed |
| **File Edits (MCP)** | ✅ Requires approval token | ✅ Auto-approved |
| **Shell Commands** | ⚠️ Allowlist only | ✅ Allowed (except catastrophic) |
| **MCP Tools** | ⚠️ Only vibeswitch server | ✅ All allowed |
| **Shell Metacharacters** | ❌ Blocked (both modes) | ❌ Blocked (both modes) |

---

## 1. FILE EDITS

### DEV Mode

#### Built-in Editor Tools (BLOCKED + AUTO-REVERTED)

**Forbidden Tools:**
- ❌ `Write` - **FORBIDDEN** → Auto-reverted if git-tracked
- ❌ `StrReplace` - **FORBIDDEN** → Auto-reverted if git-tracked
- ❌ `Edit` - **FORBIDDEN** → Auto-reverted if git-tracked
- ❌ `EditNotebook` - **FORBIDDEN** → Auto-reverted if git-tracked
- ❌ `Delete` - **FORBIDDEN** → Auto-reverted if git-tracked

**How It Works (Step-by-Step):**

1. **Agent Uses Built-in Tool:**
   ```
   Agent calls: Write("file.js", "new content")
   ↓
   Cursor executes the write
   ↓
   File is modified on disk
   ```

2. **Detection (afterFileEdit Hook):**
   ```
   Cursor fires: afterFileEdit hook
   ↓
   detect-edit.sh script runs
   ↓
   Reads mode from ~/.vibeswitch/state/mode.json
   ↓
   If mode = "dev":
     Writes alert to ~/.vibeswitch/state/alert.json
     Logs to ~/.vibeswitch/state/audit.log
   ```

3. **Extension Detects Alert:**
   ```
   AlertFileEditDetector watches alert.json (chokidar)
   ↓
   Detects new alert (checks timestamp to avoid duplicates)
   ↓
   Verifies mode is still "dev"
   ```

4. **Auto-Revert Decision:**
   ```
   Checks if file can be reverted:
   - Is workspace a git repo? (git rev-parse --git-dir)
   - Is file tracked by git? (git ls-files --error-unmatch)
   ↓
   If YES → Proceeds to auto-revert
   If NO → Shows modal warning (can't revert new files)
   ```

5. **Auto-Revert Execution (Git-Tracked Files):**
   ```bash
   git checkout -- "relative/path/to/file.js"
   ↓
   File restored to last committed state
   ↓
   Agent's changes are GONE
   ```

6. **Multi-Channel Visual Feedback:**
   - **Status Bar Flash:** Red "🛡️ BLOCKED" (3 seconds)
   - **Progress Notification:** "⛔ BLOCKED - auto-reverted" (4 seconds, prominent)
   - **File Opens:** Affected file opens automatically in editor
   - **Yellow Highlight:** First line decorated with yellow border (3 seconds)
   - **Console Log:** Permanent log entry

7. **Fallback (New/Untracked Files):**
   ```
   If file is NOT tracked by git:
   ↓
   Cannot auto-revert (no git history)
   ↓
   Shows MODAL WARNING (blocking):
   "UNAUTHORIZED FILE EDIT DETECTED
    Auto-revert failed: File is not tracked by git (new file)
    
    [View File] [View Git Diff] [Revert with Git] [Dismiss]"
   ```

**Technical Details:**
- **Latency:** ~50-150ms from edit to revert (depends on filesystem)
- **Reliability:** Uses `chokidar` for file watching (more reliable than `fs.watch`)
- **Atomicity:** Git checkout is atomic (file either reverted or not)
- **Configuration:** Can disable via `vibeswitch.autoRevertUnapprovedEdits: false`

---

#### MCP File Edits (REQUIRES APPROVAL TOKEN)

**Allowed MCP Tools:**
- ✅ `mcp__vibeswitch__submit_patch` - Submit patch for approval
- ✅ `mcp__vibeswitch__apply_patch` - Apply approved patch (requires token)

**Complete Workflow (Step-by-Step):**

**Step 1: Agent Submits Patch**
```javascript
// Agent calls MCP tool
mcp__vibeswitch__submit_patch({
  workspaceRoot: "/home/user/project",
  filePath: "src/logger.js",
  patch: "--- a/src/logger.js\n+++ b/src/logger.js\n@@ -1,3 +1,4 @@\n // @ai\n+// New comment\n const vscode = require('vscode');"
})
```

**Step 2: MCP Server Validates & Stores**
```
MCP Server receives request
↓
Validates:
  - workspaceRoot is in allowlist (exact match)
  - filePath is safe (no path traversal, not in blocklist)
  - patch is valid unified diff format
↓
Generates requestId (UUID)
Calculates patchHash (SHA256 of patch)
↓
Writes to: ~/.vibeswitch/state/requests/<requestId>.json
{
  "requestId": "abc-123-def",
  "filePath": "/home/user/project/src/logger.js",
  "patch": "...",
  "patchHash": "a1b2c3d4...",
  "workspaceRoot": "/home/user/project",
  "status": "pending",
  "createdAt": "2026-01-26T15:30:00Z"
}
```

**Step 3: Extension Detects Request**
```
ApprovalManager watches requests/ directory (chokidar)
↓
Detects new .json file
↓
Parses request
↓
Checks mode is "dev"
```

**Step 4: User Approval Dialog**
```
Extension shows modal:
"Approve patch for logger.js?"
[Approve] [View Diff] [Deny]

If "View Diff":
  Opens diff preview in output channel
  Shows unified diff
  Asks again: [Approve] [Deny]
```

**Step 5: Token Generation (If Approved)**
```
User clicks "Approve"
↓
Extension generates Ed25519-signed token:

1. Creates payload:
   {
     exp: "1737894600000",  // 60 seconds from now
     iat: "1737894540000",  // current time
     nonce: "random-hex-string",
     requestId: "abc-123-def",
     scope: {
       filePath: "/home/user/project/src/logger.js",
       patchHash: "a1b2c3d4..."
     }
   }

2. Canonicalizes payload (RFC 8785-style):
   - Sorts keys alphabetically
   - Recursive sorting for nested objects
   - Ensures bit-identical serialization

3. Signs with Ed25519 private key:
   - Private key from context.secrets
   - Signature = Sign(privateKey, canonicalPayload)

4. Encodes token:
   token = base64url(canonicalPayload) + "." + base64url(signature)
```

**Step 6: Token Storage**
```
Extension writes token to:
~/.vibeswitch/state/approved/<requestId>.token

Updates request status:
~/.vibeswitch/state/requests/<requestId>.json
{
  "status": "approved",
  ...
}
```

**Step 7: Agent Applies Patch**
```javascript
// Agent calls MCP tool with token
mcp__vibeswitch__apply_patch({
  workspaceRoot: "/home/user/project",
  requestId: "abc-123-def",
  filePath: "src/logger.js",
  patch: "--- a/src/logger.js\n+++ b/src/logger.js\n@@ -1,3 +1,4 @@\n // @ai\n+// New comment\n const vscode = require('vscode');",
  token: "eyJleHAiOiIxNzM3ODk0NjAwMDAwMCIsImlhdCI6IjE3Mzc4OTQ1NDAwMDAwIiwibm9uY2UiOiJyYW5kb20taGV4LXN0cmluZyIsInJlcXVlc3RJZCI6ImFiYy0xMjMtZGVmIiwic2NvcGUiOnsiZmlsZVBhdGgiOiIvaG9tZS91c2VyL3Byb2plY3Qvc3JjL2xvZ2dlci5qcyIsInBhdGNoSGFzaCI6ImExYjJjM2Q0Li4uIn19.SWduYXR1cmUuLi4="
})
```

**Step 8: MCP Server Verification**
```
MCP Server receives apply_patch request
↓
1. Workspace Allowlist Check:
   - Verifies workspaceRoot is in allowlist
   - Uses realpath for symlink safety
   - Exact match only (no prefix matching)

2. Mode Check:
   - Reads mode from ~/.vibeswitch/state/mode.json
   - If "vibe" → auto-approve (skip token check)
   - If "dev" → proceed to token verification

3. Token Verification (DEV mode only):
   a. Decode token:
      - Split on "." → [payloadB64, sigB64]
      - Decode base64url → payload JSON, signature bytes
   
   b. Verify signature:
      - Load public key from ~/.vibeswitch/mcp/publicKey.pem
      - Canonicalize payload (same algorithm as extension)
      - crypto.verify(publicKey, canonicalPayload, signature)
      - If invalid → REJECT
   
   c. Verify expiration:
      - Check payload.exp > current time
      - If expired → REJECT
   
   d. Verify scope:
      - payload.requestId === request.requestId
      - payload.scope.filePath === request.filePath (exact match)
      - payload.scope.patchHash === request.patchHash (exact match)
      - If mismatch → REJECT
   
   e. Verify single-use:
      - Check consumed.json for requestId
      - If already consumed → REJECT
      - Mark as consumed (in-memory + file)

4. Path Safety Validation:
   - Resolve filePath relative to workspaceRoot
   - Check realpath (symlink safety)
   - Verify not in blocklist (.git, .cursor, node_modules, .vibeswitch)
   - Verify not blocklisted file (.env, credentials.json, secrets.json)
   - If unsafe → REJECT

5. Patch Validation (DEV mode strict):
   - Parse unified diff
   - Verify single file only (DEV: no multi-file patches)
   - Count lines changed (DEV: max 500 lines)
   - Verify no binary/NUL bytes
   - Verify patch applies cleanly (no fuzz in DEV)
   - If new file → REJECT (DEV: no new files)
   - If validation fails → REJECT

6. Apply Patch:
   - Read original file (if exists)
   - Apply unified diff using diff library
   - Atomic write (temp file + rename)
   - Log to audit trail
```

**Step 9: Success Response**
```
MCP Server returns:
{
  "success": true
}

File is now modified on disk.
```

**Token Security Properties:**
- **Unforgeable:** Requires Ed25519 private key (in `context.secrets`, not accessible to agent)
- **Single-use:** Consumed after first use, tracked in `consumed.json`
- **Time-limited:** Expires after 60 seconds
- **Scope-bound:** Only valid for specific `{requestId, filePath, patchHash}` combination
- **Cryptographically verified:** Ed25519 signature prevents tampering

**What Happens If Token Invalid:**
```
MCP Server returns:
{
  "success": false,
  "error": "Invalid signature" | "Token expired" | "Request ID mismatch" | 
           "File path mismatch" | "Patch hash mismatch" | "Token already used"
}

File is NOT modified.
Agent must get new approval token.
```

### VIBE Mode

**Built-in Editor Tools:**
- ✅ `Write` - **ALLOWED**
- ✅ `StrReplace` - **ALLOWED**
- ✅ `Edit` - **ALLOWED**
- ✅ `EditNotebook` - **ALLOWED**
- ✅ `Delete` - **ALLOWED**

**MCP File Edits:**
- ✅ `mcp__vibeswitch__apply_patch` - **AUTO-APPROVED** (no token needed)

---

## 2. SHELL COMMANDS

### DEV Mode (STRICT ALLOWLIST)

**✅ ALLOWED (Read-only):**
- `npm test` / `npm run test`
- `npx --yes vsce package` (packaging extension)
- `git status`
- `git log`
- `git diff`
- `git branch`
- `git show`
- `git blame`
- `git ls-files`
- `git remote`
- `ls`, `cat`, `head`, `tail`, `wc`, `file`, `stat`, `pwd`, `echo`, `which`, `type`
- `grep`, `rg`, `find`, `fd`, `ag` (search tools)

**❌ BLOCKED:**
- `npm install` / `npm i` / `npm ci`
- `npm add` / `npm remove` / `npm uninstall`
- `yarn add` / `yarn install` / `yarn remove`
- `pnpm add` / `pnpm install` / `pnpm remove`
- `npx <anything>` (except `vsce package`)
- `git checkout`
- `git reset`
- `git clean`
- `git push`
- `git commit`
- `git rebase`
- `git merge`
- `git stash`
- `git cherry-pick`
- `rm -rf`
- `sudo`
- `mkfs`
- `dd ... of=`
- `chmod 777`
- **Any command NOT in allowlist** → DENIED

### VIBE Mode

**✅ ALLOWED:**
- **All commands** (except catastrophic ones below)

**❌ BLOCKED (Catastrophic only):**
- `rm -rf /` (deleting root)
- `sudo rm` (with sudo)
- `mkfs.` (formatting disks)

---

## 3. SHELL METACHARACTERS (BOTH MODES)

**❌ BLOCKED IN BOTH DEV AND VIBE:**
- `$(...)` - Command substitution
- `` `...` `` - Backtick substitution
- `;` - Command chaining
- `&` - Background execution
- `|` - Pipes
- `<` / `>` - Redirects
- `\n` / `\r` - Newlines
- `sh -c` / `bash -c` / `cmd /c` / `powershell -Command`
- `eval`

**✅ ALLOWED:**
- Plain `$VAR` - Environment variables (e.g., `echo $PWD`)

**Why:** Prevents command chaining, injection, and bypasses regardless of mode.

---

## 4. MCP TOOLS

### DEV Mode

**✅ ALLOWED:**
- `mcp__vibeswitch__submit_patch` - Submit patch for approval
- `mcp__vibeswitch__apply_patch` - Apply approved patch (requires token)

**❌ BLOCKED:**
- **ALL other MCP tools** from any server
- Must verify server identity matches `mcp-server.json`
- Server name must match expected value

**Enforcement:** `beforeMCPExecution` hook denies all except verified vibeswitch server.

### VIBE Mode

**✅ ALLOWED:**
- **All MCP tools** from all servers
- No restrictions

---

## 5. FILE EDIT AUTO-REVERT

### DEV Mode

**Auto-Revert Enabled (default):**
- ✅ Git-tracked files → **AUTO-REVERTED** immediately
- ⚠️ New/untracked files → **Modal warning** (can't revert)

**Configuration:**
```json
{
  "vibeswitch.autoRevertUnapprovedEdits": true  // default
}
```

**Visual Feedback:**
1. Status bar flash: Red "🛡️ BLOCKED" (3 seconds)
2. Notification: "⛔ BLOCKED - auto-reverted" (4 seconds)
3. File opens automatically
4. Yellow highlight on first line (3 seconds)

### VIBE Mode

**Auto-Revert:**
- ❌ **DISABLED** - No auto-revert in VIBE mode
- Edits are allowed and not reverted

---

## 6. APPROVAL WORKFLOW

### DEV Mode

**MCP Patch Workflow:**
1. Agent calls `mcp__vibeswitch__submit_patch`
2. Extension shows diff preview in UI
3. User clicks "Approve" or "Reject"
4. If approved:
   - Extension generates Ed25519-signed token
   - Token scoped to `{requestId, filePath, patchHash}`
   - Token expires in 60 seconds
   - Single-use (consumed after apply)
5. Agent calls `mcp__vibeswitch__apply_patch` with token
6. MCP server verifies token signature and scope
7. Patch applied atomically

**Built-in Edit Workflow:**
1. Agent uses `Write`/`StrReplace`/`Edit`
2. `afterFileEdit` hook fires
3. Extension detects alert
4. If git-tracked → **AUTO-REVERTED**
5. User sees visual feedback

### VIBE Mode

**MCP Patch Workflow:**
1. Agent calls `mcp__vibeswitch__submit_patch`
2. Extension auto-approves (no user interaction)
3. Agent calls `mcp__vibeswitch__apply_patch` (no token needed)
4. Patch applied immediately

**Built-in Edit Workflow:**
1. Agent uses `Write`/`StrReplace`/`Edit`
2. Edit applied immediately
3. No detection, no revert, no approval needed

---

## 7. HOOKS CONFIGURATION

### DEV Mode

**Hooks Active:**
- `beforeSubmitPrompt` → Injects DEV mode context
- `beforeShellExecution` → Enforces allowlist
- `beforeMCPExecution` → Blocks all except vibeswitch
- `afterFileEdit` → Detects and triggers auto-revert

**Hooks.json Protection:**
- Extension watches `.cursor/hooks.json`
- If tampered → Auto-restored atomically
- Mode flipped to DEV
- Audit logged

### VIBE Mode

**Hooks Active:**
- `beforeSubmitPrompt` → Injects VIBE mode context
- `beforeShellExecution` → Blocks only catastrophic commands
- `beforeMCPExecution` → Allows all
- `afterFileEdit` → No action (edits allowed)

---

## 8. SECURITY GUARANTEES

### DEV Mode

| Guarantee | Method |
|-----------|--------|
| No file edits without approval | MCP token required OR auto-revert |
| No dangerous shell commands | Strict allowlist |
| No other MCP tools | Server identity verification |
| No hooks tampering | Auto-restore + flip to DEV |
| No token forgery | Ed25519 signatures |
| No token replay | SQLite consumed tracking |

### VIBE Mode

| Guarantee | Method |
|-----------|--------|
| No catastrophic commands | Blocklist (rm -rf /, sudo rm, mkfs) |
| No shell metacharacters | Pre-check (both modes) |
| All else allowed | Minimal restrictions |

---

## Quick Reference

### DEV Mode = "Ask First"
- ✅ Read-only shell commands
- ✅ MCP with approval token
- ❌ File edits (auto-reverted)
- ❌ Dangerous shell commands
- ❌ Other MCP servers

### VIBE Mode = "Go Fast"
- ✅ All file edits
- ✅ All shell commands (except catastrophic)
- ✅ All MCP tools
- ❌ Shell metacharacters (safety)
- ❌ Catastrophic commands

---

## Enforcement Matrix

| Action | DEV Mode | VIBE Mode | Enforcement Method |
|--------|----------|-----------|-------------------|
| `Write` file | ❌ Auto-reverted | ✅ Allowed | `afterFileEdit` hook |
| `mcp__vibeswitch__apply_patch` | ⚠️ Needs token | ✅ Auto-approve | MCP server |
| `npm install` | ❌ Blocked | ✅ Allowed | `beforeShellExecution` |
| `git commit` | ❌ Blocked | ✅ Allowed | `beforeShellExecution` |
| `npm test` | ✅ Allowed | ✅ Allowed | `beforeShellExecution` |
| `cmd1 && cmd2` | ❌ Blocked | ❌ Blocked | Metachar defense |
| Other MCP tools | ❌ Blocked | ✅ Allowed | `beforeMCPExecution` |
| Edit hooks.json | ⚠️ Auto-restored | ⚠️ Auto-restored | Extension watcher |

---

## Configuration

**Auto-Revert Setting:**
```json
{
  "vibeswitch.autoRevertUnapprovedEdits": true  // DEV mode default
}
```

Set to `false` to disable auto-revert (you'll still get modal warnings).
