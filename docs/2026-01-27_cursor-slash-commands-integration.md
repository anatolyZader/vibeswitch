# Using Cursor Custom Slash Commands for VibeSwitch

**Date:** January 27, 2026  
**Purpose:** Guide on leveraging Cursor's native custom slash commands feature to achieve VibeSwitch's mode-switching goals

---

## Overview

Cursor has removed custom modes and replaced them with **custom slash commands**. This provides a new way to achieve VibeSwitch's goals of switching between autonomous (VIBE) and collaborative (DEV) AI collaboration modes.

### What Changed in Cursor

- ❌ **Removed:** Custom modes (specialized workflows with specific tool combinations)
- ✅ **New:** Custom slash commands (reusable workflows triggered with `/` prefix)

### Key Benefits for VibeSwitch

1. **Native Integration:** Uses Cursor's built-in command system
2. **Team Sharing:** Commands can be shared via team commands or `.cursor/commands/` directory
3. **Tool Restrictions:** Can specify which tools to use directly in command prompts
4. **Workflow Encapsulation:** Each mode becomes a reusable command

---

## Implementation Strategy

### Option 1: Commands as Mode Triggers (Recommended)

Create slash commands that switch modes AND apply mode-specific instructions:

```
/vibe  → Switches to VIBE mode + applies autonomous behavior
/dev   → Switches to DEV mode + applies collaborative behavior
```

### Option 2: Commands as Behavior Overrides

Keep existing rules.md switching, but add commands for specific workflows:

```
/dev-review   → Collaborative review mode for current task
```

### Option 3: Hybrid Approach

Combine both:
- Use rules.md for persistent mode state
- Use slash commands for temporary behavior overrides or specific workflows

---

## Creating Custom Slash Commands

### Directory Structure

Create commands in `.cursor/commands/` directory:

```
.cursor/
├── commands/
│   ├── vibe.md          # VIBE mode command
│   └── dev.md           # DEV mode command
├── rules.md             # Current active rules (existing)
├── rules.vibe.md        # VIBE mode rules (existing)
└── rules.dev.md         # DEV mode rules (existing)
```

### Command File Format

Each command file in `.cursor/commands/` should contain:

1. **Command name** (filename without .md extension)
2. **Description** (what the command does)
3. **Instructions** (behavioral guidelines)
4. **Tool restrictions** (which tools to use/avoid)

---

## Example Command Implementations

### 1. `/vibe` Command

**File:** `.cursor/commands/vibe.md`

```markdown
# VIBE Mode - Autonomous Agent

Switch to VIBE mode and operate autonomously.

## Behavior
- You are in **task execution mode**, not conversational mode
- **Proceed with changes immediately** - don't ask "Should I do X?"
- **Make decisions autonomously** - don't wait for permission
- **Implement changes immediately** using available tools
- Only pause for critical, irreversible operations (deletions, deployments)

## Tool Usage
- ✅ Use all available tools (write, edit, delete, run terminal commands)
- ✅ Make multi-step changes in one go
- ✅ Apply edits automatically without asking to confirm each change

## Restrictions
- ❌ Do NOT ask for approval before making changes
- ❌ Do NOT show plans and wait - execute them
- ❌ Do NOT batch changes and wait for approval

## Mode Switch
After applying this behavior, also switch the workspace to VIBE mode by updating `.cursor/rules.md` to match `.cursor/rules.vibe.md` content.
```

### 2. `/dev` Command

**File:** `.cursor/commands/dev.md`

```markdown
# DEV Mode - Collaborative Development

Switch to DEV mode and operate collaboratively with step-by-step approval.

## Behavior
- You are in **CONVERSATIONAL/ADVISORY mode**, NOT execution mode
- Focus on **explaining and suggesting** NOT doing
- Say "I could..." NOT "I will..."
- Say "Would you like me to..." NOT "I'll do..."

## Tool Usage Restrictions
- ✅ Reading files: Allowed
- ✅ Searching code: Allowed
- ✅ Explaining concepts: Allowed
- ⚠️ File edits: Ask for approval first
- ⚠️ Shell commands: Only read-only commands allowed
- ❌ Batch operations: NOT allowed without approval

## Mandatory Workflow
For EVERY change:
1. ANALYZE → Understand the request
2. EXPLAIN → Describe what you would change (be specific)
3. SHOW → Present the exact code/changes
4. ASK → "Should I proceed with this change?"
5. WAIT → Stop and wait for explicit approval
6. EXECUTE → Only if user says yes

## Tool Restrictions
Use only these tools for modifications:
- `read_file` - ✅ Allowed
- `codebase_search` - ✅ Allowed
- `grep` - ✅ Allowed
- `write` - ⚠️ Ask first
- `search_replace` - ⚠️ Ask first
- `run_terminal_cmd` - ⚠️ Read-only commands only

## Mode Switch
After applying this behavior, also switch the workspace to DEV mode by updating `.cursor/rules.md` to match `.cursor/rules.dev.md` content.
```


---

## Integration with Existing VibeSwitch Extension

### How Commands Work with Extension

The VibeSwitch extension can:

1. **Detect command usage** (if Cursor exposes this via API)
2. **Sync with mode state** - When `/vibe` or `/dev` is used, update extension state
3. **Provide visual feedback** - Show current mode in status bar
4. **Track usage** - Log when commands are used

### Extension Integration Points

```javascript
// In extension.js or command handlers
// When user types /vibe or /dev in Cursor chat:

1. Detect command usage (if possible via Cursor API)
2. Call modeService.switchToMode('vibe' or 'dev')
3. Update status bar indicator
4. Sync to .cursor/rules.md
5. Track in usage statistics
```

### Current Architecture Compatibility

The existing VibeSwitch architecture already supports this:

- ✅ **ModeManager** - Can sync mode state
- ✅ **ModeService** - Can switch between modes
- ✅ **Status Bar** - Shows current mode
- ✅ **Rules.md switching** - Already implemented

**What's New:**
- Add command file creation/management
- Optionally detect command usage (if Cursor API supports it)
- Provide UI to create/edit commands

---

## Command Creation Workflow

### Manual Creation

1. Create `.cursor/commands/` directory
2. Create command files (e.g., `vibe.md`, `dev.md`)
3. Add instructions following the format above
4. Test commands by typing `/vibe` or `/dev` in Cursor chat

### Programmatic Creation (Extension Feature)

The VibeSwitch extension could provide:

```javascript
// Command: vibeswitch.createCommand
async function createModeCommand(mode) {
    const commandsDir = path.join(workspaceRoot, '.cursor', 'commands');
    await fsPromises.mkdir(commandsDir, { recursive: true });
    
    const commandFile = path.join(commandsDir, `${mode}.md`);
    const commandContent = generateCommandContent(mode); // Based on rules.{mode}.md
    
    await fsPromises.writeFile(commandFile, commandContent, 'utf8');
}
```

---

## Tool Restriction Examples

### Restricting Tools in Commands

According to Cursor's documentation, you can limit tools by including instructions in the command prompt:

**Example for DEV mode:**
```markdown
## Tool Restrictions

Use only these tools:
- read_file
- codebase_search  
- grep

Do NOT use these tools without explicit approval:
- write
- search_replace
- delete_file
- run_terminal_cmd (except read-only: git status, npm test, etc.)
```

**Example for VIBE mode:**
```markdown
## Tool Usage

Use all available tools freely:
- write, search_replace, delete_file
- run_terminal_cmd
- All MCP tools
- All codebase tools

Proceed autonomously with all operations.
```

---

## Migration Path

### Phase 1: Add Commands (Non-Breaking)

1. ✅ Keep existing rules.md switching mechanism
2. ✅ Add `.cursor/commands/` directory
3. ✅ Create `/vibe` and `/dev` commands
4. ✅ Commands work alongside existing mode switching

### Phase 2: Enhance Integration

1. Add extension command to create/edit slash commands
2. Optionally detect when commands are used
3. Sync command usage with extension state
4. Track command usage in statistics

### Phase 3: Optional Deprecation

1. If commands become primary interface, consider deprecating status bar switching
2. Keep rules.md for backward compatibility
3. Make commands the recommended way to switch modes

---

## Benefits Over Current Approach

### Current (rules.md switching):
- ✅ Persistent mode state
- ✅ Works automatically
- ❌ Requires file manipulation
- ❌ Less discoverable
- ❌ Can't easily override temporarily

### New (slash commands):
- ✅ Native Cursor integration
- ✅ Discoverable via `/` autocomplete
- ✅ Can work alongside rules.md
- ✅ Team-shareable via `.cursor/commands/`
- ✅ Can include tool restrictions directly
- ✅ Can be temporary overrides

### Best of Both Worlds:
- Use **rules.md** for persistent mode state
- Use **slash commands** for:
  - Quick mode switches
  - Temporary behavior overrides
  - Team-shared workflows
  - Discoverable mode switching

---

## Example User Workflows

### Workflow 1: Quick Mode Switch

```
User types: /vibe
→ Command applies VIBE behavior
→ Extension detects (if possible) and updates status bar
→ Rules.md synced to rules.vibe.md
→ User can now work autonomously
```

### Workflow 2: Team Collaboration

```
Team member creates /review command
→ Stored in .cursor/commands/review.md
→ Shared via git
→ All team members can use /review for code review workflow
```

---

## Next Steps

1. **Create command files** - Add `.cursor/commands/vibe.md` and `.cursor/commands/dev.md`
2. **Test commands** - Try `/vibe` and `/dev` in Cursor chat
3. **Enhance extension** (optional) - Add command management features
4. **Document for users** - Update VibeSwitch documentation

---

## References

- [Cursor Commands Documentation](https://cursor.sh/docs/commands) (check Cursor docs for latest)
- VibeSwitch extension architecture
- Existing rules.md files (rules.vibe.md, rules.dev.md)

---

## Questions to Consider

1. **Should commands replace rules.md switching?**
   - Recommendation: No, use both - rules.md for persistence, commands for discoverability

2. **Can extension detect command usage?**
   - Need to check Cursor API - may require polling or event listening

3. **Should commands be auto-created by extension?**
   - Could be a feature: "Create slash commands from current rules"

4. **How to handle team commands vs local commands?**
   - Team commands: `.cursor/commands/` (in repo)
   - User commands: Could be in user settings or separate location
