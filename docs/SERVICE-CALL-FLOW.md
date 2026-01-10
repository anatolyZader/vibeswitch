# Service Call Flow in Awareness Module

## Overview

The awareness module uses a **layered architecture** with **event-driven** and **orchestration** patterns. The controller only calls `AwarenessService`, but other services are invoked through multiple mechanisms.

---

## Call Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    INPUT LAYER                                   │
│  AwarenessController                                             │
│  - startMonitoring()                                             │
│  - stopMonitoring()                                              │
│  - getScore()                                                    │
│  - handleExternallyCreatedFile()                                 │
│  - getStatus()                                                   │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ calls only
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                 APPLICATION LAYER (Orchestrator)                  │
│  AwarenessService                                                │
│  - Orchestrates all services                                     │
│  - Registers VS Code event listeners                            │
│  - Delegates to specialized services                            │
└─────────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ Event-Driven │   │ Direct Calls │   │ Callbacks    │
│ (VS Code)    │   │ (Orchestr.)  │   │ (Async)      │
└──────────────┘   └──────────────┘   └──────────────┘
```

---

## 1. Direct Orchestration Calls

`AwarenessService` directly calls methods on services it owns:

### **DebtService**
```javascript
// In AwarenessService.start()
this.debtService.loadDebt();  // Line 142

// In AwarenessService.stop()
this.debtService.saveDebt();  // Line 319

// In AwarenessService.updateScore()
this.debtService.calculateDebtScore(suggestions);  // Line 391
this.debtService.getDebtSummary();  // Line 397, 451

// In AwarenessService.getStatus()
this.debtService.getDebtSize();  // Line 612
```

### **FileWatcherService**
```javascript
// In AwarenessService.start()
this.fileWatcher.setupFileSystemWatcher();  // Line 281
this.fileWatcher.scanExistingFiles();  // Line 284

// In AwarenessService.stop()
this.fileWatcher.close();  // Line 356

// In AwarenessService.handleExternallyCreatedFile()
this.fileWatcher.handleExternallyCreatedFile(filePath);  // Line 474

// In AwarenessService.getStatus()
this.fileWatcher.isActive();  // Line 615
this.fileWatcher.getWatchedDirectories();  // Line 617
```

### **SessionService**
```javascript
// In AwarenessService.start() - periodic check
this.sessionTracker.checkProgress();  // Line 296 (every 10 seconds)

// In AwarenessService.stop()
this.sessionTracker.clear();  // Line 369
```

### **ChangeLedgerService**
```javascript
// In AwarenessService.stop()
await this.changeLedger.flush();  // Line 343
```

### **EventService**
```javascript
// In AwarenessService.stop()
await this.eventHandlers.dispose();  // Line 336
```

### **SuggestionService**
```javascript
// In AwarenessService - delegation methods
this.suggestionService.recordAISuggestion(document, change);  // Line 489
this.suggestionService.recordAISuggestionBatch(...);  // Line 501
this.suggestionService.processFileAsSuggestion(...);  // Line 513
this.suggestionService.recordUserEditBatch(...);  // Line 525
this.suggestionService.checkSuggestionStatus(...);  // Line 547
this.suggestionService.createSuggestionAndTrack(...);  // Line 595
```

---

## 2. Event-Driven Calls (VS Code Events)

**Most service methods are triggered by VS Code events**, not directly by the controller.

### Event Registration (in `AwarenessService.start()`)

```javascript
// VS Code events → EventService methods
this.vscodeAdapter.onDidChangeTextDocument((event) => {
    this.eventHandlers.onTextChange(event);  // Line 232
});

this.vscodeAdapter.onDidCreateFiles((event) => {
    this.eventHandlers.onFilesCreated(event);  // Line 238
});

this.vscodeAdapter.onDidSaveTextDocument((document) => {
    this.eventHandlers.onFileSaved(document);  // Line 244
});

this.vscodeAdapter.onDidOpenTextDocument((document) => {
    this.eventHandlers.onFileOpened(document);  // Line 250
});

this.vscodeAdapter.onDidCloseTextDocument((document) => {
    this.eventHandlers.onDocumentClose(document);  // Line 256
});

this.vscodeAdapter.onDidChangeTextEditorSelection((event) => {
    this.eventHandlers.onCursorMove(event);  // Line 262
});

this.vscodeAdapter.onDidChangeTextEditorVisibleRanges((event) => {
    this.eventHandlers.onScroll(event);  // Line 268
});

this.vscodeAdapter.onDidChangeActiveTextEditor((editor) => {
    this.eventHandlers.onEditorChange(editor);  // Line 274
});
```

### Event Flow Chain

```
VS Code Event
    │
    ▼
EventService.onTextChange()
    │
    ├─► ChangeClassifier.classify()
    │
    ├─► SuggestionService.recordAISuggestionBatch()
    │   │
    │   ├─► SuggestionAggregate.createSuggestion()
    │   ├─► SuggestionAggregate.addSuggestion()
    │   ├─► DebtService.addToDebt()
    │   └─► SuggestionService.checkSuggestionStatus() (scheduled)
    │
    └─► SuggestionService.recordUserEditBatch()
        │
        └─► Suggestion.recordUserEdit()
```

---

## 3. Service-to-Service Calls

Services call each other directly (dependency injection):

### **EventService → SuggestionService**
```javascript
// In EventService.onTextChange()
this.suggestionService.recordAISuggestionBatch(document, aggregatedChanges);  // Line 218

// In EventService.onTextChange()
this.suggestionService.recordUserEditBatch(document, aggregatedChanges);  // Line 238

// In EventService.onFilesCreated()
this.suggestionService.processFileAsSuggestion(fileUri, {...});  // Line 272

// In EventService.onFileSaved()
this.suggestionService.createSuggestionAndTrack({...}, size);  // Line 329

// In EventService.onFileOpened()
this.suggestionService.hasPendingSuggestions(uri);  // Line 380

// In EventService.onDocumentClose()
this.suggestionService.getSuggestions();  // Line 420
this.suggestionService.getSuggestionsByStatus('pending');  // Line 460
this.suggestionService.checkSuggestionStatus(suggestion.id);  // Line 504

// In EventService.onTextChange() (file write detection)
this.suggestionService.recordAISuggestionBatch(document, changes);  // Line 597
this.suggestionService.recordUserEditBatch(document, changes);  // Line 606
```

### **EventService → DebtService**
```javascript
// In EventService.onFileOpened()
this.debtService.hasUnreviewedDebt(uri);  // Line 377
```

### **EventService → SessionService**
```javascript
// In EventService.onFileOpened()
this.sessionService.initializeSession(uri);  // Line 386

// In EventService.onCursorMove()
this.sessionService.updateCursorActivity(uri);  // Line 456

// In EventService.onScroll()
this.sessionService.updateScrollActivity(uri);  // Line 535
```

### **EventService → ChangeLedgerService**
```javascript
// In EventService.onTextChange()
this.changeLedgerService.append({...});  // Line 175, 193
```

### **SessionService → DebtService**
```javascript
// In SessionService.initializeSession()
this.debtService.updateSession(uri, {...});  // Line 51

// In SessionService.checkProgress()
this.debtService.hasUnreviewedDebt(uri);  // Line 111
this.debtService.getDebt(uri);  // Line 140
this.debtService.markAsReviewed(uri, reviewTime);  // Line 143
```

### **SessionService → SuggestionService**
```javascript
// In SessionService.initializeSession()
this.suggestionService.getPendingSuggestionsForFile(uri);  // Line 112

// In SessionService.checkProgress()
this.suggestionService.getPendingSuggestionsForFile(uri);  // Line 177
```

### **FileWatcherService → SuggestionService**
```javascript
// In FileWatcherService.handleExternallyCreatedFile()
this.suggestionService.processFileAsSuggestion(fileUri, {...});  // Line 141
```

### **SuggestionService → DebtService**
```javascript
// In SuggestionService._addSuggestionAndTrack()
this.debtService.addToDebt(uri, contentLength, callback);  // Line 928 (in awarenessService.js context)
```

---

## 4. Callback-Based Calls

Services use callbacks to trigger updates asynchronously:

### **Score Updates**
```javascript
// In AwarenessService.start()
updateScore: () => this.updateScore()  // Passed to services

// Services call this callback:
- DebtService.addToDebt() → calls updateScore callback
- SuggestionService._addSuggestionAndTrack() → calls updateScore callback
- SuggestionService.checkSuggestionStatus() → calls updateScore callback
```

### **File Color Updates**
```javascript
// In AwarenessService.start()
updateFileColorsInExplorer: updateFileColorsInExplorer  // Passed to services

// Services call this callback:
- SuggestionService._addSuggestionAndTrack() → calls updateFileColorsInExplorer
- SessionService.checkProgress() → calls updateFileColorsInExplorer
```

### **Periodic Checks**
```javascript
// In AwarenessService.start()
setInterval(() => {
    this.updateScore();
    this.sessionTracker.checkProgress();  // Periodic call
}, 10000);
```

---

## 5. Timer-Based Calls

Services schedule their own method calls using timers:

### **SuggestionService**
```javascript
// In SuggestionService._addSuggestionAndTrack()
setTimeout(() => {
    this.checkSuggestionStatus(suggestion.id);  // After 5 seconds
}, 5000);

// In SuggestionService.checkSuggestionStatus()
setTimeout(() => {
    this.checkSuggestionStatus(suggestion.id);  // Retry after 10 seconds if pending
}, 10000);
```

---

## Complete Call Flow Example

### Example: User Types Code (AI Suggestion Detection)

```
1. User types in VS Code editor
   │
   ▼
2. VS Code fires onDidChangeTextDocument event
   │
   ▼
3. AwarenessService event listener (registered in start())
   │
   ▼
4. EventService.onTextChange(event)
   │
   ├─► ChangeClassifier.classify(changes)
   │   └─► Returns: { label: 'ai', confidence: 0.9 }
   │
   ├─► SuggestionService.recordAISuggestionBatch(document, aggregatedChanges)
   │   │
   │   ├─► SuggestionAggregate.createSuggestion({...})
   │   ├─► SuggestionAggregate.addSuggestion(suggestion)
   │   ├─► SuggestionService._addSuggestionAndTrack(suggestion, size)
   │   │   │
   │   │   ├─► DebtService.addToDebt(uri, size, updateScoreCallback)
   │   │   ├─► updateFileColorsInExplorer() callback
   │   │   ├─► setTimeout(() => checkSuggestionStatus(), 5000)
   │   │   └─► updateScore() callback
   │   │
   │   └─► SuggestionAggregate.createOrUpdateBatch(...)
   │
   └─► ChangeLedgerService.append({...})  // If enabled
```

### Example: User Reviews File (Session Tracking)

```
1. User opens file with unreviewed debt
   │
   ▼
2. VS Code fires onDidOpenTextDocument event
   │
   ▼
3. EventService.onFileOpened(document)
   │
   ├─► DebtService.hasUnreviewedDebt(uri)
   ├─► SuggestionService.hasPendingSuggestions(uri)
   │
   └─► SessionService.initializeSession(uri)
       │
       ├─► ReviewSession entity created
       ├─► DebtService.updateSession(uri, {...})
       └─► ReviewSessionStartedEvent published
```

### Example: User Moves Cursor (Review Engagement)

```
1. User moves cursor in file
   │
   ▼
2. VS Code fires onDidChangeTextEditorSelection event
   │
   ▼
3. EventService.onCursorMove(event)
   │
   └─► SessionService.updateCursorActivity(uri)
       │
       └─► ReviewSession.recordCursorMovement()
```

---

## Summary: How Services Are Called

| Service | How Called | Trigger |
|---------|-----------|---------|
| **EventService** | VS Code events → registered listeners | User actions (type, save, open, etc.) |
| **SuggestionService** | EventService calls it | AI code changes detected |
| **DebtService** | Direct calls from AwarenessService, EventService, SessionService, SuggestionService | Score updates, debt tracking |
| **SessionService** | EventService calls it, periodic check from AwarenessService | File opened, cursor moved, scroll |
| **FileWatcherService** | Direct calls from AwarenessService | File system events, external file creation |
| **ChangeLedgerService** | EventService calls it | Text changes (DIFF bullet tracking) |

---

## Key Architecture Patterns

1. **Orchestration Pattern**: `AwarenessService` orchestrates all services
2. **Event-Driven**: VS Code events trigger `EventService`, which calls other services
3. **Dependency Injection**: Services receive other services as constructor parameters
4. **Callback Pattern**: Services use callbacks for async coordination
5. **Timer-Based**: Services schedule their own method calls

---

## Why Controller Only Calls AwarenessService

The controller is **thin** and only needs to:
- Start/stop monitoring
- Get status/score
- Handle external file creation

All other functionality is **event-driven** or **orchestrated internally** by `AwarenessService`. This keeps the controller simple and the architecture decoupled.

---

**Document Version**: 1.0  
**Last Updated**: 2024
