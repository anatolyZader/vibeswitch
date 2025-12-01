# VibeSwitch - AI Agent Mode Switcher for Cursor

Switch between **VIBE Mode** (autonomous AI) and **DEV Mode** (collaborative AI) with a single click!

![VibeSwitch Demo](images/demo.gif)

## Features

- 🎚️ **Status Bar Integration** - See your current mode at a glance
- ⚡ **Quick Mode Switching** - Click to switch between modes instantly
- 🎨 **Visual Indicators** - Different colors and icons for each mode
- ⌨️ **Keyboard Shortcut** - Press `Cmd+Shift+M` (Mac) or `Ctrl+Shift+M` (Windows/Linux)
- 🔄 **Auto-Reload** - Optionally reload window after switching (configurable)
- 📁 **Workspace-Aware** - Detects and manages mode files in your workspace

## Quick Start

1. Install the extension
2. Look at the bottom-right status bar - you'll see the gear icon `⚙️`
3. Click on it to choose between:
   - **⚡ VIBE Mode** - Autonomous AI that works independently
   - **📚 DEV Mode** - Collaborative AI that explains everything

## Modes Explained

### VIBE Mode (Autonomous)
- AI makes decisions independently
- Minimal interruptions and approvals
- Perfect for building features quickly
- Auto-apply suggestions enabled
- Best for: Prototyping, refactoring, time-sensitive work

### DEV Mode (Collaborative)  
- AI asks for approval before changes
- Detailed explanations provided
- Step-by-step collaboration
- Educational approach
- Best for: Learning, code review, understanding changes

## Usage

### From Status Bar
Click the status bar item showing your current mode:
- `$(dashboard) VIBE` - Currently in VIBE mode
- `$(book) DEV` - Currently in DEV mode
- `$(gear) Mode?` - No mode set

### From Command Palette
Press `Cmd/Ctrl+Shift+P` and type:
- `VibeSwitch: Switch AI Agent Mode` - Show mode picker
- `VibeSwitch: Switch to VIBE Mode` - Direct switch to VIBE
- `VibeSwitch: Switch to DEV Mode` - Direct switch to DEV

### Keyboard Shortcut
Press `Cmd+Shift+M` (Mac) or `Ctrl+Shift+M` (Windows/Linux) to open the mode picker.

## Configuration

Open Settings (`Cmd/Ctrl+,`) and search for "VibeSwitch":

```json
{
  // Show/hide mode indicator in status bar
  "vibeswitch.showInStatusBar": true,
  
  // Automatically reload window after switching modes
  "vibeswitch.autoReload": false,
  
  // Custom path to .cursorrules files (leave empty for workspace root)
  "vibeswitch.rulesPath": ""
}
```

## How It Works

VibeSwitch manages two types of files in your workspace:

1. **`.cursorrules`** - Instructions for the Cursor AI agent
   - `.cursorrules.vibe` - VIBE mode instructions
   - `.cursorrules.dev` - DEV mode instructions

2. **`.vscode/settings.json`** - IDE and agent configuration
   - `.vscode/settings.vibe.json` - VIBE mode settings
   - `.vscode/settings.dev.json` - DEV mode settings

When you switch modes, the extension copies the appropriate files to the active configuration.

## Requirements

- VSCode 1.80.0 or higher
- Cursor AI (for AI agent features)
- Workspace must have mode configuration files (extension can create defaults)

## Extension Settings

This extension contributes the following settings:

* `vibeswitch.showInStatusBar`: Show/hide the mode indicator in the status bar
* `vibeswitch.autoReload`: Automatically reload the window after switching modes
* `vibeswitch.rulesPath`: Custom path for .cursorrules files

## Known Issues

- Window reload may be required for some settings to take full effect
- First-time setup requires creating mode configuration files

## Release Notes

### 1.0.0

Initial release of VibeSwitch:
- Status bar mode indicator
- Quick pick mode switcher
- Command palette integration
- Keyboard shortcuts
- Auto-reload option

## Contributing

Found a bug or have a feature request? Please open an issue on [GitHub](https://github.com/yourusername/vibeswitch).

## License

MIT License - See LICENSE file for details

---

**Enjoy smoother AI collaboration with VibeSwitch!** ⚡📚


