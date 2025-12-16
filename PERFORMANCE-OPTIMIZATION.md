# VibeSwitch Performance Optimization Guide

This guide helps fix freezing issues in Cursor by optimizing extension logging and system settings.

## ✅ Completed: Extension Log Throttling

The extension now uses a throttled logger that:
- Prevents excessive logging that can cause freezes
- Throttles repeated messages within a 5-second window
- Skips verbose debug logs by default (can be enabled if needed)
- Always logs errors and warnings (not throttled)

**No action needed** - this is already implemented in the code.

---

## 🔧 Cursor-Specific Optimizations

### 1. Disable Hardware Acceleration in Cursor

Hardware acceleration can cause freezes on some systems. To disable it:

**Windows:**
1. Close Cursor completely
2. Open Command Prompt as Administrator
3. Navigate to Cursor installation directory (usually `C:\Users\<YourUsername>\AppData\Local\Programs\cursor`)
4. Run: `cursor.exe --disable-gpu`
5. Or add `--disable-gpu` to Cursor's shortcut target

**macOS:**
1. Close Cursor completely
2. Open Terminal
3. Run: `/Applications/Cursor.app/Contents/MacOS/Cursor --disable-gpu`
4. Or create an alias/script for this

**Linux:**
1. Close Cursor completely
2. Edit the Cursor launcher or create a script:
   ```bash
   cursor --disable-gpu
   ```

**Alternative (Settings):**
- Open Cursor Settings (Ctrl+, or Cmd+,)
- Search for "hardware acceleration"
- Disable if available

### 2. Limit Background Extensions

Too many extensions running simultaneously can cause freezes:

1. Open Extensions view (Ctrl+Shift+X or Cmd+Shift+X)
2. Review installed extensions
3. Disable extensions you don't actively use:
   - Right-click extension → "Disable"
   - Or use "Disable (Workspace)" for workspace-specific disabling
4. Keep only essential extensions active

**Recommended:** Disable extensions that:
- Run in the background constantly
- Monitor file changes aggressively
- Have heavy logging
- You haven't used in the last week

### 3. Extension Log Throttling (Already Done ✅)

The VibeSwitch extension now includes log throttling to prevent excessive logging. This is automatically enabled.

---

## 🛡️ Windows Defender Exclusions (HUGE WIN)

Windows Defender can cause significant freezes when scanning files during development. Adding exclusions often fixes "random freezes" completely.

### Add Exclusions for:

#### 1. Your Workspace Folder

**Method 1: Via Windows Security**
1. Open Windows Security (Windows Defender)
2. Go to "Virus & threat protection"
3. Click "Manage settings" under "Virus & threat protection settings"
4. Scroll down to "Exclusions"
5. Click "Add or remove exclusions"
6. Click "Add an exclusion" → "Folder"
7. Navigate to and select your workspace folder:
   ```
   C:\Users\<YourUsername>\<YourWorkspaceFolder>
   ```

**Method 2: Via PowerShell (Admin)**
```powershell
Add-MpPreference -ExclusionPath "C:\Users\<YourUsername>\<YourWorkspaceFolder>"
```

#### 2. node_modules Folder

**Important:** Exclude `node_modules` in every project:

**Via Windows Security:**
1. Follow steps 1-6 above
2. Add exclusion for: `C:\Users\<YourUsername>\<YourWorkspaceFolder>\node_modules`
3. Or add a pattern exclusion: `**\node_modules\**`

**Via PowerShell (Admin):**
```powershell
# For specific project
Add-MpPreference -ExclusionPath "C:\Users\<YourUsername>\<YourWorkspaceFolder>\node_modules"

# For all node_modules (recommended)
Add-MpPreference -ExclusionPath "**\node_modules\**"
```

#### 3. Cursor Install Directory

**Find Cursor Installation:**
- Usually: `C:\Users\<YourUsername>\AppData\Local\Programs\cursor`
- Or: `C:\Program Files\Cursor` (if installed system-wide)

**Via Windows Security:**
1. Follow steps 1-6 above
2. Add exclusion for the entire Cursor directory

**Via PowerShell (Admin):**
```powershell
Add-MpPreference -ExclusionPath "C:\Users\<YourUsername>\AppData\Local\Programs\cursor"
```

### Additional Recommended Exclusions:

```powershell
# TypeScript build outputs
Add-MpPreference -ExclusionPath "**\dist\**"
Add-MpPreference -ExclusionPath "**\build\**"
Add-MpPreference -ExclusionPath "**\out\**"
Add-MpPreference -ExclusionPath "**\target\**"

# Package manager caches
Add-MpPreference -ExclusionPath "$env:USERPROFILE\.npm"
Add-MpPreference -ExclusionPath "$env:USERPROFILE\.yarn"
Add-MpPreference -ExclusionPath "$env:USERPROFILE\.pnpm"

# Git directories
Add-MpPreference -ExclusionPath "**\.git\**"
```

### Verify Exclusions:

```powershell
Get-MpPreference | Select-Object -ExpandProperty ExclusionPath
```

---

## 🚀 Additional Performance Tips

### 1. Reduce File Watchers

If you have many file watchers (extensions monitoring file changes), consider:
- Disabling unused extensions
- Using workspace-specific settings to limit watchers
- Excluding large directories from watchers (like `node_modules`)

### 2. Limit Output Channel Logging

The VibeSwitch extension now throttles logs automatically. If you still see excessive logs:
- Check the Output panel (View → Output)
- Select "VibeSwitch" from the dropdown
- Review if any other extensions are logging excessively

### 3. Monitor Resource Usage

Use Task Manager to monitor:
- CPU usage (should be low when idle)
- Memory usage (Cursor should use reasonable amounts)
- Disk I/O (Defender scanning causes high disk usage)

### 4. Workspace Settings

Add to your `.vscode/settings.json`:

```json
{
  "files.watcherExclude": {
    "**/.git/objects/**": true,
    "**/.git/subtree-cache/**": true,
    "**/node_modules/**": true,
    "**/dist/**": true,
    "**/build/**": true,
    "**/.next/**": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/build": true
  }
}
```

---

## 📊 Testing Performance Improvements

After applying these optimizations:

1. **Restart Cursor completely**
2. **Open your workspace**
3. **Monitor for freezes:**
   - Watch for UI freezing
   - Check Task Manager for high CPU/disk usage
   - Note any lag when typing or switching files

4. **If freezes persist:**
   - Check Windows Event Viewer for Defender scan events
   - Review Cursor's Developer Tools console (Help → Toggle Developer Tools)
   - Check Output panel for extension errors

---

## 🔍 Troubleshooting

### Freezes Still Occurring?

1. **Verify Defender Exclusions:**
   ```powershell
   Get-MpPreference | Select-Object -ExpandProperty ExclusionPath
   ```

2. **Check Defender Real-time Protection:**
   - Temporarily disable to test if it's the cause
   - If freezes stop, Defender is the issue → add more exclusions

3. **Check Extension Logs:**
   - View → Output → Select each extension
   - Look for excessive logging or errors

4. **Monitor System Resources:**
   - Task Manager → Performance tab
   - Watch CPU, Memory, Disk during freezes

### Defender Still Scanning?

If Defender still scans excluded folders:
1. Ensure exclusions are added correctly
2. Restart Windows Security service:
   ```powershell
   Restart-Service -Name WinDefend
   ```
3. Restart Cursor

---

## 📝 Summary

**Critical Actions:**
1. ✅ Extension log throttling (already done)
2. ⚠️ Add Windows Defender exclusions (workspace, node_modules, Cursor directory)
3. ⚠️ Disable hardware acceleration if needed
4. ⚠️ Limit background extensions

**Expected Results:**
- Reduced or eliminated freezes
- Faster file operations
- Lower CPU/disk usage
- Smoother Cursor experience

---

## 🆘 Need Help?

If freezes persist after these optimizations:
1. Check Cursor's GitHub issues
2. Review extension logs in Output panel
3. Check Windows Event Viewer for system errors
4. Consider temporarily disabling all extensions to isolate the issue





