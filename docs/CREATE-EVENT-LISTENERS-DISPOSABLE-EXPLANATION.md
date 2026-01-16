# `createUsageStatsEventListenersDisposable` Explanation

## Code Location

**File**: `extension.js:220`
```javascript
const usageStatsEventListenersDisposable = createUsageStatsEventListenersDisposable(eventEmitter, state);
context.subscriptions.push(usageStatsEventListenersDisposable);
```

---

## What It Does

This function sets up **cross-module event listeners** that connect the awareness module's domain events to the UsageStats module.

### Step-by-Step Breakdown

#### 1. **Function Call**
```javascript
const eventListenersDisposable = createEventListenersDisposable(eventEmitter, state);
```

**Parameters**:
- `eventEmitter` - Node.js EventEmitter from the messaging adapter
- `state` - Extension state (contains `usageStats` service)

**Returns**: A `vscode.Disposable` object that can clean up all listeners

---

#### 2. **What `eventEmitter` Is**

**Source**: `extension.js:209`
```javascript
const eventEmitter = adapters.messagingAdapter.getEventEmitter();
```

**What it is**:
- A Node.js `EventEmitter` instance from `AwarenessEventEmitterMessagingAdapter`
- Used by the awareness module to publish domain events
- Services publish events like: `aiSuggestion`, `debtCleared`, `keepAll`, etc.

**How it works**:
```javascript
// In awareness module (SuggestionLifecycleService):
messagingAdapter.publishAISuggestionEvent(event)
  ↓
messagingAdapter.eventEmitter.emit('aiSuggestion', payload)
  ↓
// extension.js listeners receive the event
```

---

#### 3. **What `createUsageStatsEventListenersDisposable` Does**

**Location**: `extension.js:99-133`

```javascript
function createUsageStatsEventListenersDisposable(eventEmitter, state) {
    // Define handlers for 4 domain events
    const handlers = {
        aiSuggestion: (payload) => {
            safe('handleAISuggestionEvent', () => {
                if (state.usageStats) {
                    state.usageStats.trackAISuggestion(payload.event);
                }
            });
        },
        aiSuggestionOutcome: (payload) => {
            safe('handleAISuggestionOutcomeEvent', () => {
                if (state.usageStats) {
                    state.usageStats.trackAISuggestionOutcome(payload.event);
                }
            });
        },
        keepAll: (payload) => {
            safe('handleKeepAllEvent', () => {
                if (state.usageStats?.trackKeepAll) {
                    state.usageStats.trackKeepAll(payload.event);
                }
            });
        },
        debtCleared: (payload) => {
            safe('handleDebtClearedEvent', () => {
                if (state.usageStats) {
                    state.usageStats.trackAIDebtCleared(payload.event);
                }
            });
        }
    };

    // Register all handlers with event emitter
    Object.entries(handlers).forEach(([event, handler]) => {
        eventEmitter.on(event, handler);
    });

    // Return disposable that removes all listeners
    return new vscode.Disposable(() => {
        Object.entries(handlers).forEach(([event, handler]) => {
            eventEmitter.off(event, handler);
        });
    });
}
```

**What it does**:
1. **Defines 4 event handlers** - One for each domain event type
2. **Registers handlers** - Calls `eventEmitter.on(event, handler)` for each
3. **Returns a Disposable** - When disposed, removes all listeners

---

## Complete Flow

### Setup (During Activation)

```
1. extension.js gets eventEmitter from messagingAdapter
   const eventEmitter = adapters.messagingAdapter.getEventEmitter();
   
2. extension.js creates disposable with handlers
   const usageStatsEventListenersDisposable = createUsageStatsEventListenersDisposable(eventEmitter, state);
   // This registers 4 listeners:
   // - eventEmitter.on('aiSuggestion', handler)
   // - eventEmitter.on('aiSuggestionOutcome', handler)
   // - eventEmitter.on('keepAll', handler)
   // - eventEmitter.on('debtCleared', handler)
   
3. extension.js adds disposable to context subscriptions
   context.subscriptions.push(eventListenersDisposable);
   // VS Code will call dispose() when extension deactivates
```

### Runtime (When Events Occur)

```
1. Awareness module publishes domain event
   messagingAdapter.publishAISuggestionEvent(event)
     ↓
2. Messaging adapter emits event
   eventEmitter.emit('aiSuggestion', payload)
     ↓
3. Handler in extension.js receives event
   handlers.aiSuggestion(payload)
     ↓
4. Handler calls UsageStats
   state.usageStats.trackAISuggestion(payload.event)
```

### Cleanup (During Deactivation)

```
1. VS Code calls context.subscriptions.dispose()
     ↓
2. Disposable.dispose() is called
   usageStatsEventListenersDisposable.dispose()
     ↓
3. All listeners are removed
   eventEmitter.off('aiSuggestion', handler)
   eventEmitter.off('aiSuggestionOutcome', handler)
   eventEmitter.off('keepAll', handler)
   eventEmitter.off('debtCleared', handler)
```

---

## Why Use a Disposable?

**VS Code Disposable Pattern**: VS Code extensions must clean up resources when deactivated.

**Without Disposable**:
```javascript
// ❌ Bad - listeners never removed (memory leak)
eventEmitter.on('aiSuggestion', handler);
eventEmitter.on('debtCleared', handler);
// When extension deactivates, listeners remain in memory
```

**With Disposable**:
```javascript
// ✅ Good - listeners removed on deactivation
const disposable = new vscode.Disposable(() => {
    eventEmitter.off('aiSuggestion', handler);
    eventEmitter.off('debtCleared', handler);
});
context.subscriptions.push(disposable);
// VS Code automatically calls dispose() when extension deactivates
```

---

## Event Types Handled

| Event | Source | Handler Action |
|-------|--------|----------------|
| `aiSuggestion` | `SuggestionLifecycleService` | `usageStats.trackAISuggestion()` |
| `aiSuggestionOutcome` | `SuggestionLifecycleService` | `usageStats.trackAISuggestionOutcome()` |
| `keepAll` | `SuggestionLifecycleService` | `usageStats.trackKeepAll()` |
| `debtCleared` | `DebtService` | `usageStats.trackAIDebtCleared()` |

---

## Key Points

1. **Cross-Module Integration**: Connects awareness module (publisher) to UsageStats module (subscriber)

2. **Decoupled**: Awareness module doesn't know about UsageStats - it just publishes events

3. **Automatic Cleanup**: Disposable ensures listeners are removed when extension deactivates

4. **Safe Error Handling**: Each handler wrapped in `safe()` to prevent crashes

5. **Optional**: Checks `if (state.usageStats)` - won't crash if UsageStats isn't available

---

## Example: Complete Event Flow

```
User accepts AI suggestion
   ↓
SuggestionLifecycleService.checkSuggestionStatus()
   ↓
Suggestion marked as 'accepted'
   ↓
messagingAdapter.publishAISuggestionOutcomeEvent(event)
   ↓
eventEmitter.emit('aiSuggestionOutcome', payload)
   ↓
createEventListenersDisposable handler receives event
   ↓
state.usageStats.trackAISuggestionOutcome(payload.event)
   ↓
UsageStats records the event for analytics
```

---

## Summary

**`createUsageStatsEventListenersDisposable(eventEmitter, state)`**:
- Sets up listeners for 4 domain events
- Connects awareness module events to UsageStats module
- Returns a disposable for automatic cleanup
- Ensures no memory leaks when extension deactivates

**It's the bridge between the awareness module (publisher) and UsageStats module (subscriber).**
