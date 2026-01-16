# Domain Layer Simplification Analysis

## Overview
The domain layer still contains overengineered components from the strict DDD approach. This document identifies what should be simplified or moved to align with the engine-based design.

## Issues Found

### 1. Unused Duplicate Entity
- **`domain/entities/debt.js`** - Duplicate of `FileDebt`. Not used anywhere. **DELETE**

### 2. Value Object Wrappers (Overengineered)
These are just thin wrappers around primitives with minimal validation:

- **`domain/value_objects/suggestionId.js`** - Just wraps a string. Used in:
  - `suggestionBatch.js` (can use plain strings)
  - Tests (can be updated)
  - **ACTION**: Remove, use plain strings

- **`domain/value_objects/filePath.js`** - Just wraps a string. Used in:
  - `suggestionBatch.js` (can use plain strings)
  - `reviewSession.js` (can use plain strings)
  - Tests (can be updated)
  - **ACTION**: Remove, use plain strings

- **`domain/value_objects/score.js`** - Has some business logic (`isCritical`, `isWarning`, `isSafe`). 
  - **ACTION**: Convert to simple utility functions in app layer, use plain numbers

### 3. Pure Functions in Domain (Should Be in App Layer)
These are stateless pure functions that don't protect invariants:

- **`domain/utils/classificationScorer.js`** - Pure functions for score accumulation
- **`domain/utils/configManager.js`** - Pure functions for config management
- **`domain/utils/versionDriftHandler.js`** - Pure functions for version drift
- **`domain/utils/changeAggregator.js`** - Pure functions for change aggregation
- **`domain/utils/reasonFilter.js`** - Pure function for filtering reasons
- **`domain/utils/detectors/*.js`** - All 8 detector files are pure functions

**ACTION**: Move all to `app/utils/` or `app/classification/`

### 4. Entities Using Value Objects Unnecessarily
- **`suggestionBatch.js`** - Uses `FilePath` and `SuggestionId` value objects
- **`reviewSession.js`** - Uses `FilePath` value object

**ACTION**: Update to use plain strings after removing value objects

## Simplification Plan

### ✅ Phase 1: Remove Unused Code
1. ✅ Delete `domain/entities/debt.js` (unused duplicate) - **COMPLETED**

### ✅ Phase 2: Remove Value Object Wrappers
1. ✅ Remove `domain/value_objects/suggestionId.js` - **COMPLETED**
2. ✅ Remove `domain/value_objects/filePath.js` - **COMPLETED**
3. ✅ Update `suggestionBatch.js` to use plain strings - **COMPLETED**
4. ✅ Update `reviewSession.js` to use plain strings - **COMPLETED**
5. ⚠️ Update tests - **PENDING** (tests may need updates)

### ✅ Phase 3: Simplify Score
1. ✅ Remove `domain/value_objects/score.js` - **COMPLETED**
2. ⚠️ Create simple utility functions in app layer: `isScoreCritical(score)`, `isScoreWarning(score)`, `isScoreSafe(score)` - **PENDING** (if needed)
3. ✅ No references found - Score was not used - **COMPLETED**

### ✅ Phase 4: Move Pure Functions to App Layer
1. ✅ Move `classificationScorer.js` → `app/classification/classificationScorer.js` - **COMPLETED**
2. ✅ Move `configManager.js` → `app/classification/configManager.js` - **COMPLETED**
3. ✅ Move `versionDriftHandler.js` → `app/classification/versionDriftHandler.js` - **COMPLETED**
4. ✅ Move `changeAggregator.js` → `app/classification/changeAggregator.js` - **COMPLETED**
5. ✅ Move `reasonFilter.js` → `app/classification/reasonFilter.js` - **COMPLETED**
6. ✅ Move `detectors/` → `app/classification/detectors/` - **COMPLETED**
7. ⚠️ Update all imports - **PENDING** (imports will be updated when changeClassifier is found/created)

## Expected Outcome

After simplification:
- **Domain layer** contains only:
  - Entities with identity and state (`Suggestion`, `FileDebt`, `Change`, `SuggestionBatch`, `ReviewSession`)
  - Aggregate root (`SuggestionAggregate`)
  - Domain events (if needed)
  - Ports (interfaces)
  - **NO** value object wrappers
  - **NO** pure function utilities

- **App layer** contains:
  - All pure functions (classification, scoring, utilities)
  - Application services (orchestration)
  - Engine (orchestrator)

This aligns with the engine-based design where the domain is minimal and focused on entities/aggregates, while the app layer handles all calculations and orchestration.
