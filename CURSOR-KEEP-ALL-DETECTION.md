# Detecting Cursor's "Keep All" Button Click

## The Challenge

Cursor's "Keep All" button is a **Cursor-specific UI element** that's not part of the standard VS Code API. This makes direct detection difficult.

---

## What's NOT Possible

### ❌ Direct UI Event Detection
- **VS Code API doesn't expose Cursor-specific UI elements**
- The standard `vscode` API is editor-agnostic and doesn't know about Cursor's custom UI
- No `onButtonClick` or similar event for Cursor's UI elements

### ❌ Command Execution Detection
- Cursor's "Keep All" button likely doesn't execute a standard VS Code command
- Even if it did, we'd need to know the command ID (which is undocumented)
- `vscode.commands.onDidExecuteCommand` only fires for registered commands

### ❌ WebView/UI Inspection
- While Cursor is Electron-based, extensions can't access the renderer process
- No way to inject JavaScript into Cursor's UI or listen to DOM events

---

## What IS Possible (Indirect Detection)

### ✅ 1. Detect the **Effect** of "Keep All"

When a user clicks "Keep All", it typically results in:
- **Multiple rapid file changes** (within seconds)
- **Multiple files saved simultaneously**
- **Multiple AI suggestions accepted at once**

#### Implementation Approach:

```javascript
// Track rapid file changes
let recentFileChanges = [];
const RAPID_CHANGE_WINDOW = 2000; // 2 seconds

vscode.workspace.onDidChangeTextDocument((event) => {
    const now = Date.now();
    
    // Track this change
    recentFileChanges.push({
        file: event.document.uri.fsPath,
        timestamp: now,
        changeCount: event.contentChanges.length
    });
    
    // Clean old entries
    recentFileChanges = recentFileChanges.filter(
        c => (now - c.timestamp) < RAPID_CHANGE_WINDOW
    );
    
    // Detect "Keep All" pattern: Multiple files changed rapidly
    const uniqueFiles = new Set(recentFileChanges.map(c => c.file));
    if (uniqueFiles.size >= 3 && recentFileChanges.length >= 5) {
        console.log('Possible "Keep All" detected: Multiple files changed rapidly');
        // Track this as a "keep all" event
    }
});
```

### ✅ 2. Detect Multiple Simultaneous Saves

```javascript
let pendingSaves = new Set();
let saveTimestamps = [];

vscode.workspace.onDidSaveTextDocument((document) => {
    const now = Date.now();
    saveTimestamps.push(now);
    
    // Detect multiple saves within 1 second
    const recentSaves = saveTimestamps.filter(
        ts => (now - ts) < 1000
    );
    
    if (recentSaves.length >= 3) {
        console.log('Possible "Keep All" detected: Multiple files saved simultaneously');
        // This likely indicates "Keep All" was clicked
    }
});
```

### ✅ 3. Detect Rapid AI Suggestion Acceptance

In your `AwarenessMonitor`, you could detect when multiple suggestions are accepted rapidly:

```javascript
// In awareness-monitor.js
checkSuggestionStatus(suggestionId) {
    // ... existing code ...
    
    if (suggestion.status === 'accepted') {
        // Track acceptance timestamp
        const now = Date.now();
        this.recentAcceptances.push(now);
        
        // Clean old entries (last 2 seconds)
        this.recentAcceptances = this.recentAcceptances.filter(
            ts => (now - ts) < 2000
        );
        
        // If 3+ suggestions accepted in 2 seconds, likely "Keep All"
        if (this.recentAcceptances.length >= 3) {
            console.log('Possible "Keep All" detected: Multiple suggestions accepted rapidly');
            
            // Emit to usage statistics
            if (this.usageStats) {
                this.usageStats.trackKeepAll({
                    count: this.recentAcceptances.length,
                    timestamp: now
                });
            }
        }
    }
}
```

### ✅ 4. Detect Pattern: Multiple Files + No User Edits

"Keep All" typically means:
- Multiple files changed
- No user edits between changes
- All changes accepted as-is

```javascript
let lastUserEditTime = 0;
let aiChangeSequence = [];

vscode.workspace.onDidChangeTextDocument((event) => {
    const isAIChange = /* your AI detection logic */;
    
    if (isAIChange) {
        const now = Date.now();
        const timeSinceUserEdit = now - lastUserEditTime;
        
        // If multiple AI changes with no user edits in between
        if (timeSinceUserEdit > 1000) { // No user edits for 1 second
            aiChangeSequence.push({
                file: event.document.uri.fsPath,
                timestamp: now
            });
            
            // Detect "Keep All" pattern
            if (aiChangeSequence.length >= 3) {
                const uniqueFiles = new Set(aiChangeSequence.map(c => c.file));
                if (uniqueFiles.size >= 2) {
                    console.log('Possible "Keep All": Multiple files, no user edits');
                }
            }
        }
    } else {
        // User edit detected - reset sequence
        lastUserEditTime = Date.now();
        aiChangeSequence = [];
    }
});
```

---

## Recommended Implementation

### Add to `awareness-monitor.js`:

```javascript
class AwarenessMonitor {
    constructor(usageStats = null, onScoreUpdate = null) {
        // ... existing code ...
        
        // "Keep All" detection
        this.recentAcceptances = [];
        this.rapidFileChanges = [];
    }
    
    /**
     * Detect "Keep All" pattern: Multiple suggestions accepted rapidly
     */
    detectKeepAll() {
        const now = Date.now();
        const WINDOW = 2000; // 2 seconds
        
        // Filter to recent acceptances
        const recent = this.recentAcceptances.filter(
            ts => (now - ts) < WINDOW
        );
        
        if (recent.length >= 3) {
            // Likely "Keep All" was clicked
            return {
                detected: true,
                count: recent.length,
                timestamp: now
            };
        }
        
        return { detected: false };
    }
    
    async checkSuggestionStatus(suggestionId) {
        // ... existing code ...
        
        if (suggestion.status === 'accepted') {
            const now = Date.now();
            this.recentAcceptances.push(now);
            
            // Clean old entries
            this.recentAcceptances = this.recentAcceptances.filter(
                ts => (now - ts) < 2000
            );
            
            // Check for "Keep All" pattern
            const keepAll = this.detectKeepAll();
            if (keepAll.detected) {
                console.log(`AwarenessMonitor: "Keep All" detected - ${keepAll.count} suggestions accepted`);
                
                // Emit to usage statistics
                if (this.usageStats && this.usageStats.trackKeepAll) {
                    this.usageStats.trackKeepAll({
                        count: keepAll.count,
                        timestamp: keepAll.timestamp
                    });
                }
            }
        }
    }
}
```

### Add to `usage-stats.js`:

```javascript
trackKeepAll(event) {
    const config = vscode.workspace.getConfiguration('vibeswitch');
    if (!config.get('enableTelemetry', true)) return;

    const mode = this.currentSession?.mode;
    if (!mode || !this.data.awareness[mode]) return;

    const bucket = this.data.awareness[mode];
    bucket.keepAllClicks = (bucket.keepAllClicks || 0) + 1;
    bucket.keepAllTotalSuggestions = (bucket.keepAllTotalSuggestions || 0) + event.count;

    this.saveUsageStats();
}
```

---

## Limitations & Considerations

### ⚠️ False Positives
- User might manually accept multiple suggestions quickly
- Not all rapid acceptances mean "Keep All" was clicked

### ⚠️ False Negatives
- If user accepts suggestions slowly, we won't detect it
- If "Keep All" only affects 1-2 files, might not trigger

### ⚠️ Timing Sensitivity
- The detection window (2 seconds) might need tuning
- Different users have different acceptance speeds

---

## Alternative: Ask Cursor Team

If you need **reliable** detection, consider:
1. **Request Cursor API feature**: Ask Cursor team to expose "Keep All" as an event or command
2. **Use Cursor's internal APIs**: If Cursor has undocumented APIs (risky, might break)
3. **Accept indirect detection**: Use the pattern-based approach above

---

## Conclusion

**Direct detection**: ❌ Not possible with current VS Code API

**Indirect detection**: ✅ Possible by detecting patterns:
- Multiple rapid file changes
- Multiple simultaneous saves
- Multiple rapid suggestion acceptances
- Multiple files changed with no user edits

The pattern-based approach is **good enough** for awareness tracking, even if not 100% accurate.

