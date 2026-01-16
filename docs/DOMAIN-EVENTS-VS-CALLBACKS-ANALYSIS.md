# Domain Events vs Callbacks: Analysis for Engine-Based Design

## Current State: Dual Notification System

The awareness module currently uses **BOTH** callbacks and domain events:

### Callbacks (Direct Function Calls)
```javascript
// In AwarenessEngine
this.onAISuggestion = null;
this.onAISuggestionOutcome = null;
this.onKeepAll = null;
this.onDebtCleared = null;
this.onScoreUpdate = null;

// Set via setCallbacks()
awarenessEngine.setCallbacks({
    onScoreUpdate: () => updateAwarenessMeter()
});
```

### Domain Events (EventEmitter)
```javascript
// In AwarenessEngine/Services
if (this.messagingAdapter) {
    await this.messagingAdapter.publishAISuggestionEvent(event);
}

// Consumed by extension.js
createUsageStatsEventListenersDisposable(eventEmitter, state);
```

---

## Question: Are Domain Events Still Needed?

### Arguments FOR Keeping Domain Events

#### 1. **Decoupling**
- Awareness module doesn't need to know about UsageStats
- Can add new consumers without changing awareness module
- Follows dependency inversion principle

#### 2. **Multiple Subscribers**
- Could have multiple modules listening (UsageStats, Analytics, Notifications, etc.)
- Events support one-to-many communication
- Callbacks are one-to-one

#### 3. **Event Sourcing Potential**
- Could replay events for debugging/auditing
- Events are immutable records of what happened
- Callbacks are ephemeral

#### 4. **Standard Pattern**
- Matches DDD patterns
- Clear separation of concerns
- Well-understood architecture

### Arguments AGAINST (For Engine-Based Design)

#### 1. **Simplicity**
- Direct callbacks are simpler
- Less abstraction layers
- Easier to understand and debug

#### 2. **Engine-Based Design Philosophy**
- Engine orchestrates everything directly
- Favors explicit dependencies over event-driven
- Less "magic" - direct method calls are clearer

#### 3. **Current Duplication**
- Currently have BOTH callbacks AND events
- Same information published twice
- Maintenance burden

#### 4. **Single Consumer**
- Only UsageStats consumes events currently
- No evidence of need for multiple subscribers
- YAGNI (You Aren't Gonna Need It)

#### 5. **Tight Coupling Anyway**
- `extension.js` knows about both awareness module AND UsageStats
- It's the composition root - coupling is expected
- Events don't actually decouple in practice

---

## Current Usage Analysis

### Where Callbacks Are Used

1. **`onScoreUpdate`** - Used for UI updates
   ```javascript
   // extension.js
   awarenessEngine.setCallbacks({
       onScoreUpdate: () => updateAwarenessMeter()
   });
   ```
   - **Purpose**: Update status bar when score changes
   - **Consumer**: UI layer (extension.js)

2. **`onAISuggestion`, `onAISuggestionOutcome`, `onKeepAll`, `onDebtCleared`**
   - **Purpose**: Legacy callbacks (may not be used)
   - **Consumer**: Unknown/Unused?

### Where Domain Events Are Used

1. **All 8 domain events** - Used for UsageStats integration
   ```javascript
   // extension.js
   createUsageStatsEventListenersDisposable(eventEmitter, state);
   ```
   - **Purpose**: Cross-module integration (UsageStats)
   - **Consumer**: UsageStats module

---

## Recommendation: Simplify to Callbacks Only

### Why Remove Domain Events?

1. **Engine-Based Design**: Direct dependencies are more appropriate
2. **Single Consumer**: Only UsageStats uses events - can use callback
3. **Duplication**: Currently publishing same info twice
4. **Simplicity**: Callbacks are simpler and more direct
5. **Composition Root**: `extension.js` already knows about both modules

### Migration Path

**Replace domain events with direct callbacks:**

```javascript
// Instead of:
if (this.messagingAdapter) {
    await this.messagingAdapter.publishAISuggestionEvent(event);
}

// Use:
if (this.onAISuggestion) {
    this.onAISuggestion(event);
}
```

**In extension.js:**
```javascript
// Instead of:
const eventEmitter = adapters.messagingAdapter.getEventEmitter();
const usageStatsEventListenersDisposable = createUsageStatsEventListenersDisposable(eventEmitter, state);

// Use:
awarenessEngine.setCallbacks({
    onScoreUpdate: () => updateAwarenessMeter(),
    onAISuggestion: (event) => state.usageStats?.trackAISuggestion(event),
    onAISuggestionOutcome: (event) => state.usageStats?.trackAISuggestionOutcome(event),
    onKeepAll: (event) => state.usageStats?.trackKeepAll(event),
    onDebtCleared: (event) => state.usageStats?.trackAIDebtCleared(event)
});
```

### Benefits of Removing Domain Events

1. **Simpler Architecture**: One notification mechanism instead of two
2. **Less Code**: Remove messaging adapter, event classes, event listeners
3. **Clearer Flow**: Direct callbacks are easier to trace
4. **Better Fit**: Matches engine-based design philosophy
5. **No Duplication**: Single source of truth for notifications

### When to Keep Domain Events

**Keep domain events if:**
- You need multiple subscribers (currently only UsageStats)
- You need event sourcing/replay capability
- You need async/decoupled communication
- You plan to add more consumers soon

**Remove domain events if:**
- Single consumer (UsageStats)
- Direct coupling is acceptable (composition root pattern)
- Simplicity is preferred
- Engine-based design is the goal

---

## Current Reality Check

### What's Actually Being Used?

**Callbacks**:
- ✅ `onScoreUpdate` - **USED** (set in extension.js for UI updates)
- ❌ `onAISuggestion` - **NOT SET** (defined but never wired)
- ❌ `onAISuggestionOutcome` - **NOT SET** (defined but never wired)
- ❌ `onKeepAll` - **NOT SET** (defined but never wired)
- ❌ `onDebtCleared` - **NOT SET** (defined but never wired)

**Domain Events**:
- ✅ **ALL 8 events ARE USED** via `createUsageStatsEventListenersDisposable()`
- ✅ This is the **ACTUAL mechanism** for UsageStats integration

### The Problem

**We have duplication but only one is working:**
- Callbacks exist but aren't wired (except `onScoreUpdate`)
- Domain events are the working mechanism
- Both exist, creating confusion

---

## Conclusion

**For an engine-based design, domain events are likely unnecessary, BUT:**

### Current State
- Domain events **ARE the working mechanism** for UsageStats
- Callbacks exist but **aren't wired** (except `onScoreUpdate`)
- Removing domain events would require wiring callbacks

### Recommendation: Simplify to Callbacks Only

**Why:**
1. **Engine-Based Design**: Direct dependencies fit better than event-driven
2. **Single Consumer**: Only UsageStats - callbacks are simpler
3. **Less Abstraction**: Direct method calls are clearer
4. **No Duplication**: One notification mechanism

**Migration:**
1. Wire up all callbacks in `extension.js`
2. Remove domain events and messaging adapter
3. Remove `createUsageStatsEventListenersDisposable()`
4. Simplify to direct callback calls

**Keep Domain Events If:**
- You need multiple subscribers (currently only UsageStats)
- You need event sourcing/replay
- You plan to add more consumers soon
- You prefer event-driven architecture

**For an engine-based design, callbacks are more appropriate than domain events.**
