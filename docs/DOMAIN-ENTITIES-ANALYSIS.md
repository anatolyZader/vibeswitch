# Domain Entities and Aggregates Analysis

## Current Structure

### `/domain/entities/` (4 files)
1. **`debt.js`** - ✅ **Correct** - Domain Entity
   - **Identity**: `fileUri` (canonical URI string)
   - **Purpose**: Represents review debt for a single file
   - **State**: modifiedAt, totalChanges, reviewed, etc.
   - **Behavior**: `addChange()`, `markAsReviewed()`, `updateSession()`
   - **Classification**: Standalone domain entity (not part of an aggregate)

2. **`suggestion.js`** - ✅ **Correct** - Domain Entity
   - **Identity**: `id` (unique identifier)
   - **Purpose**: Represents a single AI-generated code suggestion
   - **State**: document, range, text, status, reviewTime, etc.
   - **Behavior**: `markAsReviewed()`, `updateStatus()`, `recordUserEdit()`
   - **Classification**: Entity within `SuggestionAggregate`

3. **`suggestionBatch.js`** - ✅ **Correct** - Domain Entity
   - **Identity**: `batchId` (unique batch identifier)
   - **Purpose**: Groups related suggestions created together
   - **State**: suggestionIds[], status, acceptedCount, etc.
   - **Behavior**: `addSuggestion()`, `recordOutcome()`, `isKeepAllPattern()`
   - **Classification**: Entity within `SuggestionAggregate` (managed by aggregate root)

4. **`reviewSession.js`** - ✅ **Correct** - Domain Entity
   - **Identity**: `filePath + sessionStart` (composite identity)
   - **Purpose**: Represents a user's review session for a file
   - **State**: cursorMovements, scrollEvents, reviewTime, etc.
   - **Behavior**: `recordCursorMovement()`, `hasSufficientEngagement()`, `getEngagementScore()`
   - **Classification**: Standalone domain entity (not part of an aggregate)

### `/domain/aggregates/` (1 file)
1. **`suggestionAggregate.js`** - ✅ **Correct** - Aggregate Root
   - **Purpose**: Manages collection of `Suggestion` and `SuggestionBatch` entities
   - **Responsibilities**:
     - Creates `Suggestion` entities
     - Manages collection (Map of suggestions by ID)
     - Manages `SuggestionBatch` entities (Map of batches by ID)
     - Enforces invariants (eviction policy, index consistency)
     - Provides query methods
   - **Classification**: Aggregate root - the only way to access `Suggestion` and `SuggestionBatch` entities

### `/domain/services/` (2 files)
1. **`scoreCalculator.js`** - ✅ **Correct** - Domain Service
   - **Identity**: None (stateless calculator with mutable state)
   - **Purpose**: Encapsulates business logic for calculating awareness scores
   - **State**: `currentScore`, `scores` (mutable state for caching)
   - **Behavior**: `updateScore()`, `calculateReviewScore()`, `calculateCriticalScore()`
   - **Classification**: Domain service - stateless business logic

2. **`keepAllDetector.js`** - ✅ **Correct** - Domain Service
   - **Identity**: None (pattern detector with mutable tracking state)
   - **Purpose**: Encapsulates business logic for detecting "Keep All" patterns
   - **State**: `recentAcceptances[]` (temporary tracking state)
   - **Behavior**: `trackAcceptance()`, `detectKeepAll()`
   - **Classification**: Domain service - business logic for pattern detection

### `/domain/value_objects/` (3 files)
1. **`suggestionId.js`** - ✅ **Correct** - Value Object
   - **Identity**: None (value-based equality)
   - **Purpose**: Encapsulates suggestion ID validation
   - **Classification**: Value object

2. **`filePath.js`** - ✅ **Correct** - Value Object
   - **Identity**: None (value-based equality)
   - **Purpose**: Encapsulates file path validation and normalization
   - **Classification**: Value object

3. **`score.js`** - ✅ **Correct** - Value Object
   - **Identity**: None (value-based equality)
   - **Purpose**: Encapsulates score validation and business rules
   - **Classification**: Value object

## Analysis and Recommendations

### ✅ All Files Are Correctly Categorized

**Domain Entities** (`/domain/entities/`):
- All 4 files are proper domain entities with:
  - Clear identity (unique identifier)
  - Encapsulated state and behavior
  - Business logic methods
  - No infrastructure dependencies (use ports)

**Aggregate Root** (`/domain/aggregates/`):
- `SuggestionAggregate` correctly:
  - Manages collection of `Suggestion` entities
  - Manages collection of `SuggestionBatch` entities
  - Enforces invariants
  - Provides single point of access

**Domain Services** (`/domain/services/`):
- Both services correctly:
  - Encapsulate business logic
  - Have no identity (not entities)
  - Use ports for infrastructure

**Value Objects** (`/domain/value_objects/`):
- All 3 value objects correctly:
  - Are immutable
  - Have value-based equality
  - Encapsulate validation

## DDD Structure Summary

```
domain/
├── entities/              (4 files - domain entities with identity)
│   ├── debt.js           ✅ Standalone entity
│   ├── suggestion.js     ✅ Entity within SuggestionAggregate
│   ├── suggestionBatch.js ✅ Entity within SuggestionAggregate
│   └── reviewSession.js  ✅ Standalone entity
│
├── aggregates/            (1 file - aggregate roots)
│   └── suggestionAggregate.js ✅ Manages Suggestion + SuggestionBatch entities
│
├── services/              (2 files - domain services)
│   ├── scoreCalculator.js ✅ Business logic for score calculation
│   └── keepAllDetector.js ✅ Business logic for pattern detection
│
└── value_objects/         (3 files - value objects)
    ├── suggestionId.js   ✅ Immutable ID wrapper
    ├── filePath.js       ✅ Immutable path wrapper
    └── score.js          ✅ Immutable score wrapper
```

## Conclusion

**All files are correctly categorized.** The domain layer structure follows DDD principles:

1. **Entities** have identity and lifecycle
2. **Aggregates** manage entity collections and enforce invariants
3. **Services** encapsulate stateless business logic
4. **Value Objects** are immutable with value-based equality

No refactoring needed for entity/aggregate placement.
