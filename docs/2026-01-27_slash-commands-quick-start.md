# VibeSwitch Slash Commands - Quick Start

**Date:** January 27, 2026

---

## What Are Slash Commands?

Cursor's custom slash commands let you trigger reusable workflows with a `/` prefix. VibeSwitch now provides commands for switching between VIBE and DEV modes.

---

## Available Commands

### `/vibe` - Autonomous Mode
Fast, autonomous AI collaboration with minimal interruptions.

**When to use:**
- You want AI to work independently
- Fast iteration needed
- Multi-step tasks should complete automatically

**Behavior:**
- ✅ AI proceeds with changes immediately
- ✅ No approval required
- ✅ All tools available freely

---

### `/dev` - Collaborative Mode
Slow, collaborative AI assistance with step-by-step approval.

**When to use:**
- You want to review changes before applying
- Step-by-step collaboration needed
- Learning from the process

**Behavior:**
- ⚠️ AI asks before making changes
- ⚠️ Shows changes before applying
- ⚠️ Requires approval for modifications

---

## How to Use

1. **Open Cursor chat** (Cmd/Ctrl + L)
2. **Type `/`** to see available commands
3. **Select command** (`/vibe` or `/dev`)
4. **Command applies** the mode behavior
5. **VibeSwitch extension** syncs the mode state (if running)

---

## Integration with VibeSwitch Extension

The slash commands work alongside the VibeSwitch extension:

- **Commands** = Quick, discoverable mode switching
- **Extension** = Persistent mode state, status bar, awareness tracking

### How They Work Together

1. **User types `/vibe`** in Cursor chat
2. **Command applies** VIBE behavior instructions
3. **Extension detects** mode change (if possible via API)
4. **Extension updates** `.cursor/rules.md` to match
5. **Status bar** shows current mode
6. **Awareness tracking** continues in background

---

## File Locations

Commands are stored in:
```
.cursor/commands/
├── vibe.md          # VIBE mode command
└── dev.md           # DEV mode command
```

These files are part of your workspace and can be:
- ✅ Committed to git (team sharing)
- ✅ Customized per project
- ✅ Extended with additional commands

---

## Creating Custom Commands

You can create your own commands by adding `.md` files to `.cursor/commands/`:

**Example: `/review` command**
```markdown
# Code Review Mode

Focus on reviewing code changes, suggesting improvements, and identifying issues.

## Behavior
- Analyze code changes
- Suggest improvements
- Identify potential bugs
- Ask clarifying questions
```

Save as `.cursor/commands/review.md` and use with `/review`.

---

## Tool Restrictions in Commands

Commands can specify which tools to use. Example from `/dev`:

```markdown
### Tool Restrictions

**Allowed without approval:**
- read_file, codebase_search, grep

**Requires approval:**
- write, search_replace, delete_file
```

This gives you fine-grained control over AI behavior per command.

---

## Best Practices

1. **Use `/vibe`** for fast development and iteration
2. **Use `/dev`** for careful, collaborative work
3. **Create custom commands** for project-specific workflows
4. **Share commands** with your team via git

---

## Troubleshooting

### Commands not appearing?
- Check that `.cursor/commands/` directory exists
- Verify command files are `.md` format
- Restart Cursor if needed

### Mode not syncing with extension?
- Extension may need to detect command usage (check Cursor API)
- Manually switch mode via status bar if needed
- Commands work independently of extension

### Want to customize commands?
- Edit files in `.cursor/commands/`
- Follow the format of existing commands
- Test by typing `/` in Cursor chat

---

## Next Steps

1. ✅ Try `/vibe` and `/dev` commands
2. ✅ Check VibeSwitch status bar for mode indicator
3. ✅ Create custom commands for your workflows
4. ✅ Share commands with your team

---

## See Also

- [Full Integration Guide](./2026-01-27_cursor-slash-commands-integration.md)
- VibeSwitch extension documentation
- Cursor Commands documentation
