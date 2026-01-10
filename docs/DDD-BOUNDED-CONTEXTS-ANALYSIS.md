# DDD Bounded Contexts Analysis & Event Storming

## Executive Summary

This document provides an extensive Domain-Driven Design (DDD) analysis of the VibeSwitch extension, focusing on the **Awareness** bounded context. The analysis includes event storming, entity identification, relationship mapping, and aggregate design.

---

## 1. Bounded Contexts Identification

### 1.1 Primary Bounded Context: **Awareness**

**Purpose**: Track and monitor AI-generated code changes, user review behavior, and code awareness metrics.

**Key Responsibilities**:
- Detect AI-generated code suggestions
- Track user review engagement
- Calculate awareness scores
- Manage review debt
- Monitor file changes and external file creation

**Ubiquitous Language**:
- **Suggestion**: AI-generated code change that needs review
- **Debt**: Unreviewed code changes in a file
- **Review Session**: User's active engagement with a file for review
- **Awareness Score**: Metric indicating code review quality
- **Batch**: Group of related suggestions created together
- **Keep All**: Pattern where user accepts all suggestions without review

### 1.2 Related Bounded Contexts

1. **Mode Context** (`business_modules/mode/`)
   - Manages switching between 'vibe' and 'dev' modes
   - **Integration**: Provides mode configuration to Awareness context

2. **Usage Stats Context** (`business_modules/usage-stats/`)
   - Tracks usage statistics and analytics
   - **Integration**: Consumes events from Awareness context (KeepAllEvent, etc.)

---

## 2. Event Storming

### 2.1 Domain Events (Chronological Flow)

#### **AI Code Generation Events**

1. **`AISuggestionEvent`** ✅
   - **Trigger**: AI agent generates a code suggestion
   - **Data**: `suggestionId`, `filePath`, `range`, `changeSize`, `reason`
   - **Published By**: `AwarenessService.recordAISuggestion()`
   - **Consumers**: Usage Stats, Analytics

2. **`SuggestionBatchCreatedEvent`** ✅
   - **Trigger**: Multiple related suggestions created together (e.g., refactor)
   - **Data**: `batchId`, `filePath`, `suggestionCount`, `totalSize`
   - **Published By**: `AwarenessService.recordAISuggestionBatch()`
   - **Consumers**: Usage Stats, Analytics

#### **User Review Events**

3. **`ReviewSessionStartedEvent`** ✅
   - **Trigger**: User opens file with unreviewed debt or pending suggestions
   - **Data**: `filePath`, `sessionStart`
   - **Published By**: `SessionService.initializeSession()`
   - **Consumers**: Analytics, UI updates

4. **`AISuggestionOutcomeEvent`** ✅
   - **Trigger**: User accepts, rejects, or modifies a suggestion
   - **Data**: `suggestionId`, `outcome` ('accepted'|'rejected'|'modified'), `filePath`
   - **Published By**: `AwarenessService.recordUserEdit()`
   - **Consumers**: Usage Stats, Score Calculator

5. **`ReviewSessionCompletedEvent`** ✅
   - **Trigger**: User completes review (sufficient engagement or timeout)
   - **Data**: `filePath`, `sessionStart`, `completedAt`, `reviewTime`, `engagementScore`
   - **Published By**: `SessionService.checkProgress()`
   - **Consumers**: Analytics, Debt Service

#### **Debt Management Events**

6. **`DebtClearedEvent`** ✅
   - **Trigger**: All debt for a file is reviewed
   - **Data**: `clearedFiles[]`, `totalDebtCleared`
   - **Published By**: `SessionService.checkProgress()` (via callback)
   - **Consumers**: UI updates, Analytics

#### **Pattern Detection Events**

7. **`KeepAllEvent`** ✅
   - **Trigger**: System detects rapid acceptance of multiple suggestions
   - **Data**: `suggestionIds[]`, `filePath`, `acceptanceCount`
   - **Published By**: `KeepAllDetector.detectKeepAll()`
   - **Consumers**: Usage Stats, Analytics

#### **Score Calculation Events**

8. **`ScoreUpdateEvent`** ✅
   - **Trigger**: Awareness score changes (new suggestions, debt changes, etc.)
   - **Data**: `score`, `components`, `suggestions`, `debt`
   - **Published By**: `AwarenessService.updateScore()`
   - **Consumers**: UI (meter updates), Analytics

### 2.2 Event Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    AI Code Generation                            │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
              ┌─────────────────────────┐
              │ AISuggestionEvent       │
              │ SuggestionBatchCreated  │
              └─────────────────────────┘
                            │
                            ▼
              ┌─────────────────────────┐
              │ Create Suggestion       │
              │ Add to Debt             │
              └─────────────────────────┘
                            │
                            ▼
              ┌─────────────────────────┐
              │ ReviewSessionStarted    │
              └─────────────────────────┘
                            │
                            ▼
              ┌─────────────────────────┐
              │ User Reviews Code       │
              │ (cursor, scroll, time)   │
              └─────────────────────────┘
                            │
                            ▼
              ┌─────────────────────────┐
              │ AISuggestionOutcomeEvent │
              │ (accepted/rejected/mod)  │
              └─────────────────────────┘
                            │
                            ▼
              ┌─────────────────────────┐
              │ ReviewSessionCompleted   │
              └─────────────────────────┘
                            │
                            ▼
              ┌─────────────────────────┐
              │ DebtClearedEvent?       │
              │ ScoreUpdateEvent        │
              └─────────────────────────┘
```

---

## 3. Domain Entities Analysis

### 3.1 Current Entities

#### **1. Suggestion** ✅ **CORRECT**
- **Identity**: `id` (UUID)
- **Lifecycle**: Created → Pending → Accepted/Rejected/Adapted
- **State**:
  - `document` (URI)
  - `range` (text range)
  - `text` (suggested content)
  - `size` (character count)
  - `status` ('pending'|'accepted'|'rejected'|'adapted')
  - `reviewed`, `reviewTime`, `reviewStarted`
  - `userEdited`, `editCount`
  - `isFileCreation`, `isExternalCreation`, `isFileWrite`
- **Behavior**:
  - `markAsReviewed(reviewTime, reviewStarted)`
  - `updateStatus(status)`
  - `recordUserEdit()`
  - `isPending()`, `isResolved()`
- **Relationships**:
  - Belongs to **SuggestionAggregate** (aggregate root)
  - May belong to **SuggestionBatch** (via `batchId`)
  - Associated with **Debt** (same `document` URI)
  - May have **ReviewSession** (same `document` URI)

#### **2. SuggestionBatch** ✅ **CORRECT**
- **Identity**: `batchId` (UUID)
- **Lifecycle**: Created → Pending → Partially/Fully Accepted/Rejected
- **State**:
  - `filePath` (FilePath value object)
  - `suggestionIds[]` (references to Suggestion entities)
  - `totalSize`
  - `status` ('pending'|'partially_accepted'|'fully_accepted'|'rejected')
  - `acceptedCount`, `rejectedCount`, `modifiedCount`
- **Behavior**:
  - `addSuggestion(suggestionId, size)`
  - `recordOutcome(suggestionId, outcome)`
  - `isFullyResolved()`
  - `isKeepAllPattern()` (business rule: 3+ suggestions, all accepted, no modifications)
- **Relationships**:
  - Belongs to **SuggestionAggregate** (aggregate root)
  - Contains multiple **Suggestion** entities (via `suggestionIds[]`)

#### **3. Debt** ✅ **CORRECT**
- **Identity**: `fileUri` (canonical URI string)
- **Lifecycle**: Created → Accumulated → Reviewed → (Reset if new changes)
- **State**:
  - `modifiedAt`, `lastModifiedAt`
  - `totalChanges` (sum of change sizes)
  - `modificationCount`
  - `reviewed`, `reviewedAt`
  - `totalReviewTime`
  - `firstOpenedAt`, `lastVisitedAt`
  - `reviewSessions` (count)
- **Behavior**:
  - `addChange(changeSize)` (accumulates or resets if already reviewed)
  - `markAsReviewed(reviewTime)`
  - `updateSession(sessionData)`
  - `hasUnreviewedDebt()` → `!reviewed`
  - `getAge()` → `Date.now() - modifiedAt`
- **Relationships**:
  - Standalone entity (not in aggregate)
  - Associated with multiple **Suggestion** entities (same `document` URI)
  - Associated with multiple **ReviewSession** entities (same `filePath`)

#### **4. ReviewSession** ✅ **CORRECT**
- **Identity**: `filePath + sessionStart` (composite identity)
- **Lifecycle**: Started → Active → Completed/TimedOut
- **State**:
  - `filePath` (FilePath value object)
  - `sessionStart`, `lastActivity`
  - `cursorMovements`, `scrollEvents`
  - `reviewTime`
  - `isActive`, `completedAt`
- **Behavior**:
  - `recordCursorMovement()`
  - `recordScrollEvent()`
  - `hasSufficientEngagement(minimumReviewTime, minimumMovements, minimumScrolls)`
  - `hasTimedOut(timeoutMs)`
  - `complete(reviewTime)`
  - `getEngagementScore()` (0-100 based on duration, movements, scrolls)
- **Relationships**:
  - Standalone entity (not in aggregate)
  - Associated with **Debt** (same `filePath`)
  - Associated with multiple **Suggestion** entities (same `document` URI)

### 3.2 Missing Entities (Potential)

#### **❓ ChangeEntry** (Currently in ChangeLedgerService)
- **Current State**: Stored as plain objects in `ChangeLedgerService`
- **Analysis**: These are domain concepts (change events with classification)
- **Recommendation**: **Consider creating `ChangeEntry` entity** if:
  - Change history needs to be queried by domain logic
  - Change entries need lifecycle management
  - Change entries need to be part of an aggregate
- **Current Approach**: ✅ **Acceptable** - Plain objects in application service is fine for infrastructure concerns

#### **❓ File** (Implicit)
- **Current State**: Files are represented by URIs/paths
- **Analysis**: No explicit File entity exists
- **Recommendation**: ✅ **Correct** - Files are infrastructure concerns, not domain entities. URIs/paths are sufficient.

---

## 4. Aggregates Analysis

### 4.1 SuggestionAggregate ✅ **CORRECT**

**Aggregate Root**: `SuggestionAggregate`

**Entities Within Aggregate**:
1. **Suggestion** (multiple)
2. **SuggestionBatch** (multiple)

**Invariants**:
- Suggestions must have unique IDs
- Batches must have unique IDs
- Suggestion-to-batch mapping must be consistent
- Pending suggestions index must be consistent
- Global cap: Max 5000 suggestions (eviction policy)

**Access Rules**:
- ✅ Only `SuggestionAggregate` can create `Suggestion` entities
- ✅ Only `SuggestionAggregate` can create `SuggestionBatch` entities
- ✅ Only `SuggestionAggregate` can modify suggestion status (via `updateSuggestionStatus()`)
- ✅ Only `SuggestionAggregate` can add suggestions to batches

**Boundary**:
- Aggregate manages suggestions and batches
- **Debt** is **outside** the aggregate (different aggregate or standalone)
- **ReviewSession** is **outside** the aggregate (standalone entity)

### 4.2 Debt Aggregate? ❌ **NO AGGREGATE**

**Analysis**: `Debt` is a **standalone entity**, not an aggregate.

**Reasoning**:
- Each `Debt` entity is independent (one per file URI)
- No child entities
- No complex invariants requiring aggregate boundary
- ✅ **Correct**: Standalone entity managed by `DebtService` (application service)

### 4.3 ReviewSession Aggregate? ❌ **NO AGGREGATE**

**Analysis**: `ReviewSession` is a **standalone entity**, not an aggregate.

**Reasoning**:
- Each `ReviewSession` is independent (one per file + session start)
- No child entities
- No complex invariants requiring aggregate boundary
- ✅ **Correct**: Standalone entity managed by `SessionService` (application service)

---

## 5. Entity Relationships

### 5.1 Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    SuggestionAggregate                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Suggestion (id)                                          │  │
│  │  - document: URI                                          │  │
│  │  - batchId: UUID (optional)                               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                      │
│                           │ belongs to (optional)                │
│                           ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  SuggestionBatch (batchId)                               │  │
│  │  - suggestionIds: UUID[]                                 │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                           │
                           │ (document URI)
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Debt (fileUri)                                                 │
│  - Standalone entity                                            │
│  - Tracks unreviewed changes                                   │
└─────────────────────────────────────────────────────────────────┘
                           │
                           │ (filePath)
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  ReviewSession (filePath + sessionStart)                        │
│  - Standalone entity                                            │
│  - Tracks user engagement                                       │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Relationship Types

#### **Suggestion → SuggestionBatch**
- **Type**: Many-to-One (optional)
- **Implementation**: `Suggestion.batchId` → `SuggestionBatch.batchId`
- **Managed By**: `SuggestionAggregate`
- **Invariant**: If `batchId` exists, batch must exist in aggregate

#### **Suggestion → Debt**
- **Type**: Many-to-One (by document URI)
- **Implementation**: `Suggestion.document` → `Debt.fileUri`
- **Managed By**: Application service (`AwarenessService`)
- **Note**: Not a direct reference; relationship is by URI matching

#### **Suggestion → ReviewSession**
- **Type**: Many-to-One (by document URI)
- **Implementation**: `Suggestion.document` → `ReviewSession.filePath`
- **Managed By**: Application service (`SessionService`)
- **Note**: Not a direct reference; relationship is by URI matching

#### **Debt → ReviewSession**
- **Type**: One-to-Many
- **Implementation**: `Debt.fileUri` → `ReviewSession.filePath`
- **Managed By**: Application service (`SessionService`)
- **Note**: One debt can have multiple review sessions over time

---

## 6. Value Objects

### 6.1 Current Value Objects ✅

1. **SuggestionId**
   - Wraps suggestion ID string
   - Validation: non-empty string
   - Value-based equality

2. **FilePath**
   - Wraps file path string
   - Validation: non-empty string
   - Methods: `getFileName()`, `getDirectory()`
   - Value-based equality

3. **Score**
   - Wraps numeric score (0-100)
   - Validation: number between 0-100
   - Business rules: `isCritical()`, `isWarning()`, `isSafe()`
   - Value-based equality

### 6.2 Potential Value Objects

#### **❓ TextRange**
- **Current**: Plain object `{ start: Position, end: Position }`
- **Recommendation**: ✅ **Acceptable** - VS Code Range is infrastructure; no need to wrap

#### **❓ URI**
- **Current**: String (URI)
- **Recommendation**: ✅ **Acceptable** - URI strings are sufficient; no complex validation needed

---

## 7. Domain Services

### 7.1 Current Domain Services ✅

1. **ScoreCalculator**
   - **Purpose**: Calculate awareness scores
   - **State**: Mutable (`currentScore`, `scores`)
   - **Classification**: ✅ Domain service (stateless business logic)

2. **KeepAllDetector**
   - **Purpose**: Detect "keep all" patterns
   - **State**: Mutable (`recentAcceptances[]`)
   - **Classification**: ✅ Domain service (pattern detection logic)

### 7.2 Additional Domain Services (Potential)

#### **❓ ChangeClassifier** (Currently in `domain/utils/`)
- **Current**: Utility class
- **Analysis**: Encapsulates business logic for classifying changes
- **Recommendation**: ✅ **Correct** - Can remain as utility or move to domain service if it grows

---

## 8. Aggregate Design Validation

### 8.1 SuggestionAggregate Design ✅

**Strengths**:
- ✅ Clear aggregate root
- ✅ Enforces invariants (eviction, index consistency)
- ✅ Single point of access
- ✅ Manages both Suggestions and Batches correctly

**Potential Improvements**:
- Consider splitting into two aggregates if batches become independent:
  - `SuggestionAggregate` (suggestions only)
  - `BatchAggregate` (batches with suggestion references)
- **Current Design**: ✅ **Acceptable** - Batches are tightly coupled to suggestions

### 8.2 Debt and ReviewSession as Standalone Entities ✅

**Justification**:
- ✅ No child entities
- ✅ No complex invariants
- ✅ Independent lifecycle
- ✅ Managed by application services (correct)

---

## 9. Missing Concepts (Gaps Analysis)

### 9.1 Potential Missing Entities

#### **❓ ReviewHistory** (Not Currently Modeled)
- **Concept**: Historical record of all review sessions for a file
- **Current State**: Only active sessions tracked
- **Analysis**: May be needed for analytics/trends
- **Recommendation**: ⚠️ **Consider** if historical analysis is required

#### **❓ AwarenessProfile** (Not Currently Modeled)
- **Concept**: User's overall awareness profile (trends, patterns)
- **Current State**: Only current score tracked
- **Analysis**: May be needed for long-term tracking
- **Recommendation**: ⚠️ **Consider** if user profiling is required

### 9.2 Potential Missing Value Objects

#### **❓ ReviewMetrics**
- **Concept**: Encapsulated review metrics (time, movements, scrolls)
- **Current State**: Stored as separate fields in `ReviewSession`
- **Recommendation**: ✅ **Acceptable** - Current structure is fine

---

## 10. Recommendations

### 10.1 Entity Classification ✅ **ALL CORRECT**

- ✅ **Suggestion**: Entity within aggregate
- ✅ **SuggestionBatch**: Entity within aggregate
- ✅ **Debt**: Standalone entity
- ✅ **ReviewSession**: Standalone entity

### 10.2 Aggregate Design ✅ **CORRECT**

- ✅ **SuggestionAggregate**: Properly designed aggregate root
- ✅ **Debt**: Correctly not an aggregate (standalone)
- ✅ **ReviewSession**: Correctly not an aggregate (standalone)

### 10.3 Relationship Management ✅ **CORRECT**

- ✅ Relationships managed by application services (correct)
- ✅ No direct entity references across aggregates (correct)
- ✅ URI-based relationships (loose coupling)

### 10.4 Potential Improvements

1. **Consider ChangeEntry Entity** (if change history needs domain logic)
2. **Consider ReviewHistory Aggregate** (if historical analysis needed)
3. **Consider AwarenessProfile Entity** (if user profiling needed)

---

## 11. Conclusion

### 11.1 Current State: ✅ **WELL-DESIGNED**

The Awareness bounded context follows DDD principles correctly:

- ✅ Clear aggregate boundaries
- ✅ Proper entity classification
- ✅ Domain events properly defined
- ✅ Value objects used appropriately
- ✅ Domain services encapsulate business logic
- ✅ Application services handle orchestration

### 11.2 No Critical Issues Found

All entities are correctly classified:
- **Suggestion** and **SuggestionBatch** are entities within `SuggestionAggregate`
- **Debt** and **ReviewSession** are standalone entities
- Relationships are properly managed by application services

### 11.3 Architecture Quality: **HIGH**

The domain model is:
- **Cohesive**: Related concepts grouped together
- **Loosely Coupled**: Entities don't directly reference each other
- **Well-Isolated**: Domain layer uses ports, not infrastructure
- **Event-Driven**: Domain events properly published

---

## Appendix: Entity Relationship Summary

| Entity | Identity | Aggregate | Relationships |
|--------|----------|-----------|---------------|
| **Suggestion** | `id` | SuggestionAggregate | → SuggestionBatch (optional), → Debt (by URI), → ReviewSession (by URI) |
| **SuggestionBatch** | `batchId` | SuggestionAggregate | ← Suggestion (many) |
| **Debt** | `fileUri` | None (standalone) | ← Suggestion (many, by URI), → ReviewSession (many) |
| **ReviewSession** | `filePath + sessionStart` | None (standalone) | ← Debt (by URI), ← Suggestion (many, by URI) |

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Author**: DDD Analysis
