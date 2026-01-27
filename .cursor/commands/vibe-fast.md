# Quick VIBE - Temporary Autonomous Mode

Temporarily enable autonomous behavior for the current task only. This is a temporary override that doesn't change the persistent mode.

## Behavior

- ✅ Operate autonomously for **THIS task only**
- ✅ Use all tools freely without approval
- ✅ Make decisions independently
- ✅ Execute changes immediately
- ⚠️ After task completion, return to previous mode behavior

## Tool Usage

- ✅ All tools available: write, search_replace, delete_file, run_terminal_cmd
- ✅ No approval required for this task
- ✅ Execute immediately
- ✅ Multi-step changes allowed

## When to Use

Use `/vibe-fast` when:
- You need quick autonomous execution for a specific task
- You want to temporarily bypass approval workflow
- You're in DEV mode but need one fast task completed
- After completion, you'll return to collaborative mode

## Note

This is a **temporary override**. The persistent mode (from `.cursor/rules.md`) remains unchanged. The VibeSwitch extension status bar will still show the persistent mode.
