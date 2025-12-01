# VibeSwitch - Visual Overview

## What You'll See

### 1. Status Bar (Bottom Right)

```
┌────────────────────────────────────────────────────────────────┐
│ File Edit View ...                                             │
│                                                                │
│   Your code here...                                            │
│                                                                │
│                                                                │
└────────────────────────────────────────────────────────────────┘
 Status Bar:  UTF-8  LF  JavaScript  🔔 0  ⚙️ Mode?  👤 User
                                          ↑
                                    VibeSwitch Here!
```

**What you see:**
- `⚙️ Mode?` - When no mode is set
- `⚡ VIBE` - When in VIBE mode (with orange/warning background)
- `📚 DEV` - When in DEV mode (normal background)

**Hover tooltip shows:**
```
AI Agent: VIBE Mode (Autonomous)
Click to switch modes
```

### 2. Quick Pick Menu (When Clicked)

```
┌────────────────────────────────────────────────────────────────┐
│ VibeSwitch - Change AI Agent Behavior                     × │
├────────────────────────────────────────────────────────────────┤
│ Select AI Agent Mode                                           │
├────────────────────────────────────────────────────────────────┤
│ ⚡ VIBE Mode                                                   │
│   Autonomous - AI works independently with minimal             │
│   interruptions                                                │
│   Best for: Building features quickly, refactoring,            │
│   prototyping                                                  │
├────────────────────────────────────────────────────────────────┤
│ 📚 DEV Mode                                                    │
│   Collaborative - AI explains and asks for approval            │
│   Best for: Learning, understanding changes, careful review    │
├────────────────────────────────────────────────────────────────┤
│ ℹ️ Current: vibe                                               │
│   View current mode                                            │
└────────────────────────────────────────────────────────────────┘
```

### 3. Notification After Switch

```
┌────────────────────────────────────────────────────────┐
│ ⚡ Switched to VIBE mode                               │
│                                                         │
│  [Reload Window]  [Dismiss]                            │
└────────────────────────────────────────────────────────┘
```

### 4. Command Palette Integration

Press `Cmd+Shift+P` or `Ctrl+Shift+P`:

```
┌────────────────────────────────────────────────────────────────┐
│ > vibeswitch                                                   │
├────────────────────────────────────────────────────────────────┤
│ VibeSwitch: Switch AI Agent Mode                              │
│ VibeSwitch: Switch to VIBE Mode (Autonomous)                  │
│ VibeSwitch: Switch to DEV Mode (Collaborative)                │
└────────────────────────────────────────────────────────────────┘
```

## Icons Used

The extension uses VSCode's built-in icon set (Codicons):

| Icon | Name | Used For |
|------|------|----------|
| `$(dashboard)` | Dashboard/Gear | VIBE mode indicator |
| `$(book)` | Book | DEV mode indicator |
| `$(gear)` | Gear | Unknown mode |
| `$(zap)` | Lightning bolt | VIBE in quick pick |
| `$(info)` | Info | Current mode display |

See all available icons: https://microsoft.github.io/vscode-codicons/

## Color Coding

### VIBE Mode
- **Background**: Orange/Warning color (`statusBarItem.warningBackground`)
- **Icon**: `$(dashboard)` - Gear/Dashboard
- **Feel**: Active, energetic, autonomous

### DEV Mode
- **Background**: Default (no special color)
- **Icon**: `$(book)` - Book
- **Feel**: Calm, educational, collaborative

### No Mode
- **Background**: Default
- **Icon**: `$(gear)` - Gear
- **Feel**: Neutral, needs configuration

## User Flow Diagram

```
┌─────────────┐
│   Start     │
│   Cursor    │
└──────┬──────┘
       │
       ↓
┌─────────────────────────────┐
│ Status Bar Shows:           │
│ "⚙️ Mode?" or               │
│ "⚡ VIBE" or "📚 DEV"      │
└──────┬──────────────────────┘
       │
       │ (User clicks)
       ↓
┌─────────────────────────────┐
│ Quick Pick Opens            │
│ - VIBE Mode                 │
│ - DEV Mode                  │
│ - Current: X                │
└──────┬──────────────────────┘
       │
       │ (User selects mode)
       ↓
┌─────────────────────────────┐
│ Extension switches files:   │
│ 1. .cursorrules             │
│ 2. .vscode/settings.json    │
└──────┬──────────────────────┘
       │
       ↓
┌─────────────────────────────┐
│ Notification appears:       │
│ "✓ Switched to X mode"      │
│ [Reload Window] [Dismiss]   │
└──────┬──────────────────────┘
       │
       │ (Optional)
       ↓
┌─────────────────────────────┐
│ Window reloads              │
│ Settings take effect        │
└─────────────────────────────┘
```

## Interaction Examples

### Example 1: First Time User

1. **Opens Cursor** → Sees `⚙️ Mode?` in status bar
2. **Clicks it** → Sees warning "Missing .cursorrules.vibe"
3. **Clicks "Yes"** to create defaults
4. **Selects VIBE** → Mode files created and switched
5. **Status bar** → Now shows `⚡ VIBE`

### Example 2: Switching Modes

1. **Working in VIBE** → Status bar shows `⚡ VIBE`
2. **Wants to learn** → Clicks status bar
3. **Selects DEV** → Quick switch happens
4. **Status bar** → Now shows `📚 DEV`
5. **Clicks "Reload Window"** → Full settings applied

### Example 3: Keyboard Power User

1. **Press `Cmd+Shift+M`** → Quick pick opens instantly
2. **Arrow keys** to select mode
3. **Press Enter** → Mode switches
4. **Back to coding** → Minimal interruption

## Settings UI

In VSCode/Cursor Settings (searchable):

```
┌────────────────────────────────────────────────────────────┐
│ Search settings: vibeswitch                                │
├────────────────────────────────────────────────────────────┤
│                                                             │
│ VibeSwitch                                                  │
│                                                             │
│ ☑ Show In Status Bar                                       │
│   Show mode indicator in status bar                        │
│                                                             │
│ ☐ Auto Reload                                              │
│   Automatically reload window after switching modes        │
│                                                             │
│ Rules Path                                                  │
│ [                                                    ]      │
│ Custom path to .cursorrules files (leave empty for         │
│ workspace root)                                             │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

## File Changes Preview

When you switch modes, these files change:

### Before Switch
```
project/
├── .cursorrules          (contains DEV mode instructions)
└── .vscode/
    └── settings.json     (contains DEV mode settings)
```

### After Switching to VIBE
```
project/
├── .cursorrules          (NOW contains VIBE mode instructions) ✓
└── .vscode/
    └── settings.json     (NOW contains VIBE mode settings) ✓
```

The original templates remain unchanged:
```
project/
├── .cursorrules.vibe     (template - unchanged)
├── .cursorrules.dev      (template - unchanged)
└── .vscode/
    ├── settings.vibe.json    (template - unchanged)
    └── settings.dev.json     (template - unchanged)
```

## Real-World Usage

### Morning Routine
```
☕ Morning coffee
👨‍💻 Open Cursor
📚 Status bar: DEV mode
💬 Chat: "Explain what changed overnight"
📖 AI explains in detail
```

### Deep Work Session
```
🎯 Ready to build
⚡ Click status bar → Switch to VIBE
🚀 Chat: "Implement user settings feature"
🤖 AI builds entire feature autonomously
✅ Done in 10 minutes
```

### Code Review
```
👀 Time to review
📚 Switch to DEV mode
💬 "Review the user settings implementation"
🔍 AI explains each change and potential issues
```

## Accessibility

- **Keyboard accessible**: `Cmd/Ctrl+Shift+M` shortcut
- **Screen reader friendly**: Clear labels and tooltips
- **Color blind friendly**: Uses icons, not just colors
- **Quick access**: Status bar always visible

## Extension Marketplace Look (Future)

When published, users will see:

```
┌─────────────────────────────────────────────────────────────┐
│  [Icon]  VibeSwitch - AI Agent Mode Switcher               │
│                                                              │
│  ★★★★★ (5 ratings)  10K installs  Updated: Today           │
│                                                              │
│  Switch between VIBE (autonomous) and DEV (collaborative)   │
│  modes for Cursor AI agent with a single click!             │
│                                                              │
│  [Install]                                                  │
└─────────────────────────────────────────────────────────────┘
```


