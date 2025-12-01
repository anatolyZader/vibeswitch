# Installing VibeSwitch Extension

## Method 1: Install from VSIX (Local Installation)

### Step 1: Package the Extension

```bash
cd vibeswitch-extension

# Install vsce if you don't have it
npm install -g @vscode/vsce

# Package the extension
vsce package
```

This creates a `.vsix` file (e.g., `vibeswitch-1.0.0.vsix`)

### Step 2: Install in Cursor/VSCode

**Option A: Via Command Palette**
1. Open Cursor/VSCode
2. Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
3. Type "Extensions: Install from VSIX"
4. Select the `vibeswitch-1.0.0.vsix` file
5. Reload the window when prompted

**Option B: Via Command Line**
```bash
code --install-extension vibeswitch-1.0.0.vsix
```

**Option C: Drag and Drop**
1. Open Cursor/VSCode
2. Open Extensions panel (`Cmd+Shift+X` or `Ctrl+Shift+X`)
3. Drag the `.vsix` file into the Extensions panel

### Step 3: Verify Installation

1. Look at the bottom-right status bar
2. You should see the VibeSwitch indicator: `⚙️ Mode?` or `📚 DEV` or `⚡ VIBE`
3. Click it to test the mode switcher

---

## Method 2: Development Mode (For Testing)

### Step 1: Open Extension in VSCode

```bash
cd vibeswitch-extension
code .
```

### Step 2: Run Extension

1. Press `F5` or click "Run > Start Debugging"
2. A new "Extension Development Host" window opens
3. Open your project folder in that window
4. Test the extension

### Step 3: Make Changes

- Edit `extension.js` for logic changes
- Edit `package.json` for configuration
- Press `Cmd+R` (Mac) or `Ctrl+R` (Windows/Linux) in the Extension Development Host to reload

---

## Method 3: Publish to Marketplace (Future)

### Prerequisites

1. Create a [Visual Studio Marketplace](https://marketplace.visualstudio.com/) account
2. Get a Personal Access Token from [Azure DevOps](https://dev.azure.com/)

### Publishing Steps

```bash
cd vibeswitch-extension

# Login (one-time)
vsce login your-publisher-name

# Publish
vsce publish
```

Then install from the marketplace like any other extension.

---

## Troubleshooting

### "Command 'vsce' not found"
```bash
npm install -g @vscode/vsce
```

### "Extension not showing in status bar"
1. Check settings: `vibeswitch.showInStatusBar` should be `true`
2. Reload window: `Cmd/Ctrl+Shift+P` → "Reload Window"
3. Check you have a workspace folder open

### "Mode files not found"
1. Click the mode indicator
2. Extension will prompt to create default files
3. Or manually create `.cursorrules.vibe` and `.cursorrules.dev`

### Extension not activating
1. Check the output console: `View > Output` → Select "VibeSwitch"
2. Check for errors in `Help > Toggle Developer Tools > Console`

---

## Uninstalling

1. Open Extensions panel (`Cmd+Shift+X` or `Ctrl+Shift+X`)
2. Find "VibeSwitch"
3. Click the gear icon → "Uninstall"

Or via command line:
```bash
code --uninstall-extension your-publisher-name.vibeswitch
```

---

## Next Steps

Once installed:
1. Click the status bar mode indicator
2. Choose between VIBE and DEV modes
3. Enjoy seamless mode switching!

See [README.md](README.md) for usage details.


