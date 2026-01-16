# AwarenessEngine Constructor Parameters Verification

## Summary

**2 parameters are NOT used and can be removed:**
- `fileSystemAdapter` - Stored but never used
- `changeClassificationServiceD` - Stored but never used

**8 parameters are REQUIRED and used:**
- `vscodeAdapter` - Used extensively (24+ times)
- `persistenceAdapter` - Used in DebtService and ChangeLedgerService
- `messagingAdapter` - Optional, used for publishing domain events
- `loggerAdapter` - Used in multiple services
- `idGeneratorAdapter` - Used for generating UUIDs
- `hashGeneratorAdapter` - Used in ChangeLedgerService
- `rangeOperationServiceD` - Used in SuggestionLifecycleService
- `uriPathOperationServiceD` - Used in isCodeDocument, isSkippableUri methods

---

## Parameter Usage Analysis

### ✅ REQUIRED Parameters

#### 1. `vscodeAdapter` - **REQUIRED**
**Usage**: 24+ occurrences
- Event subscriptions (onDidChangeTextDocument, etc.)
- Document operations (getTextDocuments, openTextDocument)
- URI operations (asRelativePath, Uri, Range)
- Workspace operations (workspaceFolders)

#### 2. `persistenceAdapter` - **REQUIRED**
**Usage**: Passed to services
- `DebtService` constructor
- `ChangeLedgerService` constructor

#### 3. `messagingAdapter` - **OPTIONAL** (already marked with `= null`)
**Why Optional**: 
- The awareness module can function without it (events just won't be published)
- Used for cross-module integration (e.g., UsageStats)
- If not provided, awareness monitoring still works, but other modules won't receive notifications

**Usage**: Publishing domain events for cross-module communication

**In AwarenessEngine**:
- `publishDebtClearedEvent()` - When review debt is cleared (line 204)
- `publishScoreUpdateEvent()` - When awareness score changes (line 553)

**Passed to Services**:
- `SuggestionLifecycleService` - Publishes:
  - `aiSuggestion` - When AI suggestion is created
  - `aiSuggestionOutcome` - When suggestion is accepted/rejected/adapted
  - `keepAll` - When user accepts all suggestions in a batch
  - `suggestionBatchCreated` - When a batch of suggestions is created
- `SessionService` - Publishes:
  - `reviewSessionStarted` - When user starts reviewing a file
  - `reviewSessionCompleted` - When review session completes

**How It Works**:
```javascript
// In AwarenessEngine
if (this.messagingAdapter) {
    await this.messagingAdapter.publishDebtClearedEvent(event);
}

// MessagingAdapter emits event
eventEmitter.emit('debtCleared', payload);

// extension.js listens and forwards to UsageStats
createUsageStatsEventListenersDisposable(eventEmitter, state);
```

**Event Flow**:
```
AwarenessEngine/Services
   ↓ (if messagingAdapter exists)
messagingAdapter.publishXxxEvent(event)
   ↓
EventEmitter.emit('eventName', payload)
   ↓
extension.js listeners
   ↓
UsageStats.trackXxx(payload.event)
```

**Graceful Degradation**:
- All `messagingAdapter` calls are wrapped in `if (this.messagingAdapter)` checks
- If adapter is null, events simply aren't published
- Core awareness functionality continues to work
- Only cross-module integration (UsageStats) is affected

**Complete List of Domain Events Published**:

1. **`aiSuggestion`** - Published by `SuggestionLifecycleService`
   - When: AI suggestion is created
   - Payload: `{ suggestionId, filePath, range, changeSize, reason }`

2. **`aiSuggestionOutcome`** - Published by `SuggestionLifecycleService`
   - When: Suggestion is accepted, rejected, or adapted
   - Payload: `{ suggestionId, outcome, filePath }`

3. **`keepAll`** - Published by `SuggestionLifecycleService`
   - When: User accepts all suggestions in a batch without review
   - Payload: `{ suggestionIds, filePath, acceptanceCount }`

4. **`suggestionBatchCreated`** - Published by `SuggestionLifecycleService`
   - When: A batch of suggestions is created
   - Payload: `{ batchId, filePath, suggestionCount, totalSize }`

5. **`debtCleared`** - Published by `AwarenessEngine`
   - When: Review debt is cleared for a file
   - Payload: `{ clearedFiles, totalDebtCleared }`

6. **`scoreUpdate`** - Published by `AwarenessEngine`
   - When: Awareness score changes
   - Payload: `{ score, components, suggestions, debt }`

7. **`reviewSessionStarted`** - Published by `SessionService`
   - When: User starts reviewing a file
   - Payload: `{ filePath, sessionStart }`

8. **`reviewSessionCompleted`** - Published by `SessionService`
   - When: Review session completes
   - Payload: `{ filePath, sessionStart, completedAt, reviewTime, engagementScore }`

**All events are consumed by `extension.js` via `createUsageStatsEventListenersDisposable()` and forwarded to UsageStats for analytics tracking.**

#### 4. `loggerAdapter` - **REQUIRED**
**Usage**: Passed to multiple services
- `DebtService` constructor
- `ChangeLedgerService` constructor
- `SuggestionAggregate` constructor
- `ClassificationService` constructor
- Direct usage: `this.loggerAdapter.debug()`, `this.loggerAdapter.error()`

#### 5. `idGeneratorAdapter` - **REQUIRED**
**Usage**: 
- `this.instanceId = this.idGeneratorAdapter.generateUUID()`
- Passed to `SuggestionAggregate` constructor
- Passed to `ClassificationService` constructor

#### 6. `hashGeneratorAdapter` - **REQUIRED**
**Usage**: 
- Passed to `ChangeLedgerService` constructor

#### 7. `rangeOperationServiceD` - **REQUIRED**
**Usage**:
- Passed to `SuggestionLifecycleService` constructor
- Used for range operations (rangesOverlap, isPositionInRange)

#### 8. `uriPathOperationServiceD` - **REQUIRED**
**Usage**:
- `this.uriPathOperationServiceD.isCodeDocument()`
- `this.uriPathOperationServiceD.isSkippableUri()`

---

### ❌ UNUSED Parameters

#### 1. `fileSystemAdapter` - **NOT USED**
**Status**: Stored in constructor but never used
- Line 104: `this.fileSystemAdapter = fileSystemAdapter;`
- **No other references found**
- Not passed to any service
- Not used in any method

**Action**: Remove from constructor

#### 2. `changeClassificationServiceD` - **NOT USED**
**Status**: Stored in constructor but never used
- Line 112: `this.changeClassificationServiceD = changeClassificationServiceD;`
- **No other references found**
- Not passed to any service
- Not used in any method

**Action**: Remove from constructor

---

## Recommendation

Remove these 2 unused parameters:
1. `fileSystemAdapter`
2. `changeClassificationServiceD`

This will:
- Simplify the constructor
- Remove unnecessary validation
- Make dependencies clearer
- Reduce confusion about what's actually needed
