# VibeSwitch - Cursor Settings Comparison

## 📊 Complete Settings Comparison Table

This document provides an **exact, line-by-line comparison** of all Cursor IDE settings that change between VIBE and DEV modes.

---

## 🔄 Settings That Change Between Modes


| Setting Key | ⚡ VIBE Mode Value | 📚 DEV Mode Value | Description |
|-------------|-------------------|-------------------|-------------|
| `cursor.chat.defaultMode` | `"agent"` | `"ask"` | Default chat mode when opening Cursor chat |
| `cursor.agent.requireApproval` | `false` | `true` | Whether agent actions require user approval before execution |
| `cursor.agent.autoApplyEdits` | `true` | `false` | Automatically apply code edits without confirmation |
| `cursor.ai.autoApply` | `true` | `false` | Auto-apply AI suggestions to code |
| `files.autoSave` | `"afterDelay"` | `"afterDelay"` | Auto-save mode (same in both) |
| `files.autoSaveDelay` | `1000` | `3000` | Milliseconds delay before auto-saving files |

---

## 📝 Exact JSON Files

### ⚡ VIBE Mode Settings (`settings.vibe.json`)

```json
{
  "cursor.chat.defaultMode": "agent",
  "cursor.agent.requireApproval": false,
  "cursor.agent.autoApplyEdits": true,
  "cursor.ai.autoApply": true,
  "files.autoSave": "afterDelay",
  "files.autoSaveDelay": 1000
}
```

### 📚 DEV Mode Settings (`settings.dev.json`)

```json
{
  "cursor.chat.defaultMode": "ask",
  "cursor.agent.requireApproval": true,
  "cursor.agent.autoApplyEdits": false,
  "cursor.ai.autoApply": false,
  "files.autoSave": "afterDelay",
  "files.autoSaveDelay": 3000
}
```

---

## 🎯 Behavioral Impact Analysis

### Setting 1: `cursor.chat.defaultMode`

| Mode | Value | Behavior |
|------|-------|----------|
| VIBE | `"agent"` | Chat opens in **Agent Mode** by default - AI can take autonomous actions |
| DEV | `"ask"` | Chat opens in **Ask Mode** by default - AI provides answers and suggestions only |

**Impact Level:** 🔴 **HIGH** - Fundamentally changes how AI interacts with you

---

### Setting 2: `cursor.agent.requireApproval`

| Mode | Value | Behavior |
|------|-------|----------|
| VIBE | `false` | AI executes actions **immediately without asking** |
| DEV | `true` | AI **shows proposed actions and waits** for your approval |

**Impact Level:** 🔴 **CRITICAL** - This is the most important difference

**Example:**
- **VIBE Mode:** AI says "I'll implement the login function" → *Immediately writes code*
- **DEV Mode:** AI says "Should I implement the login function?" → *Waits for your "Yes"*

---

### Setting 3: `cursor.agent.autoApplyEdits`

| Mode | Value | Behavior |
|------|-------|----------|
| VIBE | `true` | Code changes are **automatically applied** to your files |
| DEV | `false` | Code changes are **shown as diffs** for you to accept/reject |

**Impact Level:** 🔴 **HIGH** - Controls whether changes happen automatically

**Example:**
- **VIBE Mode:** AI edits file → Changes appear in your editor immediately
- **DEV Mode:** AI edits file → You see a diff and click "Accept" or "Reject"

---

### Setting 4: `cursor.ai.autoApply`

| Mode | Value | Behavior |
|------|-------|----------|
| VIBE | `true` | AI suggestions are **automatically inserted** into code |
| DEV | `false` | AI suggestions **require manual acceptance** (Tab key) |

**Impact Level:** 🟡 **MEDIUM** - Affects inline completions and suggestions

**Example:**
- **VIBE Mode:** AI suggests code → Appears automatically as you type
- **DEV Mode:** AI suggests code → Shown in grey, press Tab to accept

---

### Setting 5: `files.autoSave`

| Mode | Value | Behavior |
|------|-------|----------|
| VIBE | `"afterDelay"` | Files save automatically after a delay |
| DEV | `"afterDelay"` | Files save automatically after a delay |

**Impact Level:** 🟢 **NONE** - Same in both modes

---

### Setting 6: `files.autoSaveDelay`

| Mode | Value | Behavior |
|------|-------|----------|
| VIBE | `1000` (1 second) | **Faster saves** - changes persist quickly |
| DEV | `3000` (3 seconds) | **Slower saves** - gives you time to review before save |

**Impact Level:** 🟡 **LOW-MEDIUM** - Affects how quickly changes are persisted

**Rationale:**
- **VIBE Mode:** Fast saves match the autonomous, rapid-iteration workflow
- **DEV Mode:** Slower saves give you time to review and undo if needed

---

## 📖 Settings Not Changed

These Cursor settings remain **unchanged** when switching modes:

- `cursor.editor.*` - All editor preferences
- `cursor.theme.*` - Theme settings
- `cursor.privacy.*` - Privacy settings
- `cursor.telemetry.*` - Telemetry settings
- `workbench.*` - Workbench configurations
- `editor.*` - Standard VSCode editor settings (unless explicitly overridden)

---

## 🔍 How Settings Are Applied

### File Structure

```
your-project/
├── .cursorrules              ← Active rules (copied from template)
├── .cursorrules.vibe         ← VIBE mode template
├── .cursorrules.dev          ← DEV mode template
└── .vscode/
    ├── settings.json         ← Active settings (copied from template)
    ├── settings.vibe.json    ← VIBE mode settings template
    └── settings.dev.json     ← DEV mode settings template
```

### Switching Process

When you switch from **DEV** to **VIBE** mode:

1. Extension copies `settings.vibe.json` → `settings.json`
2. Extension copies `.cursorrules.vibe` → `.cursorrules`
3. Cursor IDE detects `settings.json` change
4. New settings take effect (may require window reload)

---

## 🧪 Testing Settings Changes

### How to Verify Settings Are Applied

1. **Before switch:** Check current settings
   ```bash
   cat .vscode/settings.json
   ```

2. **Switch mode:** Click status bar → Select mode

3. **After switch:** Check updated settings
   ```bash
   cat .vscode/settings.json
   ```

4. **Compare:** Should match the exact values above

### Expected Diff When Switching to VIBE

```diff
  {
-   "cursor.chat.defaultMode": "ask",
+   "cursor.chat.defaultMode": "agent",
-   "cursor.agent.requireApproval": true,
+   "cursor.agent.requireApproval": false,
-   "cursor.agent.autoApplyEdits": false,
+   "cursor.agent.autoApplyEdits": true,
-   "cursor.ai.autoApply": false,
+   "cursor.ai.autoApply": true,
    "files.autoSave": "afterDelay",
-   "files.autoSaveDelay": 3000
+   "files.autoSaveDelay": 1000
  }
```

---

## 💡 Real-World Usage Scenarios

### Scenario 1: Quick Prototyping
**Use:** ⚡ VIBE Mode  
**Why:** Fast iteration, AI builds autonomously, changes apply immediately  
**Settings Impact:** All auto-apply settings enabled, 1s save delay

### Scenario 2: Production Code Review
**Use:** 📚 DEV Mode  
**Why:** Careful review, approve each change, understand what's happening  
**Settings Impact:** All approvals required, 3s save delay for review time

### Scenario 3: Learning New Framework
**Use:** 📚 DEV Mode  
**Why:** AI explains each step, you review and learn from changes  
**Settings Impact:** Manual approval lets you understand before applying

### Scenario 4: Refactoring Large Codebase
**Use:** ⚡ VIBE Mode  
**Why:** AI handles repetitive changes across many files autonomously  
**Settings Impact:** Auto-apply speeds up bulk operations

---

## 🔒 Security Note

These settings are **workspace-specific**, meaning:
- ✅ Only affect the current project
- ✅ Don't change global Cursor settings
- ✅ Isolated per workspace
- ✅ Can be committed to git (project team settings)

---

## 📈 Performance Impact

| Aspect | VIBE Mode | DEV Mode |
|--------|-----------|----------|
| **Coding Speed** | ⚡ Very Fast | 🐢 Slower (by design) |
| **CPU Usage** | 📊 Same | 📊 Same |
| **Memory Usage** | 💾 Same | 💾 Same |
| **File I/O** | 💿 More (faster saves) | 💿 Less (slower saves) |
| **User Clicks Required** | 1-2 per task | 5-10 per task |

---

## 🎓 Educational Value

| Learning Aspect | VIBE Mode | DEV Mode |
|-----------------|-----------|----------|
| **Code Understanding** | ⭐⭐ Low | ⭐⭐⭐⭐⭐ High |
| **Pattern Recognition** | ⭐⭐⭐ Medium | ⭐⭐⭐⭐⭐ High |
| **AI Reasoning** | ⭐⭐ Hidden | ⭐⭐⭐⭐⭐ Visible |
| **Best Practices** | ⭐⭐⭐ Implicit | ⭐⭐⭐⭐⭐ Explicit |

**Recommendation:** Use DEV mode when learning, VIBE mode when building.

---

## 📚 Related Documentation

- [README.md](README.md) - Extension overview
- [DEVELOPMENT.md](DEVELOPMENT.md) - Development guide
- [TESTING.md](TESTING.md) - Testing procedures
- [VISUAL-OVERVIEW.md](VISUAL-OVERVIEW.md) - UI/UX details

---

**Last Updated:** 2024-12-03  
**Extension Version:** 1.0.0










