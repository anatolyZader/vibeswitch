# EventService Role and Responsibilities

## Overview

`EventService` is the **event handler coordinator** for the awareness module. It acts as the **bridge between VS Code events and the awareness monitoring system**, translating user actions and code changes into domain events and service calls.

---

## Primary Role

**EventService is the VS Code Event → Domain Action Translator**

It receives raw VS Code events and:
1. **Classifies** changes (AI vs User vs Formatter)
2. **Orchestrates** appropriate service calls
3. **Tracks** review engagement (cursor, scroll, time)
4. **Manages** classifier state and caches

---

## Key Responsibilities

### 1. **Change Classification** 🎯

**Primary Function**: Determine if code changes are AI-generated, user-made, or formatter-applied.

```javascript
// Uses ChangeClassifier with debouncing (200ms)
this.changeClassifier.addEvent(event, (document, classification, aggregatedChanges) => {
    if (classification.label === 'ai') {
        // AI-generated code detected
        this.suggestionService.recordAISuggestionBatch(...);
    } else if (classification.label === 'user') {
        // User edit detected
        this.suggestionService.recordUserEditBatch(...);
    } else if (classification.label === 'formatter') {
        // Formatter applied - neutral, don't record
    }
});
```

**Why it's critical**: Without classification, the system can't distinguish AI code from user code, making awareness tracking impossible.

---

### 2. **VS Code Event Handling** 📡

Handles **8 types of VS Code events**:

| Event Handler | VS Code Event | Purpose |
|--------------|---------------|---------|
| `onTextChange()` | `onDidChangeTextDocument` | Detect AI code changes and user edits |
| `onFilesCreated()` | `onDidCreateFiles` | Detect AI-created files |
| `onFileSaved()` | `onDidSaveTextDocument` | Detect entire file writes (AI file operations) |
| `onFileOpened()` | `onDidOpenTextDocument` | Initialize review sessions for files with debt |
| `onDocumentClose()` | `onDidCloseTextDocument` | Flush classifier, close reviews |
| `onCursorMove()` | `onDidChangeTextEditorSelection` | Track review engagement (cursor activity) |
| `onScroll()` | `onDidChangeTextEditorVisibleRanges` | Track review engagement (scroll activity) |
| `onEditorChange()` | `onDidChangeActiveTextEditor` | Flush previous document, track active editor |

---

### 3. **Review Engagement Tracking** 👁️

Tracks user engagement with AI suggestions:

- **Cursor Movement**: Detects when cursor enters/leaves suggestion ranges
- **Dwell Time**: Requires 1000ms dwell time before marking as "reviewed"
- **Scroll Activity**: Counts scroll events as engagement
- **Review State**: Maintains separate review state (not in suggestion objects)

```javascript
// In onCursorMove()
if (isPositionInRange(position, suggestion.range)) {
    // Cursor entered suggestion range
    const dwellTimer = setTimeout(() => {
        suggestion.reviewed = true;  // After 1 second
        this.suggestionService.checkSuggestionStatus(suggestion.id);
    }, 1000);
}
```

---

### 4. **Service Orchestration** 🔄

Coordinates calls to other services based on event classification:

**EventService → SuggestionService**
- `recordAISuggestionBatch()` - When AI changes detected
- `recordUserEditBatch()` - When user edits detected
- `processFileAsSuggestion()` - When files created
- `createSuggestionAndTrack()` - When files saved
- `checkSuggestionStatus()` - When cursor dwells on suggestion
- `hasPendingSuggestions()` - When file opened
- `getSuggestions()` - When document closed

**EventService → SessionService**
- `initializeSession()` - When file with debt opened
- `updateCursorActivity()` - When cursor moves
- `updateScrollActivity()` - When user scrolls

**EventService → DebtService**
- `hasUnreviewedDebt()` - When file opened

**EventService → ChangeLedgerService**
- `append()` - Record change batches and DIFF bullets

---

### 5. **State Management** 💾

Manages internal state for:
- **ChangeClassifier**: Debounced change classification (200ms window)
- **Active Review Tracking**: Map of document URI → review state
- **Save Cache**: Duplicate detection (uri + version as primary key)
- **Previous Document**: Track for flush on editor switch

---

### 6. **Mode Configuration** ⚙️

Configures classifier thresholds based on mode:

- **VIBE Mode**: More permissive (lower thresholds) - detects more AI changes
- **DEV Mode**: Conservative (higher thresholds) - fewer false positives

```javascript
_getClassifierConfig(mode) {
    if (mode === 'vibe') {
        return {
            pureInsertionSize: 15,  // Lower threshold
            largeInsertionThreshold: 80,
            rapidScatteredEventCount: 6  // Lower threshold
        };
    }
    return baseConfig;  // DEV mode - conservative
}
```

---

## Event Flow Examples

### Example 1: User Types Code (AI Detection)

```
1. User types in editor
   │
   ▼
2. VS Code: onDidChangeTextDocument event
   │
   ▼
3. EventService.onTextChange(event)
   │
   ├─► ChangeClassifier.addEvent(event, callback)
   │   │ (debounced 200ms)
   │   │
   │   └─► Classification: { label: 'ai', confidence: 0.9 }
   │
   ├─► SuggestionService.recordAISuggestionBatch(document, changes)
   │   │
   │   ├─► Creates Suggestion entity
   │   ├─► Adds to SuggestionAggregate
   │   └─► Schedules status check (5 seconds)
   │
   └─► ChangeLedgerService.append({...})  // DIFF bullet tracking
```

### Example 2: User Opens File with Debt

```
1. User opens file
   │
   ▼
2. VS Code: onDidOpenTextDocument event
   │
   ▼
3. EventService.onFileOpened(document)
   │
   ├─► DebtService.hasUnreviewedDebt(uri)
   ├─► SuggestionService.hasPendingSuggestions(uri)
   │
   └─► SessionService.initializeSession(uri)
       │
       ├─► Creates ReviewSession entity
       ├─► DebtService.updateSession(uri, {...})
       └─► Publishes ReviewSessionStartedEvent
```

### Example 3: User Moves Cursor (Review Tracking)

```
1. User moves cursor
   │
   ▼
2. VS Code: onDidChangeTextEditorSelection event
   │
   ▼
3. EventService.onCursorMove(event)
   │
   ├─► SessionService.updateCursorActivity(uri)
   │   └─► ReviewSession.recordCursorMovement()
   │
   └─► Check if cursor in suggestion range
       │
       ├─► If yes: Start dwell timer (1000ms)
       │   └─► After 1s: Mark suggestion as reviewed
       │
       └─► If no: Close active review
```

---

## Key Features

### 1. **Event Batching** ⚡
- Calls classifier **once per event** (not per change)
- Prevents duplicate recording
- Aggregates changes within debounce window

### 2. **Duplicate Detection** 🔍
- Uses `uri + version` as primary key
- Prevents processing same file save twice
- Cache cleanup (keeps last 100 entries)

### 3. **Review State Separation** 🎯
- Review state stored separately from suggestion objects
- Prevents domain entity pollution
- Enables proper cleanup

### 4. **Proper Flushing** 🧹
- Flushes classifier on document close
- Flushes on editor change (prevents memory leaks)
- Flushes all on dispose

### 5. **Formatter Neutrality** 🔧
- Formatters don't mark suggestions as "adapted"
- Prevents false positives from auto-formatting
- Formatter changes are logged but not tracked

---

## Architecture Position

```
┌─────────────────────────────────────────────────────────┐
│              VS Code Extension Host                    │
│  (Infrastructure Layer)                                │
└─────────────────────────────────────────────────────────┘
                        │
                        │ VS Code Events
                        ▼
┌─────────────────────────────────────────────────────────┐
│              EventService                                │
│  (Application Service - Event Handler)                  │
│  - Receives VS Code events                              │
│  - Classifies changes                                    │
│  - Orchestrates service calls                           │
└─────────────────────────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Suggestion   │ │ Session      │ │ Debt        │
│ Service      │ │ Service      │ │ Service     │
└──────────────┘ └──────────────┘ └──────────────┘
```

---

## Why EventService Exists

### **Separation of Concerns**

Without `EventService`, `AwarenessService` would need to:
- Handle all 8 VS Code event types
- Implement change classification logic
- Manage classifier state
- Track review engagement
- Handle duplicate detection

This would make `AwarenessService` **too large and complex**.

### **Single Responsibility**

`EventService` has one clear responsibility:
> **"Translate VS Code events into domain actions"**

### **Testability**

`EventService` can be tested independently:
- Mock VS Code events
- Verify correct service calls
- Test classification logic
- Test review tracking

---

## Dependencies

**Receives** (Constructor):
- `suggestionService` - For recording suggestions
- `debtService` - For checking debt
- `sessionService` - For tracking review sessions
- `changeLedgerService` - For DIFF bullet tracking
- `vscodePort` - VS Code operations (port)
- `loggerPort` - Logging (port)

**Uses** (Domain):
- `ChangeClassifier` - Change classification utility
- `buildDiffBullets` - DIFF bullet generation
- Domain utilities (`isNonCodeDocument`, `isPositionInRange`, etc.)

---

## Summary

**EventService is the Event Handler Coordinator** that:

1. ✅ Receives VS Code events (8 types)
2. ✅ Classifies changes (AI/User/Formatter)
3. ✅ Orchestrates service calls based on classification
4. ✅ Tracks review engagement (cursor, scroll, time)
5. ✅ Manages classifier state and caches
6. ✅ Handles cleanup and flushing

**Without EventService**, the awareness module would have no way to:
- Detect AI-generated code
- Track user review behavior
- Distinguish AI from user edits
- Monitor engagement metrics

It's the **critical bridge** between infrastructure (VS Code) and domain logic (awareness tracking).

---

**Document Version**: 1.0  
**Last Updated**: 2024
