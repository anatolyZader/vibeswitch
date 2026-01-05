# Architecture: Decoupled AwarenessMonitor and UsageStats

## Overview

This document describes the decoupled architecture between **AwarenessMonitor** (real-time awareness tracking) and **UsageStats** (long-term behavior tracking and dashboard).

## Design Goals

1. **Maximal Isolation**: AwarenessMonitor and UsageStats are completely independent
2. **Simple Callbacks**: Communication via optional callbacks, not direct dependencies
3. **Single Responsibility**: Each module has one clear purpose
4. **Simplicity**: No event emitter overhead - just simple callbacks

## Architecture

### Before (Tightly Coupled)

```
AwarenessMonitor
    ├─→ AgentSuggestionHandler (requires usageStats)
    ├─→ SessionTracker (requires usageStats)
    └─→ KeepAllDetector (requires usageStats)
            ↓
        UsageStats (direct method calls)
```

**Problems:**
- AwarenessMonitor must know about UsageStats
- Child modules must receive usageStats parameter
- Hard to test without UsageStats
- Tight coupling

### After (Decoupled with Simple Callbacks)

```
AwarenessMonitor
    ├─→ Optional callbacks object
    │       ├─→ onAISuggestion
    │       ├─→ onAISuggestionOutcome
    │       ├─→ onKeepAll
    │       └─→ onDebtCleared
    │
    ├─→ AgentSuggestionHandler (uses callbacks)
    ├─→ SessionTracker (uses callbacks)
    └─→ KeepAllDetector (uses callbacks)

Extension.js (Wiring Layer)
    ├─→ Creates AwarenessMonitor with callbacks
    ├─→ Creates UsageStats
    └─→ Wires callbacks to UsageStats methods
```

**Benefits:**
- AwarenessMonitor doesn't know about UsageStats
- Child modules only know about optional callbacks
- Easy to test (pass null/empty callbacks)
- Simple and straightforward (no event emitter complexity)
- Clear separation of concerns

## Callback System

### Optional Callbacks

AwarenessMonitor accepts an optional `callbacks` object in its constructor:

```javascript
new AwarenessMonitor(onScoreUpdate, {
    onAISuggestion: (data) => { ... },
    onAISuggestionOutcome: (data) => { ... },
    onKeepAll: (data) => { ... },
    onDebtCleared: (data) => { ... }
})
```

All callbacks are optional - AwarenessMonitor works fine without them.

### Callbacks Available

#### 1. `onAISuggestion`
Called when an AI suggestion is created.

**Data:**
```javascript
{
    filePath: string,      // URI string
    size: number,          // Characters
    timestamp: number,     // Unix timestamp
    isFileCreation: boolean
}
```

**Called by:** `AgentSuggestionHandler.recordAISuggestion()` and `recordAISuggestionBatch()`

#### 2. `onAISuggestionOutcome`
Called when a suggestion status changes (accepted/rejected/adapted).

**Data:**
```javascript
{
    filePath: string,
    status: string,        // 'accepted' | 'rejected' | 'adapted'
    size: number,
    reviewTime: number,    // Milliseconds
    editCount: number,
    isFileCreation: boolean,
    isExternalCreation: boolean,
    isFileWrite: boolean
}
```

**Called by:** `AgentSuggestionHandler.checkSuggestionStatus()`

#### 3. `onKeepAll`
Called when rapid acceptance pattern is detected (3+ acceptances in 2 seconds).

**Data:**
```javascript
{
    count: number,         // Number of rapid acceptances
    fileCount: number,     // Number of files affected
    totalSize: number,     // Total characters
    timestamp: number,
    window: number         // Detection window in ms
}
```

**Called by:** `KeepAllDetector.detectKeepAll()`

#### 4. `onDebtCleared`
Called when review debt is cleared for a file.

**Data:**
```javascript
{
    filePath: string,
    totalChanges: number,
    totalReviewTime: number,  // Milliseconds
    modificationCount: number
}
```

**Called by:** `SessionTracker.checkProgress()`

## Wiring (Extension.js)

The wiring happens in `extension.js` where both modules are created and connected:

```javascript
// Create modules independently
state.usageStats = new UsageStatsManager(context);

// Create AwarenessMonitor with optional callbacks wired to UsageStats
state.awarenessMonitor = new AwarenessMonitor(null, {
    onAISuggestion: (data) => {
        safe('trackAISuggestion', () => {
            state.usageStats?.trackAISuggestion(data);
        });
    },
    onAISuggestionOutcome: (data) => {
        safe('trackAISuggestionOutcome', () => {
            state.usageStats?.trackAISuggestionOutcome(data);
        });
    },
    onKeepAll: (data) => {
        safe('trackKeepAll', () => {
            if (state.usageStats?.trackKeepAll) {
                state.usageStats.trackKeepAll(data);
            }
        });
    },
    onDebtCleared: (data) => {
        safe('trackAIDebtCleared', () => {
            state.usageStats?.trackAIDebtCleared(data);
        });
    }
});
```

**Much simpler!** No event emitter, no subscriptions - just simple callbacks.

## Module Responsibilities

### AwarenessMonitor
**Purpose:** Real-time awareness tracking during development

**Responsibilities:**
- Distinguish agent-made changes from manual changes
- Monitor user reactions to AI suggestions
- Calculate awareness score (0-100)
- Track review debt
- Emit events about what's happening

**Does NOT:**
- Know about UsageStats
- Store long-term statistics
- Generate dashboards
- Track behavior over time

### UsageStats
**Purpose:** Long-term behavior tracking and dashboard

**Responsibilities:**
- Subscribe to AwarenessMonitor events
- Store historical statistics
- Generate reports and dashboards
- Track behavior patterns over time

**Does NOT:**
- Know about change classification
- Know about awareness scores
- Know about review debt
- Know about suggestion lifecycle

## Benefits of This Architecture

1. **Testability**: Each module can be tested independently
2. **Maintainability**: Changes to one module don't affect the other
3. **Extensibility**: Easy to add new event subscribers (analytics, logging, etc.)
4. **Clarity**: Clear separation of concerns
5. **Flexibility**: UsageStats can be disabled without breaking AwarenessMonitor

## Adding New Subscribers

To add a new subscriber (e.g., analytics service), just add it to the callbacks:

```javascript
// In extension.js
const analytics = new AnalyticsService();

state.awarenessMonitor = new AwarenessMonitor(null, {
    onAISuggestion: (data) => {
        state.usageStats?.trackAISuggestion(data);
        analytics.trackSuggestion(data);  // Add here
    },
    // ... other callbacks
});
```

Or create a wrapper function that calls multiple subscribers:

```javascript
const trackAISuggestion = (data) => {
    state.usageStats?.trackAISuggestion(data);
    analytics.trackSuggestion(data);
};

state.awarenessMonitor = new AwarenessMonitor(null, {
    onAISuggestion: trackAISuggestion,
    // ... other callbacks
});
```

No changes needed to AwarenessMonitor!

## Migration Notes

### Removed Dependencies
- `AwarenessMonitor` no longer takes `usageStats` parameter
- `AgentSuggestionHandler` no longer takes `usageStats` parameter
- `SessionTracker` no longer takes `usageStats` parameter
- `KeepAllDetector` no longer takes `usageStats` parameter

### New Dependencies
- All modules now take optional callback parameters instead
- `AwarenessMonitor` accepts optional `callbacks` object in constructor
- `extension.js` wires up callbacks to UsageStats methods

### Backward Compatibility
- Event data structure matches previous `usageStats` method signatures
- No changes needed to `UsageStatsManager` methods
- All existing functionality preserved

## Files Changed

1. **awarenessMonitor/awarenessMonitor.js**
   - Removed `usageStats` parameter
   - Added optional `callbacks` parameter
   - Stores callbacks as properties
   - Updated documentation

2. **awarenessMonitor/agentSuggestionHandler.js**
   - Changed `usageStats` → `callbacks` object
   - Changed direct calls → optional callback invocations

3. **awarenessMonitor/sessionTracker.js**
   - Changed `usageStats` → `onDebtCleared` callback
   - Changed direct calls → optional callback invocation

4. **awarenessMonitor/keepAllDetector.js**
   - Changed `usageStats` → `onKeepAll` callback
   - Changed direct calls → optional callback invocation

5. **extension.js**
   - Removed `usageStats` from AwarenessMonitor constructor
   - Added callback wiring to UsageStats methods

## Testing

### Testing AwarenessMonitor
```javascript
const events = [];
const monitor = new AwarenessMonitor(null, {
    onAISuggestion: (data) => events.push(data)
});

// Test awareness monitor...
// Assert callbacks were called
```

### Testing UsageStats
```javascript
const usageStats = new UsageStatsManager(context);
const monitor = new AwarenessMonitor(null, {
    onAISuggestion: (data) => usageStats.trackAISuggestion(data)
});

// Test usage stats...
```

## Why Simple Callbacks Instead of Event Emitter?

1. **Simplicity**: No need for EventEmitter when there's only one subscriber
2. **Less Code**: Fewer files, less complexity
3. **Direct**: Callbacks are called directly, no event loop overhead
4. **Clear**: Easy to see what's being called and when
5. **Sufficient**: For single-subscriber use case, callbacks are perfect

If you need multiple subscribers later, you can easily add a callback wrapper that calls multiple functions, or switch back to an event emitter. But for now, simple is better!

