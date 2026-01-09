# Lifecycle: Agent Change to Existing File → File Colors & Awareness Meter Update

## Overview
This document traces the complete lifecycle when an AI agent makes a change to an existing file, from the VS Code event trigger through to the final UI updates (file name colors in Explorer and awareness meter in status bar).

---

## 🎯 Complete Flow Diagram

```
Agent makes change
    ↓
VS Code fires onDidChangeTextDocument event
    ↓
awarenessMonitor.js (boundary: event listener)
    ↓
eventHandlers.js → onTextChange()
    ↓
agentSuggestionHandler.js → recordAISuggestion()
    ↓
agentSuggestionHandler.js → addSuggestionAndTrack()
    ├─→ debtManager.js → addToDebt()
    │   ├─→ Updates debt Map
    │   ├─→ Calls updateFileColorsInExplorer() callback
    │   └─→ Calls updateScore() callback
    ├─→ Calls updateFileColorsInExplorer() callback
    └─→ Calls updateScore() callback
        ↓
scoreCalculator.js → updateScore()
    ├─→ Calculates new score components
    └─→ Calls onScoreUpdate() callback
        ↓
initializeHelpers.js → updateAwarenessMeter()
    ↓
ui/status-bar/index.js → updateAwarenessMeter()
    └─→ Updates status bar item
```

---

## 📁 Files Involved (in execution order)

### 1. **awarenessMonitor.js** (Boundary Layer)
**Role:** Event listener registration and orchestration  
**Location:** `awarenessMonitor/awarenessMonitor.js`

**What happens:**
- Registers VS Code event listener: `vscode.workspace.onDidChangeTextDocument()`
- Wraps handler in `safe()` utility for error handling
- Routes event to `EventHandlers.onTextChange()`

**Key code:**
```javascript
// Line ~305-308
vscode.workspace.onDidChangeTextDocument((event) => {
    safe('onTextChange', () => this.eventHandlers.onTextChange(event));
})
```

---

### 2. **eventHandlers.js** (Event Analysis Layer)
**Role:** Analyzes text changes to detect AI vs user edits  
**Location:** `awarenessMonitor/eventHandlers.js`

**What happens:**
- Receives `TextDocumentChangeEvent` from VS Code
- Filters out non-code documents (output channels, debug, etc.)
- Analyzes each change:
  - Checks if change is multi-line OR insertion ≥ 5 chars (AI-like)
  - Checks if change is deletion (user edit)
- Routes to appropriate handler:
  - AI-like → `agentSuggestionHandler.recordAISuggestion()`
  - User edit → `agentSuggestionHandler.recordUserEdit()`

**Key code:**
```javascript
// Lines 23-80
onTextChange(event) {
    // Filter non-code documents
    if (isNonCodeDocument(scheme)) return;
    
    // Analyze each change
    for (const change of event.contentChanges) {
        const isLikelyAI = isMultiLine || (isInsertion && changeSize >= 5);
        
        if (isLikelyAI) {
            this.agentSuggestionHandler.recordAISuggestion(event.document, change);
        } else {
            this.agentSuggestionHandler.recordUserEdit(event.document, change);
        }
    }
}
```

**Detection logic:**
- **AI-like:** Multi-line insertions OR single-line insertions ≥ 5 characters
- **User edit:** Deletions or small insertions (< 5 chars)

---

### 3. **agentSuggestionHandler.js** (Suggestion Creation Layer)
**Role:** Creates and tracks AI suggestions  
**Location:** `awarenessMonitor/agentSuggestionHandler.js`

#### 3a. `recordAISuggestion()` (Lines 148-179)
**What happens:**
- Creates suggestion object with metadata:
  - Document URI, range, text, size
  - Timestamp, status ('pending')
  - Review tracking fields
- Calls `addSuggestionAndTrack()` to process the suggestion
- Emits event to usage statistics

**Key code:**
```javascript
// Lines 148-179
recordAISuggestion(document, change) {
    const suggestion = this.createSuggestionObject({
        document: document.uri.toString(),
        range: change.range,
        text: change.text,
        size: changeSize
    });
    
    this.addSuggestionAndTrack(suggestion, filePath, changeSize);
    
    // Emit to usage statistics
    if (this.usageStats) {
        this.usageStats.trackAISuggestion({...});
    }
}
```

#### 3b. `addSuggestionAndTrack()` (Lines 71-97)
**What happens:**
- Adds suggestion to rolling window (`this.aiSuggestions` array, max 10)
- **Calls `debtManager.addToDebt()`** → Adds file to review debt
- **Calls `updateFileColorsInExplorer()` callback** → Updates file colors immediately
- **Calls `updateScore()` callback** → Triggers score recalculation
- Schedules status check after 5 seconds (to detect accept/reject)

**Key code:**
```javascript
// Lines 71-97
addSuggestionAndTrack(suggestion, filePath, contentLength) {
    // Add to rolling window
    this.aiSuggestions.push(suggestion);
    if (this.aiSuggestions.length > this.maxSuggestions) {
        this.aiSuggestions.shift();
    }
    
    // Add to debt
    if (this.debtManager) {
        this.debtManager.addToDebt(filePath, contentLength, this.updateScore);
    }
    
    // Update file colors immediately
    if (this.updateFileColorsInExplorer) {
        this.updateFileColorsInExplorer();
    }
    
    // Schedule status check
    setTimeout(() => this.checkSuggestionStatus(suggestion.id), 5000);
    
    // Immediately update score
    if (this.updateScore) {
        this.updateScore();
    }
}
```

---

### 4. **debtManager.js** (Debt Management Layer)
**Role:** Tracks unreviewed files and manages debt persistence  
**Location:** `awarenessMonitor/debtManager.js`

#### 4a. `addToDebt()` (Lines 65-113)
**What happens:**
- Adds/updates debt entry in `this.debt` Map (filePath → debt object)
- Debt object contains:
  - `modifiedAt`, `lastModifiedAt`
  - `totalChanges`, `modificationCount`
  - `reviewed: false`
  - Review tracking fields
- Saves debt to workspace storage (via `PersistInContext`)
- **Calls `updateFileColorsInExplorer()` callback** → Updates file colors
- **Calls `updateScore()` callback** → Triggers score update

**Key code:**
```javascript
// Lines 65-113
addToDebt(filePath, changeSize, updateScore) {
    const existing = this.debt.get(filePath);
    
    if (existing && !existing.reviewed) {
        // Accumulate debt
        existing.totalChanges += changeSize;
        existing.modificationCount++;
    } else {
        // Create new debt entry
        this.debt.set(filePath, {
            modifiedAt: Date.now(),
            totalChanges: changeSize,
            reviewed: false,
            // ... other fields
        });
    }
    
    this.saveDebt();
    
    // Update file colors immediately
    if (this.updateFileColorsInExplorer) {
        this.updateFileColorsInExplorer();
    }
    
    // Trigger score update
    if (updateScore) {
        updateScore();
    }
}
```

**Debt structure:**
```javascript
{
    modifiedAt: timestamp,
    lastModifiedAt: timestamp,
    totalChanges: number,      // Total bytes of AI changes
    modificationCount: number, // Number of AI edits
    reviewed: false,
    firstOpenedAt: null,
    totalReviewTime: 0,
    lastVisitedAt: null,
    reviewSessions: 0
}
```

---

### 5. **initializeHelpers.js** (Callback Layer)
**Role:** Provides callbacks that connect debt/suggestions to UI  
**Location:** `helpers/initializeHelpers.js`

#### 5a. `updateFileColorsInExplorer()` (Lines 63-69)
**What happens:**
- Called when debt changes or suggestions are added
- Checks if file decoration provider exists and mode is 'dev'
- Calls `state.fileDecorationProvider.refresh()` → Triggers VS Code to re-query decorations

**Key code:**
```javascript
// Lines 63-69
const updateFileColorsInExplorer = () => {
    if (state.fileDecorationProvider && state.currentMode === 'dev') {
        state.fileDecorationProvider.refresh();
    }
};
```

#### 5b. `updateAwarenessMeter()` (Lines 84-91)
**What happens:**
- Called when score changes (via `onScoreUpdate` callback)
- Delegates to `statusBar.updateAwarenessMeter()`
- Passes awareness monitor, mode, and status bar item

**Key code:**
```javascript
// Lines 84-91
const updateAwarenessMeter = () => {
    statusBar.updateAwarenessMeter(
        state.awarenessBarItem, 
        state.awarenessMonitor, 
        state.currentMode, 
        state.outputChannel
    );
};
```

---

### 6. **fileColorsInExplorer.js** (File Decoration Provider)
**Role:** Provides file decorations (colors/badges) to VS Code Explorer  
**Location:** `ui/fileColorsInExplorer.js`

#### 6a. `refresh()` (VS Code API)
**What happens:**
- VS Code calls `provideFileDecoration()` for each file in Explorer
- For each file:
  - Checks if mode is 'dev' (only decorate in DEV mode)
  - Queries `awarenessMonitor` for debt and suggestions
  - Returns decoration based on file state:
    - **Review debt:** Violet/purple color + ⚠ badge
    - **Pending new file:** Blue/purple color + ⏳ badge
    - **Pending changes:** Orange/yellow color + ⏳ badge
    - **Reviewed:** No decoration

**Key code:**
```javascript
// Lines 80-226
provideFileDecoration(uri, token) {
    // Only in DEV mode
    if (currentMode !== 'dev') return null;
    
    const filePath = uri.fsPath;
    
    // Check debt
    const debt = this.awarenessMonitor.debtManager.getDebt(filePath);
    if (debt && !debt.reviewed) {
        return {
            badge: '⚠',
            color: new vscode.ThemeColor('charts.purple'),
            tooltip: `Unreviewed AI changes: ${debt.totalChanges} bytes`
        };
    }
    
    // Check pending suggestions
    const suggestions = this.awarenessMonitor.agentSuggestionHandler.getSuggestions();
    const pending = suggestions.filter(s => 
        s.status === 'pending' && 
        s.document === uri.toString()
    );
    
    if (pending.length > 0) {
        return {
            badge: '⏳',
            color: new vscode.ThemeColor('charts.orange'),
            tooltip: `${pending.length} pending AI suggestion(s)`
        };
    }
    
    return null; // No decoration
}
```

**Decoration types:**
- **Violet ⚠:** File has unreviewed debt (old changes)
- **Orange ⏳:** File has pending suggestions (recent changes)
- **Blue ⏳:** New file created by AI (not shown for existing file changes)

---

### 7. **scoreCalculator.js** (Score Calculation Layer)
**Role:** Calculates awareness score from suggestions and debt  
**Location:** `awarenessMonitor/scoreCalculator.js`

#### 7a. `updateScore()` (Lines 28-316)
**What happens:**
- Filters suggestions from last 10 seconds
- Calculates score components:
  - **Review score (0-40):** Based on review time and behavior
  - **Critical score (0-30):** Based on acceptance/rejection of critical suggestions
  - **Adaptation score (0-30):** Based on user edits to AI suggestions
  - **Debt score (0-30):** Based on unreviewed files and age
- Combines components into total score (0-100)
- **Calls `onScoreUpdate()` callback** → Triggers meter update

**Key code:**
```javascript
// Lines 28-316
updateScore(aiSuggestions, getDebtScore, getReviewDebtSummary, onScoreUpdate) {
    const recentSuggestions = aiSuggestions.filter(
        s => (Date.now() - s.timestamp) <= 10000
    );
    
    // Calculate components
    this.scores.review = this.calculateReviewScore(recentSuggestions);
    this.scores.critical = this.calculateCriticalScore(recentSuggestions);
    this.scores.adaptation = this.calculateAdaptationScore(recentSuggestions);
    this.scores.debt = getDebtScore();
    
    // Total score
    this.currentScore = Math.min(
        this.scores.review + 
        this.scores.critical + 
        this.scores.adaptation + 
        this.scores.debt,
        100
    );
    
    // Trigger callback
    if (onScoreUpdate) {
        onScoreUpdate();
    }
}
```

**Score interpretation (INVERTED in DEV mode):**
- **0-39:** 🟢 GOOD (careful, skeptical review)
- **40-59:** 🟡 CAUTION (moderate engagement)
- **60-79:** 🟠 WARNING (too trusting)
- **80-100:** 🔴 DANGER (blind acceptance)

---

### 8. **ui/status-bar/index.js** (UI Update Layer)
**Role:** Updates awareness meter in status bar  
**Location:** `ui/status-bar/index.js`

#### 8a. `updateAwarenessMeter()` (Lines 113-293)
**What happens:**
- Gets current score from `awarenessMonitor.getScore()`
- Formats score as visual meter (7 segments: ▰▰▰▱▱▱▱)
- Adds emoji indicator (🟢/🟡/🟠/🔴)
- Builds detailed tooltip with:
  - Score breakdown (review/critical/adaptation/debt)
  - Suggestion counts (accepted/rejected/pending)
  - Debt file list
- Updates status bar item text and tooltip
- Shows/hides meter based on mode (only in DEV mode)

**Key code:**
```javascript
// Lines 113-293
function updateAwarenessMeter(awarenessBarItem, awarenessMonitor, currentMode, outputChannel) {
    // Only show in DEV mode
    if (currentMode !== 'dev') {
        awarenessBarItem.hide();
        return;
    }
    
    const scoreData = awarenessMonitor.getScore();
    const score = scoreData.total || 0;
    
    // Format meter
    const meter = getScoreMeter(score);
    const emoji = getScoreEmoji(score);
    
    awarenessBarItem.text = `${emoji} ${meter}`;
    awarenessBarItem.tooltip = `DEV Mode Awareness: ${score}/100
Review: ${scoreData.components.review}/40
Critical: ${scoreData.components.critical}/30
Adaptation: ${scoreData.components.adaptation}/30
Debt: ${scoreData.components.debt}/30
...`;
    
    awarenessBarItem.show();
}
```

**Meter display:**
- **Text:** `🟢 ▰▰▰▱▱▱▱` (emoji + 7-segment bar)
- **Tooltip:** Detailed breakdown on hover
- **Visibility:** Only in DEV mode

---

## 🔄 Callback Chain Summary

### File Colors Update Chain:
```
debtManager.addToDebt()
    ↓
updateFileColorsInExplorer() callback
    ↓
fileDecorationProvider.refresh()
    ↓
VS Code calls provideFileDecoration() for each file
    ↓
File colors updated in Explorer
```

### Awareness Meter Update Chain:
```
scoreCalculator.updateScore()
    ↓
onScoreUpdate() callback
    ↓
updateAwarenessMeter() helper
    ↓
statusBar.updateAwarenessMeter()
    ↓
Status bar item updated
```

---

## ⏱️ Timing & Async Operations

### Immediate Updates:
1. **File colors:** Updated immediately when debt changes (synchronous)
2. **Awareness meter:** Updated immediately when score changes (synchronous)

### Delayed Operations:
1. **Status check:** Scheduled 5 seconds after suggestion creation
   - Checks if suggestion was accepted/rejected/adapted
   - Updates suggestion status
   - Triggers score recalculation

### Periodic Updates:
1. **Score recalculation:** Every 10 seconds via timer
   - Recalculates score from current suggestions
   - Updates awareness meter

---

## 📊 Data Flow

### Suggestion Object:
```javascript
{
    id: timestamp + random,
    timestamp: Date.now(),
    document: "file:///path/to/file.js",
    range: vscode.Range,
    text: "inserted code",
    size: 150,
    status: 'pending', // → 'accepted' | 'rejected' | 'adapted'
    reviewed: false,
    reviewTime: 0,
    userEdited: false,
    editCount: 0
}
```

### Debt Object:
```javascript
{
    modifiedAt: timestamp,
    lastModifiedAt: timestamp,
    totalChanges: 5000,      // Total bytes
    modificationCount: 3,    // Number of edits
    reviewed: false,
    firstOpenedAt: null,
    totalReviewTime: 0,
    lastVisitedAt: null,
    reviewSessions: 0
}
```

### Score Object:
```javascript
{
    total: 45,              // 0-100
    components: {
        review: 20,         // 0-40
        critical: 10,       // 0-30
        adaptation: 5,      // 0-30
        debt: 10            // 0-30
    },
    suggestions: {
        total: 5,
        accepted: 2,
        rejected: 1,
        adapted: 1,
        pending: 1
    },
    debt: {
        unreviewedFiles: 3,
        files: [...]
    }
}
```

---

## 🎯 Key Interactions

### 1. **Event → Handler**
- VS Code event → `safe()` wrapper → `EventHandlers.onTextChange()`

### 2. **Detection → Tracking**
- `onTextChange()` → `recordAISuggestion()` → `addSuggestionAndTrack()`

### 3. **Tracking → Debt**
- `addSuggestionAndTrack()` → `debtManager.addToDebt()` → Debt Map updated

### 4. **Debt → UI (File Colors)**
- `debtManager.addToDebt()` → `updateFileColorsInExplorer()` → `fileDecorationProvider.refresh()` → VS Code queries decorations

### 5. **Tracking → Score**
- `addSuggestionAndTrack()` → `updateScore()` → `scoreCalculator.updateScore()` → Score calculated

### 6. **Score → UI (Meter)**
- `scoreCalculator.updateScore()` → `onScoreUpdate()` → `updateAwarenessMeter()` → Status bar updated

---

## 🔍 Debugging Points

### To trace file color updates:
1. Check `debtManager.addToDebt()` - logs debt additions
2. Check `updateFileColorsInExplorer()` - should be called
3. Check `fileColorsInExplorer.provideFileDecoration()` - logs decoration queries

### To trace meter updates:
1. Check `scoreCalculator.updateScore()` - logs score calculations
2. Check `onScoreUpdate()` callback - should be called
3. Check `updateAwarenessMeter()` - logs meter updates

### Common issues:
- **File colors not updating:** Check if mode is 'dev' and `fileDecorationProvider` exists
- **Meter not updating:** Check if mode is 'dev' and `onScoreUpdate` callback is set
- **Score stuck at -1:** No recent suggestions (last 10 seconds) and no debt

---

## 📝 Summary

**When agent changes an existing file:**

1. **VS Code fires event** → `awarenessMonitor.js` receives it
2. **Event analyzed** → `eventHandlers.js` detects AI-like change
3. **Suggestion created** → `agentSuggestionHandler.js` tracks it
4. **Debt updated** → `debtManager.js` adds file to debt
5. **File colors updated** → `fileColorsInExplorer.js` provides decoration
6. **Score calculated** → `scoreCalculator.js` computes awareness score
7. **Meter updated** → `status-bar/index.js` displays score

**Total files involved:** 8 files  
**Total callbacks:** 3 (updateFileColorsInExplorer, updateScore, onScoreUpdate)  
**Total time to UI update:** < 100ms (synchronous)

