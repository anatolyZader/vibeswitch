# Quick Test Guide

## 🚀 Test the Extension in 5 Minutes

### Step 1: Open Extension in VSCode/Cursor

```bash
cd /home/eventstorm1/vc-3/vibeswitch-extension
code .
```

### Step 2: Launch Extension Development Host

Press **F5** (or click Run > Start Debugging)

A new window titled "**[Extension Development Host]**" will open.

### Step 3: Open Your Project

In the Extension Development Host window:
1. File > Open Folder
2. Select `/home/eventstorm1/vc-3`

### Step 4: Check Status Bar

Look at the **bottom-right** of the window.

You should see one of:
- `⚙️ Mode?` - No mode set yet
- `📚 DEV` - DEV mode active  
- `⚡ VIBE` - VIBE mode active

### Step 5: Test Mode Switching

**Option A: Click Status Bar**
1. Click on the mode indicator in status bar
2. A dropdown appears with two options:
   - ⚡ VIBE Mode
   - 📚 DEV Mode
3. Select one
4. Should see "Switched to X mode" notification

**Option B: Use Keyboard**
1. Press `Cmd+Shift+M` (Mac) or `Ctrl+Shift+M` (Linux)
2. Select a mode
3. Check that status bar updates

**Option C: Command Palette**
1. Press `Cmd+Shift+P` or `Ctrl+Shift+P`
2. Type "VibeSwitch"
3. See available commands
4. Select "Switch AI Agent Mode"

### Step 6: Verify Files Changed

After switching to VIBE mode:

```bash
# Check .cursorrules was updated
cat /home/eventstorm1/vc-3/.cursorrules
# Should contain "VIBE MODE"

# Check settings.json was updated
cat /home/eventstorm1/vc-3/.vscode/settings.json
# Should contain VIBE mode settings
```

After switching to DEV mode:

```bash
# Check .cursorrules was updated
cat /home/eventstorm1/vc-3/.cursorrules
# Should contain "DEV MODE"
```

### Step 7: Test Without Mode Files

1. In Extension Development Host, open a **different folder** (without mode files)
2. Click status bar - should show `⚙️ Mode?`
3. Try to switch modes
4. Should prompt to create default files
5. Click "Yes" to create them
6. Mode should switch successfully

### Step 8: Test Reload

1. Switch to VIBE mode
2. When notification appears, click "Reload Window"
3. Window reloads
4. Check status bar still shows `⚡ VIBE`

---

## ✅ Success Checklist

- [ ] Extension Development Host window opened
- [ ] Status bar item visible
- [ ] Clicking status bar opens dropdown
- [ ] Can select VIBE mode
- [ ] Can select DEV mode
- [ ] Status bar updates after switch
- [ ] `.cursorrules` file gets updated
- [ ] `.vscode/settings.json` gets updated
- [ ] Works with existing mode files
- [ ] Can create default files if missing
- [ ] Keyboard shortcut works
- [ ] Command palette commands work
- [ ] No errors in console

---

## 🐛 If Something Doesn't Work

### Check Developer Console

In Extension Development Host window:
1. Help > Toggle Developer Tools
2. Go to Console tab
3. Look for errors (red text)

### Check Extension Output

1. View > Output
2. Select "Extension Host" from dropdown
3. Look for "VibeSwitch" messages

### Common Issues

**Status bar not showing:**
- Check you have a workspace folder open (File > Open Folder)
- Not just a single file

**Mode switching does nothing:**
- Check the console for errors
- Verify mode files exist in workspace root

**"Command not found":**
- Extension might not have activated
- Try reloading Extension Development Host: Press `Cmd+R` / `Ctrl+R`

---

## 📦 Package and Install (Optional)

If F5 debug mode works well, package it for real use:

```bash
cd vibeswitch-extension

# Package
npm install -g @vscode/vsce
vsce package

# Install in your main Cursor/VSCode
code --install-extension vibeswitch-1.0.0.vsix
```

Then restart Cursor and the extension will be active in all windows!

---

## 🎯 Next Steps

Once testing is successful:
1. Customize the icons (see `images/README.md`)
2. Adjust settings in `package.json`
3. Package and install for daily use
4. Share with your team!


