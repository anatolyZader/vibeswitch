# VibeSwitch Development Guide

## Project Structure

```
vibeswitch-extension/
├── extension.js           # Main extension code
├── package.json          # Extension manifest
├── README.md             # User documentation
├── INSTALLATION.md       # Installation guide
├── CHANGELOG.md          # Version history
├── LICENSE               # MIT License
├── .gitignore           # Git ignore rules
├── .vscodeignore        # Files to exclude from package
├── images/              # Icons and screenshots
│   ├── icon.png         # Extension icon (128x128)
│   └── README.md        # Image requirements
└── DEVELOPMENT.md       # This file
```

## Development Setup

### Prerequisites
- Node.js 16+ installed
- VSCode or Cursor 1.80.0+
- Git

### Initial Setup

```bash
cd vibeswitch-extension

# Install dependencies (if needed in the future)
npm install

# Install packaging tool globally
npm install -g @vscode/vsce
```

## Testing the Extension

### Method 1: F5 Debug Mode

1. Open `vibeswitch-extension` folder in VSCode/Cursor
2. Press `F5` (or Run > Start Debugging)
3. A new "Extension Development Host" window opens
4. In that window, open a project folder
5. Test the extension functionality

### Method 2: Install as VSIX

```bash
# Package the extension
vsce package

# Install the resulting .vsix file
code --install-extension vibeswitch-1.0.0.vsix
```

## Key Extension Components

### 1. Status Bar Item

Located in `extension.js` - `updateStatusBar()` function:

```javascript
statusBarItem.text = '$(dashboard) VIBE';  // Icon + text
statusBarItem.tooltip = 'AI Agent: VIBE Mode...';
statusBarItem.command = 'vibeswitch.switchMode';  // Click handler
```

**Icons used:**
- `$(dashboard)` - VIBE mode (gear/dashboard icon)
- `$(book)` - DEV mode (book icon)
- `$(gear)` - Unknown mode
- `$(zap)` - Lightning bolt (in quick pick)

See [VSCode Codicons](https://microsoft.github.io/vscode-codicons/dist/codicon.html) for more icons.

### 2. Quick Pick Menu

Located in `extension.js` - `showModePicker()` function:

Shows a dropdown with mode options and descriptions.

### 3. Mode Switching Logic

Located in `extension.js` - `switchToMode()` function:

1. Copies `.cursorrules.{mode}` to `.cursorrules`
2. Copies `.vscode/settings.{mode}.json` to `.vscode/settings.json`
3. Updates status bar
4. Optionally reloads window

### 4. Mode Detection

Located in `extension.js` - `detectCurrentMode()` function:

Reads `.cursorrules` and checks for "VIBE MODE" or "DEV MODE" markers.

## Adding New Features

### Add a New Command

1. Register in `package.json`:
```json
{
  "contributes": {
    "commands": [
      {
        "command": "vibeswitch.myNewCommand",
        "title": "My New Feature",
        "category": "VibeSwitch"
      }
    ]
  }
}
```

2. Implement in `extension.js`:
```javascript
context.subscriptions.push(
    vscode.commands.registerCommand('vibeswitch.myNewCommand', myHandler)
);

function myHandler() {
    vscode.window.showInformationMessage('Hello from new command!');
}
```

### Add a New Setting

1. Define in `package.json`:
```json
{
  "configuration": {
    "properties": {
      "vibeswitch.myNewSetting": {
        "type": "boolean",
        "default": true,
        "description": "Description of my setting"
      }
    }
  }
}
```

2. Use in `extension.js`:
```javascript
const config = vscode.workspace.getConfiguration('vibeswitch');
const mySetting = config.get('myNewSetting');
```

### Add a New Mode

To support a third mode (e.g., "HYBRID"):

1. Update `showModePicker()` to include new option
2. Update `detectCurrentMode()` to recognize new marker
3. Update `updateStatusBar()` to show new mode's icon/color
4. Create `.cursorrules.hybrid` and `.vscode/settings.hybrid.json` templates

## Testing Checklist

Before releasing a new version:

- [ ] Status bar appears on activation
- [ ] Status bar shows correct mode
- [ ] Clicking status bar opens quick pick
- [ ] Quick pick shows all modes
- [ ] Switching to VIBE mode works
- [ ] Switching to DEV mode works
- [ ] Files are copied correctly
- [ ] Mode detection is accurate
- [ ] Commands work from command palette
- [ ] Keyboard shortcut works
- [ ] Auto-reload option works
- [ ] Works with no existing mode files
- [ ] Default file creation works
- [ ] Extension works across window reloads
- [ ] No console errors

## Debugging

### View Extension Logs

1. Open Output panel: `View > Output`
2. Select "VibeSwitch" from dropdown
3. See console.log messages

### Debug in Developer Tools

1. Help > Toggle Developer Tools
2. Go to Console tab
3. See detailed errors and warnings

### Common Issues

**Status bar not appearing:**
- Check `vibeswitch.showInStatusBar` setting
- Ensure workspace folder is open
- Try reloading window

**Mode switching not working:**
- Check console for errors
- Verify mode files exist
- Check file permissions

**Commands not registered:**
- Check `package.json` contributions
- Ensure command IDs match
- Reload extension host

## Packaging

### Create VSIX Package

```bash
vsce package
```

This creates `vibeswitch-1.0.0.vsix`.

### Version Bumping

```bash
# Patch version (1.0.0 -> 1.0.1)
npm version patch

# Minor version (1.0.0 -> 1.1.0)
npm version minor

# Major version (1.0.0 -> 2.0.0)
npm version major
```

## Publishing (Future)

### To VSCode Marketplace

1. Create publisher account at https://marketplace.visualstudio.com/
2. Get Personal Access Token from Azure DevOps
3. Login:
```bash
vsce login your-publisher-name
```
4. Publish:
```bash
vsce publish
```

### To Open VSX (for other editors)

```bash
npx ovsx publish vibeswitch-1.0.0.vsix -p YOUR_ACCESS_TOKEN
```

## Code Style

- Use clear, descriptive function names
- Add JSDoc comments for functions
- Handle errors gracefully with try/catch
- Show user-friendly error messages
- Log detailed errors to console
- Follow VSCode extension best practices

## Resources

- [VSCode Extension API](https://code.visualstudio.com/api)
- [VSCode Codicons](https://microsoft.github.io/vscode-codicons/dist/codicon.html)
- [Extension Guides](https://code.visualstudio.com/api/extension-guides/overview)
- [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - See LICENSE file


