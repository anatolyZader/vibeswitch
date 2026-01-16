# Classification Overlap Analysis

## Problem: Overlapping Responsibilities

There is significant overlap between `awarenessEngine.js` and `classificationService.js`:

### Current Structure

**awarenessEngine.js** (1185 lines - too large):
- Creates `ClassificationService` instance
- Has wrapper methods that delegate to `ClassificationService`:
  - `classifyTextChange()` → `classificationService.classifyEvent()`
  - `handleClassifiedChanges()` → `classificationService.handleClassifiedChanges()`
- Has its own implementations that are passed as callbacks:
  - `recordChangeBatch()` - Records change batches
  - `generateDiffBullets()` - Generates diff bullets
  - `handleAISuggestionBatch()` - Delegates to `suggestionLifecycleService`
  - `handleUserEditBatch()` - Delegates to `suggestionLifecycleService`

**classificationService.js** (297 lines):
- Manages `ChangeClassifier` lifecycle
- Converts raw changes to Change entities
- Has private methods that call callbacks passed from `awarenessEngine`:
  - `_recordChangeBatch()` - Calls `this.recordChangeBatch` callback
  - `_routeClassifiedChanges()` - Calls `this.handleAISuggestionBatch` and `this.handleUserEditBatch` callbacks
  - `_generateDiffBullets()` - Calls `this.generateDiffBulletsFn` callback

### Issues

1. **Unnecessary Delegation**: `awarenessEngine.classifyTextChange()` just wraps `classificationService.classifyEvent()`
2. **Callback Hell**: `classificationService` receives 4 callbacks from `awarenessEngine` instead of having direct dependencies
3. **Tight Coupling**: `classificationService` can't work without `awarenessEngine` providing callbacks
4. **God Object**: `awarenessEngine` is 1185 lines and orchestrates everything

### Proposed Solution

**Option 1: Make ClassificationService Self-Contained** (Recommended)
- `ClassificationService` should have direct dependencies instead of callbacks:
  - Inject `suggestionLifecycleService` directly
  - Inject `changeLedgerService` directly (or create its own)
  - Move `generateDiffBullets` logic into `ClassificationService`
- Remove wrapper methods from `awarenessEngine`
- `awarenessEngine` just creates and wires services, doesn't orchestrate classification

**Option 2: Remove ClassificationService Wrapper**
- Move all classification logic directly into `awarenessEngine`
- Remove `ClassificationService` class
- This makes `awarenessEngine` even larger (not recommended)

**Option 3: Split AwarenessEngine**
- Extract classification orchestration to a separate service
- Keep `awarenessEngine` as a thin coordinator
- This aligns with engine-centered design

### Recommendation

**Option 1** is best because:
- `ClassificationService` becomes a true service with clear dependencies
- Reduces `awarenessEngine` size
- Better testability (no callback mocking)
- Clearer separation of concerns

The callbacks pattern suggests `ClassificationService` is not a real service but just a wrapper that needs `awarenessEngine` to do the work.
