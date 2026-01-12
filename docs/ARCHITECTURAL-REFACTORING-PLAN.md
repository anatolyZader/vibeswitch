# Architectural Refactoring Plan

Based on comprehensive code review, this document outlines the fixes for 8 major architectural issues.

## Priority 1: URI Normalization (FIXED ✅)

**Issue**: FileWatcherService used `path.resolve()` while DebtService used `normalizeToUri()`, causing mismatches.

**Fix**: Updated FileWatcherService to use `UriPathUtilities.normalizeToUri()` for canonical URI strings.

**Status**: ✅ Completed

## Priority 2: Review Tracking Out of Input Layer (IN PROGRESS)

**Issue**: Input layer (`AwarenessEventListener`) mutates domain objects (`suggestion.reviewTime`) and manages dwell timers.

**Fix**: Created `ReviewTrackingService` in app layer to handle:
- `onCursorMoved(uri, position, now)`
- `onScroll(uri, now)`
- `onDocumentClose(uri, now)`

**Status**: ⚠️ Service created, needs integration

**Next Steps**:
1. Integrate ReviewTrackingService into AwarenessService
2. Update AwarenessEventListener to delegate to ReviewTrackingService
3. Remove direct suggestion mutation from input layer

## Priority 3: Persistence Async (IN PROGRESS)

**Issue**: `saveSync()` is fire-and-forget, not actually synchronous. Code assumes immediate persistence.

**Fix**:
1. ✅ Made `DebtService.saveDebt()` async
2. ✅ Updated `AwarenessService.stop()` to await `saveDebt()`
3. ⏳ Remove `saveSync()` from `IAwarenessPersistencePort` (or rename to `saveBestEffort()`)
4. ⏳ Update all other persistence calls to be async

**Status**: ⚠️ Partially complete - critical path (stop()) is async, other calls are fire-and-forget with error handling

**Files to Update**:
- `IAwarenessPersistencePort.js` - Remove or rename `saveSync()`
- `AwarenessWorkspaceStateAdapter.js` - Remove `saveSync()` implementation
- `DebtService.js` - Make `saveDebt()` async, await persistence
- `AwarenessService.js` - Await all saves in `stop()`

## Priority 4: Timer Registry (PENDING)

**Issue**: Timers scattered across multiple services (SuggestionService, EventListener, FileWatcherService, ChangeLedgerService), causing "stuck state" bugs.

**Fix**: Create `TimerRegistry` class:
```javascript
class TimerRegistry {
    setTimeout(callback, delay) { /* ... */ }
    setInterval(callback, delay) { /* ... */ }
    clear() { /* Clear all timers */ }
}
```

**Status**: ⏳ Pending

**Files to Update**:
- Create `app/timerRegistry.js`
- Update `AwarenessService` to own TimerRegistry
- Replace all `setTimeout`/`setInterval` with `timerRegistry.setTimeout()`
- Clear registry in `AwarenessService.stop()`

## Priority 5: Remove console.* Calls (PENDING)

**Issue**: `SessionService` uses `console.error()` instead of `loggerPort`, bypassing logging infrastructure.

**Fix**: Replace all `console.*` calls with `loggerPort` methods.

**Status**: ⏳ Pending

**Files to Update**:
- `sessionService.js` - Replace `console.error()` with `loggerPort.error()`
- `configManager.js` - Review console usage
- Legacy files in `infrastructure/legacy/` - Can be left as-is (legacy)

## Priority 6: Make Controller Thin (PENDING)

**Issue**: `AwarenessController` returns helper functions and contains orchestration logic.

**Fix**: Move all orchestration to app services:
- `getPendingSuggestions()` → `AwarenessService.getPendingSuggestions()`
- `isPositionInRange()` → `AwarenessService.isPositionInRange()`
- Remove helper-returning pattern from `handleCursorMove()`

**Status**: ⏳ Pending

## Priority 7: Adapter Inheritance (LOW PRIORITY)

**Issue**: Adapters extend port interfaces, but JS doesn't enforce interfaces.

**Fix**: Prefer composition, validate shape in composition root.

**Status**: ⏳ Low priority - can be done later

## Priority 8: Utility Duplication (MOSTLY DONE ✅)

**Issue**: Utilities duplicated across layers.

**Fix**: Already addressed in previous refactoring - technical utilities in app layer, domain logic in domain services.

**Status**: ✅ Mostly complete

---

## Implementation Order

1. ✅ URI normalization (DONE)
2. ⚠️ Review tracking service (CREATED, needs integration)
3. ⏳ Persistence async
4. ⏳ Timer registry
5. ⏳ Console.* removal
6. ⏳ Controller thin
7. ⏳ Adapter inheritance (low priority)
