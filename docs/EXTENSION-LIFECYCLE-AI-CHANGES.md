# Extension.js Role in AI Change Detection Lifecycle

## Overview

This document explains how `extension.js` orchestrates the detection and tracking of AI-generated code changes when Cursor agent makes edits.

---

    What happens after a Cursor agent prompt ->
    Agent makes changes → VS Code fires onDidChangeTextDocument ->
    Event flows through the system:

   VS Code Event
     ↓
   VSCodeAdapter (adapter layer)
     ↓
   AwarenessEventListener.onTextChange() (input layer)
     ↓
   AwarenessEngine.classifyTextChange() (orchestrator)
     ↓
   ClassificationService.classifyEvent() (application service)
     ↓
   ChangeClassifier.classify() (detection logic)
     ↓
   Returns: { label: 'ai', confidence: 0.85, reasons: [...] }
     ↓
   SuggestionLifecycleService.recordAISuggestionBatch()
     ↓
   Creates Suggestion entity → Adds to debt → Publishes domain event
     ↓
   Domain event → extension.js → UsageStats.trackAISuggestion()
     ↓
   UI updates via callbacks → Status bar shows awareness score




## Complete Flow: From Agent Prompt to Change Tracking

### Phase 1: Extension Activation (One-Time Setup)

**Location**: `extension.js:145-294`

```
1. VS Code calls activate(context)
   ↓
2. extension.js creates ExtensionState and DIContainer
   ↓
3. extension.js calls compositionRoot.compose()
   - Builds adapters (VSCodeAdapter, PersistenceAdapter, etc.)
   - Builds domain services
   - Creates AwarenessEngine with all dependencies
   ↓
4. extension.js wires AwarenessEngine to state
   state.awarenessEngine = awarenessEngine
   ↓
5. extension.js initializes helpers
   - Creates command handlers
   - Sets up UI update functions
   ↓
6. extension.js sets callbacks on AwarenessEngine
   awarenessEngine.setCallbacks({
       onScoreUpdate: () => updateAwarenessMeter()
   })
   ↓
7. extension.js subscribes to internal domain events (not VS Code events)
   - Creates event listeners for UsageStats integration
   - Listens to internal notifications: aiSuggestion, aiSuggestionOutcome, keepAll, debtCleared
   - These are internal events published by services, not external VS Code events
   ↓
8. extension.js sets up UsageStats listeners
   - Tracks file opens, edits, saves (separate from awareness tracking)
```

**Key Point**: `extension.js` is the **composition root** - it wires everything together but doesn't handle events directly.

---

### Phase 2: User Switches to DEV Mode (Enables Monitoring)

**Location**: `initializeHelpers.js:144-155` (via command handler)

```
1. User clicks status bar or runs command: vibeswitch.switchMode → 'dev'
   ↓
2. Command handler calls startAwarenessMonitor()
   ↓
3. startAwarenessMonitor() calls:
   state.awarenessEngine.start(context, updateFileColorsInExplorer, 'dev')
   ↓
4. AwarenessEngine.start() creates AwarenessEventListener
   this.eventHandlers = new AwarenessEventListener(this)
   ↓
5. AwarenessEngine.start() subscribes to VS Code events:
   - onDidChangeTextDocument → eventHandlers.onTextChange()
   - onDidCreateFiles → eventHandlers.onFilesCreated()
   - onDidSaveTextDocument → eventHandlers.onFileSaved()
   - onDidOpenTextDocument → eventHandlers.onFileOpened()
   - onDidCloseTextDocument → eventHandlers.onDocumentClose()
   - onDidChangeTextEditorSelection → eventHandlers.onCursorMove()
   - onDidChangeTextEditorVisibleRanges → eventHandlers.onScroll()
   - onDidChangeActiveTextEditor → eventHandlers.onEditorChange()
   ↓
6. Monitoring is now ACTIVE
```

**Key Point**: `extension.js` doesn't subscribe to events directly - it delegates to `AwarenessEngine`, which sets up the event listeners.

---

### Phase 3: Cursor Agent Makes Changes (Real-Time Detection)

**Scenario**: User sends prompt in Cursor agent chat → Agent begins making code changes

#### Step 1: VS Code Fires Text Change Event

```
Cursor agent edits file: example.js
   ↓
VS Code fires: onDidChangeTextDocument event
   {
     document: TextDocument,
     contentChanges: [
       { range: Range, text: "new code", rangeLength: 0 }
     ]
   }
```

#### Step 2: Event Flows Through Adapter (Thin Wrapper)

**Location**: `awarenessEngine.js:283-286` and `awarenessVSCodeAdapter.js:28-29`

```
VS Code event
   ↓
vscodeAdapter.onDidChangeTextDocument(handler)
   ↓ (adapter is just a thin wrapper - immediately calls VS Code API)
vscode.workspace.onDidChangeTextDocument(handler)
   ↓ (VS Code directly calls the handler - no interception)
safe('onTextChange', () => this.eventHandlers.onTextChange(event))
```

**Key Point**: The adapter is a **thin abstraction layer** - it doesn't intercept or process events. It just provides a consistent interface for the Ports and Adapters pattern. VS Code events go **directly** to the event handlers. The adapter is transparent in the event flow - it's only there for testability and abstraction.

#### Step 3: Event Listener Receives Event

**Location**: `awarenessEventListener.js:37-42`

```
eventHandlers.onTextChange(event)
   ↓
Checks: if (event.contentChanges.length === 0) return
   ↓
Delegates to engine:
   this.engine.classifyTextChange(event)
```

**Key Point**: `AwarenessEventListener` is the **input layer** - it receives raw VS Code events and delegates to the engine.

#### Step 4: Engine Classifies the Change

**Location**: `awarenessEngine.js:867-868`

```
engine.classifyTextChange(event)
   ↓
Delegates to ClassificationService:
   this.classificationService.classifyEvent(event, onClassified)
```

**Key Point**: `AwarenessEngine` is the **orchestrator** - it coordinates services but doesn't implement logic.

#### Step 5: Classification Service Processes Change

**Location**: `classificationService.js:80-120`

```
classificationService.classifyEvent(event, onClassified)
   ↓
1. Extracts changes from event
   - Converts VS Code change objects to Change entities
   ↓
2. Debounces changes (200ms window)
   - Groups rapid changes together
   - Prevents duplicate processing
   ↓
3. Sends to ChangeClassifier
   this.changeClassifier.classify(changes, ...)
   ↓
4. ChangeClassifier analyzes:
   - Change size (large = AI)
   - Change speed (rapid = AI)
   - Change pattern (scattered = AI)
   - Change timing (burst = AI)
   ↓
5. Returns classification:
   {
     label: 'ai' | 'user' | 'formatter' | 'unknown',
     confidence: 0.0-1.0,
     reasons: ['large size', 'rapid changes', ...]
   }
```

**Key Point**: Classification happens **asynchronously** with debouncing - multiple rapid changes are grouped.

#### Step 6: Classification Result Triggers Actions

**Location**: `classificationService.js:145-196`

```
Classification result received
   ↓
If label === 'ai':
   1. Records change batch in ChangeLedger
   2. Routes to SuggestionLifecycleService
      suggestionLifecycleService.recordAISuggestionBatch(document, changes)
   ↓
If label === 'user':
   1. Records change batch in ChangeLedger
   2. Routes to SuggestionLifecycleService
      suggestionLifecycleService.recordUserEditBatch(document, changes)
   ↓
If label === 'formatter':
   1. Records change batch in ChangeLedger
   2. Does NOT route (formatters are neutral)
```

#### Step 7: Suggestion Lifecycle Service Creates Suggestions

**Location**: `suggestionLifecycleService.js`

```
recordAISuggestionBatch(document, changes)
   ↓
1. Creates Suggestion entities from changes
   - Each change becomes a Suggestion
   - Suggestion has: id, document, range, text, size, status='pending'
   ↓
2. Adds to SuggestionAggregate
   this.suggestionAggregate.addSuggestion(suggestion)
   ↓
3. Tracks in DebtService
   this.debtService.addDebt(suggestion)
   ↓
4. Publishes domain event
   messagingAdapter.publish('aiSuggestion', new AISuggestionEvent(...))
```

#### Step 8: Domain Event Notification (Internal Event)

**Location**: `suggestionLifecycleService.js` and `extension.js:208-211`

```
Service publishes domain event (internal notification):
   messagingAdapter.publishAISuggestionEvent(...)
   ↓
MessagingAdapter emits internal event (EventEmitter):
   eventEmitter.emit('aiSuggestion', payload)
   ↓
extension.js listens to internal event:
   createUsageStatsEventListenersDisposable() handler receives event
   ↓
Handler calls:
   state.usageStats.trackAISuggestion(payload.event)
```

**Key Point**: 
- **VS Code events** come from VS Code API (external) - like `onDidChangeTextDocument`
- **Domain events** are internal notifications published by services (not external events)
- Services don't emit VS Code events - they only publish internal domain events for cross-module communication

#### Step 9: UI Updates Triggered

**Location**: `extension.js:198-206`

```
Suggestion created → DebtService updates
   ↓
DebtService calls: this.onScoreUpdate()
   ↓
Callback set in extension.js:
   awarenessEngine.setCallbacks({
       onScoreUpdate: () => updateAwarenessMeter()
   })
   ↓
updateAwarenessMeter() updates status bar
   - Shows awareness score
   - Shows pending suggestions count
   - Updates file colors in explorer
```

---

## Extension.js Role Summary

### What Extension.js DOES:

1. **Composition Root**: Wires all dependencies together
   - Creates adapters, services, domain services
   - Injects dependencies into AwarenessEngine

2. **Lifecycle Management**: Manages extension activation/deactivation
   - Sets up VS Code event subscriptions (for UsageStats - separate from awareness)
   - Registers commands
   - Initializes UI components

3. **Cross-Module Integration**: Connects awareness module to other modules
   - Listens to internal domain events (published by services) for UsageStats
   - Sets up callbacks for UI updates

4. **Error Handling**: Catches and reports errors during activation

**Key Distinction**:
- **VS Code Events**: External events from VS Code API (onDidChangeTextDocument, etc.)
- **Domain Events**: Internal notifications published by services (aiSuggestion, debtCleared, etc.)
- Services don't emit VS Code events - they only publish internal domain events

### What Extension.js DOES NOT DO:

1. **Does NOT subscribe to VS Code text change events directly**
   - Delegates to AwarenessEngine.start()
   - AwarenessEngine sets up event listeners

2. **Does NOT implement change detection logic**
   - Delegates to ClassificationService
   - ClassificationService delegates to ChangeClassifier

3. **Does NOT manage suggestion lifecycle**
   - Delegates to SuggestionLifecycleService
   - SuggestionLifecycleService manages domain entities

---

## Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│ extension.js (Composition Root)                         │
│ - Wires dependencies                                     │
│ - Sets up cross-module integration                       │
│ - Manages lifecycle                                      │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ AwarenessEngine (Application Orchestrator)              │
│ - Coordinates services                                   │
│ - Sets up event listeners (via adapter)                 │
│ - Manages callbacks                                      │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ VSCodeAdapter (Thin Wrapper - Ports & Adapters)         │
│ - Provides abstraction for VS Code API                  │
│ - Does NOT intercept events (transparent wrapper)      │
│ - Enables testability (can swap with mock adapter)     │
│ - Implementation: return vscode.workspace.onDid...()  │
└─────────────────────────────────────────────────────────┘
                        ↓ (VS Code events flow directly)
┌─────────────────────────────────────────────────────────┐
│ AwarenessEventListener (Input Layer)                    │
│ - Receives VS Code events directly                      │
│ - Delegates to engine                                    │
│ - Manages input-layer state (dwell timers, caches)      │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ ClassificationService (Application Service)             │
│ - Manages change classification                         │
│ - Debounces changes                                     │
│ - Routes classified changes                             │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ ChangeClassifier (Domain Logic)                         │
│ - Analyzes changes                                      │
│ - Determines AI vs User vs Formatter                    │
│ - Returns classification result                          │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ SuggestionLifecycleService (Application Service)        │
│ - Creates suggestions                                   │
│ - Tracks lifecycle                                      │
│ - Publishes domain events                                │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ Domain Events → extension.js → UsageStats              │
│ UI Updates → extension.js → Status Bar                 │
└─────────────────────────────────────────────────────────┘
```

---

## Event Types: External vs Internal

### External Events (VS Code/UI/Behavioral)
**Source**: VS Code API, User Actions, System Behavior

These are the **real events** that drive the system:
- `onDidChangeTextDocument` - VS Code fires when text changes
- `onDidCreateFiles` - VS Code fires when files are created
- `onDidChangeTextEditorSelection` - VS Code fires when cursor moves
- Command invocations - User clicks button or runs command
- File system events - Files created/deleted externally

**Flow**: VS Code → Adapter → EventListener → Engine → Services

### Internal Events (Domain Events/Notifications)
**Source**: Services publish these as internal notifications

These are **not external events** - they're internal notifications for cross-module communication:
- `aiSuggestion` - Published by SuggestionLifecycleService when suggestion created
- `debtCleared` - Published by DebtService when debt is cleared
- `scoreUpdate` - Published by AwarenessEngine when score changes

**Flow**: Service → MessagingAdapter → EventEmitter → extension.js → UsageStats

**Key Point**: 
- Services **don't emit VS Code events** - they only publish internal domain events
- The real events come from VS Code/UI/behavior
- Domain events are just internal notifications for cross-module integration

---

## Key Design Principles

### 1. **Separation of Concerns**
- `extension.js`: Composition and lifecycle
- `AwarenessEngine`: Orchestration
- `AwarenessEventListener`: Input handling
- `ClassificationService`: Change processing
- `ChangeClassifier`: Detection logic

### 2. **Dependency Injection**
- All dependencies injected via constructor
- No hidden dependencies (no `require()` inside classes)
- Easy to test (can inject mocks)

### 3. **Event-Driven Architecture**
- **VS Code events** (external) → Input layer → Engine → Services
  - These come from VS Code API (onDidChangeTextDocument, etc.)
- **Domain events** (internal notifications) → Extension → Other modules
  - These are published by services for cross-module communication
  - Services don't emit VS Code events - only internal domain events
- **Callbacks** → Extension → UI updates

### 4. **Ports and Adapters Pattern**
- Adapters abstract VS Code API
- Services depend on ports (interfaces), not implementations
- Can swap adapters without changing services

---

## Example: Complete Flow for Single Agent Change

```
1. User: "Add error handling to login function"
   ↓
2. Cursor agent edits: login.js (adds try-catch block)
   ↓
3. VS Code fires: onDidChangeTextDocument
   ↓
4. VS Code directly calls handler (via adapter wrapper - transparent)
   ↓
5. AwarenessEventListener.onTextChange(event) (input layer receives event)
   ↓
6. AwarenessEngine.classifyTextChange(event)
   ↓
7. ClassificationService.classifyEvent(event)
   ↓
8. ChangeClassifier.classify(changes)
   - Analyzes: large size (150 chars), rapid (0ms), scattered (no)
   - Returns: { label: 'ai', confidence: 0.85, reasons: ['large size', 'rapid'] }
   ↓
9. ClassificationService routes to SuggestionLifecycleService
   ↓
10. SuggestionLifecycleService.recordAISuggestionBatch()
    - Creates Suggestion entity
    - Adds to aggregate
    - Adds to debt
    - Publishes 'aiSuggestion' event
   ↓
11. Domain event → extension.js → UsageStats.trackAISuggestion()
   ↓
12. DebtService calls onScoreUpdate()
   ↓
13. Callback → extension.js → updateAwarenessMeter()
   ↓
14. Status bar updates: "Awareness: 45% (3 pending)"
   ↓
15. File color updates in explorer (red = unreviewed)
```

---

## Summary

**Extension.js Role**: 
- **Composition Root**: Wires all dependencies
- **Lifecycle Manager**: Handles activation/deactivation
- **Integration Point**: Connects awareness module to other modules
- **NOT an Event Handler**: Delegates event handling to AwarenessEngine

**Key Insight**: `extension.js` is the **orchestrator of orchestrators** - it sets up the system but delegates actual work to specialized modules.
