# Installation Guide

<p align="center">
  <img src="logo-steering-stick.png" alt="VibeSwitch Logo" width="250">
</p>

**Get VibeSwitch running in 5 minutes.**

---

## 📋 Prerequisites

Before installing, make sure you have:

- ✅ **Cursor IDE** installed (https://cursor.sh)
- ✅ **VS Code 1.80.0+** (Cursor is built on VS Code)
- ✅ **A workspace folder** open in Cursor

---

## 📦 Installation Methods

### Method 1: Install from VSIX (Recommended)

1. **Download the Extension**
   - Get `vibeswitch-1.0.0.vsix` from your source

2. **Open Extensions Panel**
   - Press `Ctrl+Shift+X` (Windows/Linux)
   - Or `Cmd+Shift+X` (Mac)
   - Or click the Extensions icon in the sidebar

3. **Install from VSIX**
   - Click the `⋯` (three dots) at the top of the Extensions panel
   - Select **"Install from VSIX..."**
   - Navigate to `vibeswitch-1.0.0.vsix`
   - Click **"Install"**

4. **Restart Cursor**
   - Press `Ctrl+Shift+P` (or `Cmd+Shift+P`)
   - Type: **"Developer: Reload Window"**
   - Press Enter

5. **Verify Installation**
   - Look at the bottom-right status bar
   - You should see: `⚙️ Mode?`
   - Click it to set your first mode!

---

### Method 2: Install via Command Line

If you prefer the terminal:

```bash
# Navigate to the directory containing the VSIX
cd /path/to/vibeswitch

# Install with code CLI (if available)
code --install-extension vibeswitch-1.0.0.vsix

# Or use Cursor's CLI
cursor --install-extension vibeswitch-1.0.0.vsix
```

Then restart Cursor.

---

## 🎬 First Launch

### 1. Open a Workspace Folder

VibeSwitch requires a workspace folder to store mode files:

- `File` → `Open Folder...`
- Or `Ctrl+K Ctrl+O`

**Why?** The extension creates `.cursorrules` files in your project root.

### 2. Check Status Bar

Look at the bottom-right corner:

```
⚙️ Mode?
```

This means no mode is set yet.

### 3. Click to Choose Mode

Click `⚙️ Mode?` and select:
- **⚡ VIBE Mode** → Autonomous flow
- **📚 DEV Mode** → Collaborative control

### 4. Accept Default Files

First time only, you'll see:

```
Missing .cursorrules.dev
Would you like to create default mode files?
```

Click **"Yes"**. The extension will create:
- `.cursorrules.vibe`
- `.cursorrules.dev`
- `.cursorrules` (active mode)

**These files control Cursor AI behavior.**

---

## ✅ Verify It's Working

### Check 1: Status Bar Shows Mode

After choosing a mode:
- **VIBE**: `⚡ VIBE`
- **DEV**: `📚 DEV  🟢 ▱▱▱▱▱▱▱`

### Check 2: Mode Files Exist

Open your workspace folder and confirm:
```
your-project/
├── .cursorrules       ← Active mode
├── .cursorrules.vibe  ← VIBE template
└── .cursorrules.dev   ← DEV template
```

### Check 3: Commands Are Available

Press `Ctrl+Shift+P` and type "VibeSwitch":

```
VibeSwitch: Switch AI Collaboration Mode
VibeSwitch: Switch to VIBE Mode
VibeSwitch: Switch to DEV Mode
VibeSwitch: Show Collaboration Statistics
```

If you see these commands, installation succeeded! ✅

---

## 🎮 Basic Usage

### Switch Modes (3 Ways)

**1. Click Status Bar** (Fastest)
```
Click: 📚 DEV  🟢 ▱▱▱▱▱▱▱
```

**2. Keyboard Shortcut**
```
Ctrl+Shift+M  (Windows/Linux)
Cmd+Shift+M   (Mac)
```

**3. Command Palette**
```
Ctrl+Shift+P → "VibeSwitch: Switch AI Collaboration Mode"
```

### Test the Awareness Meter (DEV Mode)

1. **Switch to DEV mode**
2. **Create a test file**: `test.js`
3. **Type a comment**: `// function to add two numbers`
4. **Accept AI suggestion** (Tab key)
5. **Watch the meter update** in 10 seconds

If the meter turns orange/red, it's working! 🎉

---

## ⚙️ Configuration

After installation, customize your settings:

1. **Open Settings**
   - `Ctrl+,` (or `Cmd+,`)
   - Search: "VibeSwitch"

2. **Available Options**

```json
{
  // Show mode indicator and awareness meter
  "vibeswitch.showInStatusBar": true,
  
  // Enable awareness monitoring and statistics
  "vibeswitch.enableTelemetry": true,
  
  // Custom path for .cursorrules files (advanced)
  "vibeswitch.rulesPath": ""
}
```

---

## 🔧 Troubleshooting

### Issue: "No workspace folder open"

**Problem:** Extension requires a workspace folder.

**Solution:**
```
File → Open Folder → Select any project folder
```

---

### Issue: Status bar doesn't show mode

**Problem:** Extension not activated or statusBar setting disabled.

**Solutions:**
1. Check setting: `vibeswitch.showInStatusBar` = `true`
2. Reload window: `Ctrl+Shift+P` → "Developer: Reload Window"
3. Check extension is enabled: `Ctrl+Shift+X` → Search "VibeSwitch"

---

### Issue: ".cursorrules files not created"

**Problem:** Permission issues or workspace not writable.

**Solution:**
1. Check folder permissions
2. Manually create files:

```bash
cd your-project
touch .cursorrules.vibe
touch .cursorrules.dev
```

3. Copy templates from:
   - [.cursorrules.vibe template](.cursorrules.vibe)
   - [.cursorrules.dev template](.cursorrules.dev)

---

### Issue: "Extension host did not start in 10 seconds"

**Problem:** VS Code extension host startup timeout (common in development).

**Solution:**
1. Close Cursor completely
2. Reopen your workspace
3. Wait 30 seconds for extension to activate
4. Check status bar

---

### Issue: Awareness meter not updating

**Problem:** Event listeners not working or telemetry disabled.

**Solutions:**
1. Verify setting: `vibeswitch.enableTelemetry` = `true`
2. Switch to DEV mode (meter only works in DEV)
3. Open console for debug logs:
   - `Ctrl+Shift+I` → Console tab
   - Look for: `AwarenessMonitor: Starting...`

---

### Issue: Mode switch doesn't change AI behavior

**Problem:** Cursor not reading `.cursorrules` or file conflicts.

**Solutions:**
1. Check `.cursorrules` exists and has content
2. Compare with `.cursorrules.vibe` / `.cursorrules.dev`
3. Manually reload Cursor window:
   - `Ctrl+Shift+P` → "Developer: Reload Window"

---

## 🗑️ Uninstallation

### To Remove VibeSwitch

1. **Open Extensions**
   - `Ctrl+Shift+X`

2. **Find VibeSwitch**
   - Search: "VibeSwitch"

3. **Uninstall**
   - Click `⚙️` → "Uninstall"

4. **Reload Window**
   - `Ctrl+Shift+P` → "Developer: Reload Window"

### Clean Up Mode Files (Optional)

If you want to remove all VibeSwitch files from your workspace:

```bash
cd your-project
rm .cursorrules
rm .cursorrules.vibe
rm .cursorrules.dev
rm .vibeswitch-telemetry.json  # Statistics file
```

**Note:** This will reset Cursor AI to default behavior.

---

## 📁 File Structure

After installation, your workspace will have:

```
your-project/
│
├── .cursorrules              # Active mode rules (symlink-like)
├── .cursorrules.vibe         # VIBE mode template
├── .cursorrules.dev          # DEV mode template
│
├── .vibeswitch-telemetry.json # Statistics (local only)
│
└── your-code/
    └── ...
```

**All files are local. Nothing is sent to any server.**

---

## 🚀 Next Steps

Now that VibeSwitch is installed:

1. **[Read the Visual Overview](VISUAL-OVERVIEW.md)** - Understand the UI
2. **[Test the Awareness Meter](AWARENESS-TESTING.md)** - Structured exercises
3. **[Check Statistics](TELEMETRY.md)** - Learn about the dashboard
4. **[Read Settings Comparison](SETTINGS-COMPARISON.md)** - VIBE vs DEV details

---

## 🆘 Still Having Issues?

### Debug Checklist

- [ ] Workspace folder is open?
- [ ] Extension shows in Extensions panel?
- [ ] Status bar item visible?
- [ ] `.cursorrules` files exist in workspace?
- [ ] Settings configured correctly?
- [ ] Window reloaded after install?

### Get Console Logs

1. `Ctrl+Shift+I` → Console
2. Type: `VibeSwitch` (filter logs)
3. Copy any error messages

### Common Error Messages

```
"No workspace folder open"
→ Open a folder: File → Open Folder

"Failed to read .cursorrules"
→ Check file permissions

"AwarenessMonitor failed to start"
→ Check telemetry enabled in settings
```

---

## ✅ Installation Complete!

If you see this in your status bar, you're ready to go:

```
📚 DEV  🟢 ▱▱▱▱▱▱▱
```

**Welcome to conscious AI collaboration.** 🧠⚡

---

**Questions? Open an issue on GitHub or check the [README](README.md).**
