# Entity Relationship Diagram

## Visual Representation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AWARENESS BOUNDED CONTEXT                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                    SUGGESTION AGGREGATE (Aggregate Root)                     │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  SuggestionAggregate                                                │    │
│  │  - suggestionsById: Map<id, Suggestion>                            │    │
│  │  - batchesById: Map<batchId, SuggestionBatch>                       │    │
│  │  - pendingByDocUri: Map<uri, Set<id>>                              │    │
│  │                                                                     │    │
│  │  Methods:                                                           │    │
│  │  - createSuggestion() → Suggestion                                  │    │
│  │  - addSuggestion(suggestion)                                       │    │
│  │  - createOrUpdateBatch() → batchId                                 │    │
│  │  - updateSuggestionStatus()                                        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                          │
│                                    │ manages                                  │
│                    ┌──────────────┴──────────────┐                          │
│                    │                               │                          │
│                    ▼                               ▼                          │
│  ┌─────────────────────────┐      ┌──────────────────────────────┐         │
│  │  Suggestion              │      │  SuggestionBatch              │         │
│  │  ────────────            │      │  ───────────────             │         │
│  │  id: UUID                │      │  batchId: UUID                │         │
│  │  document: URI           │◄─────┤  filePath: FilePath          │         │
│  │  range: Range            │      │  suggestionIds: UUID[]      │         │
│  │  text: string            │      │  totalSize: number           │         │
│  │  size: number            │      │  status: enum                │         │
│  │  status: enum            │      │  acceptedCount: number       │         │
│  │  reviewed: boolean       │      │  rejectedCount: number       │         │
│  │  reviewTime: number      │      │  modifiedCount: number       │         │
│  │  userEdited: boolean     │      │                              │         │
│  │  editCount: number       │      │  Methods:                    │         │
│  │  batchId?: UUID          │      │  - addSuggestion()           │         │
│  │                          │      │  - recordOutcome()           │         │
│  │  Methods:                │      │  - isKeepAllPattern()       │         │
│  │  - markAsReviewed()      │      │  - isFullyResolved()        │         │
│  │  - updateStatus()        │      │                              │         │
│  │  - recordUserEdit()      │      └──────────────────────────────┘         │
│  │  - isPending()           │                                                │
│  └─────────────────────────┘                                                │
└─────────────────────────────────────────────────────────────────────────────┘
                    │
                    │ (document URI)
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  DEBT (Standalone Entity)                                                    │
│  ────────────────                                                            │
│  fileUri: URI (Identity)                                                     │
│  modifiedAt: timestamp                                                       │
│  lastModifiedAt: timestamp                                                   │
│  totalChanges: number                                                        │
│  modificationCount: number                                                   │
│  reviewed: boolean                                                           │
│  reviewedAt: timestamp?                                                     │
│  totalReviewTime: number                                                     │
│  firstOpenedAt: timestamp?                                                   │
│  lastVisitedAt: timestamp?                                                  │
│  reviewSessions: number                                                      │
│                                                                               │
│  Methods:                                                                     │
│  - addChange(changeSize)                                                      │
│  - markAsReviewed(reviewTime)                                                │
│  - updateSession(sessionData)                                                │
│  - hasUnreviewedDebt() → boolean                                             │
│  - getAge() → number                                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                    │
                    │ (filePath)
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  REVIEW SESSION (Standalone Entity)                                          │
│  ────────────────────────                                                    │
│  Identity: filePath + sessionStart (composite)                               │
│  filePath: FilePath                                                          │
│  sessionStart: timestamp                                                     │
│  lastActivity: timestamp                                                     │
│  cursorMovements: number                                                     │
│  scrollEvents: number                                                        │
│  reviewTime: number                                                          │
│  isActive: boolean                                                           │
│  completedAt: timestamp?                                                    │
│                                                                               │
│  Methods:                                                                     │
│  - recordCursorMovement()                                                    │
│  - recordScrollEvent()                                                        │
│  - hasSufficientEngagement() → boolean                                       │
│  - hasTimedOut() → boolean                                                   │
│  - complete(reviewTime)                                                       │
│  - getEngagementScore() → number (0-100)                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Relationship Details

### 1. Suggestion → SuggestionBatch
- **Type**: Many-to-One (optional)
- **Implementation**: `Suggestion.batchId` → `SuggestionBatch.batchId`
- **Managed By**: `SuggestionAggregate`
- **Invariant**: If `batchId` exists, batch must exist in aggregate

### 2. Suggestion → Debt
- **Type**: Many-to-One (by document URI)
- **Implementation**: `Suggestion.document` (URI) matches `Debt.fileUri` (URI)
- **Managed By**: `AwarenessService` (application service)
- **Note**: Loose coupling via URI matching (no direct reference)

### 3. Suggestion → ReviewSession
- **Type**: Many-to-One (by document URI)
- **Implementation**: `Suggestion.document` (URI) matches `ReviewSession.filePath` (URI)
- **Managed By**: `SessionService` (application service)
- **Note**: Loose coupling via URI matching (no direct reference)

### 4. Debt → ReviewSession
- **Type**: One-to-Many
- **Implementation**: `Debt.fileUri` (URI) matches `ReviewSession.filePath` (URI)
- **Managed By**: `SessionService` (application service)
- **Note**: One debt can have multiple review sessions over time

### 5. SuggestionBatch → Suggestion
- **Type**: One-to-Many
- **Implementation**: `SuggestionBatch.suggestionIds[]` contains `Suggestion.id`
- **Managed By**: `SuggestionAggregate`
- **Invariant**: All suggestion IDs in batch must exist in aggregate

## Value Objects

```
┌─────────────────┐
│  SuggestionId   │
│  ────────────   │
│  value: string  │
│  (validated)    │
└─────────────────┘

┌─────────────────┐
│  FilePath       │
│  ─────────      │
│  value: string  │
│  (validated)    │
│  Methods:       │
│  - getFileName()│
│  - getDirectory()│
└─────────────────┘

┌─────────────────┐
│  Score          │
│  ──────         │
│  value: number  │
│  (0-100)        │
│  Methods:       │
│  - isCritical() │
│  - isWarning()  │
│  - isSafe()     │
└─────────────────┘
```

## Domain Services

```
┌─────────────────────────────────┐
│  ScoreCalculator                 │
│  ───────────────                 │
│  State:                          │
│  - currentScore: number          │
│  - scores: object                │
│                                  │
│  Methods:                        │
│  - updateScore()                 │
│  - calculateReviewScore()         │
│  - calculateCriticalScore()      │
│  - calculateAdaptationScore()    │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│  KeepAllDetector                 │
│  ───────────────                 │
│  State:                          │
│  - recentAcceptances: array       │
│                                  │
│  Methods:                        │
│  - trackAcceptance()             │
│  - detectKeepAll()               │
└─────────────────────────────────┘
```

## Domain Events Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    EVENT FLOW                                    │
└─────────────────────────────────────────────────────────────────┘

AI Code Generation
    │
    ├─► AISuggestionEvent
    │   (suggestionId, filePath, range, changeSize)
    │
    └─► SuggestionBatchCreatedEvent
        (batchId, filePath, suggestionCount, totalSize)

User Review
    │
    ├─► ReviewSessionStartedEvent
    │   (filePath, sessionStart)
    │
    ├─► AISuggestionOutcomeEvent
    │   (suggestionId, outcome, filePath)
    │
    └─► ReviewSessionCompletedEvent
        (filePath, sessionStart, completedAt, reviewTime, engagementScore)

Debt Management
    │
    └─► DebtClearedEvent
        (clearedFiles[], totalDebtCleared)

Pattern Detection
    │
    └─► KeepAllEvent
        (suggestionIds[], filePath, acceptanceCount)

Score Calculation
    │
    └─► ScoreUpdateEvent
        (score, components, suggestions, debt)
```

## Aggregate Boundaries

```
┌─────────────────────────────────────────────────────────────────┐
│  SUGGESTION AGGREGATE BOUNDARY                                  │
│  ───────────────────────────────                               │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  SuggestionAggregate (Root)                               │ │
│  │  - Manages Suggestion entities                            │ │
│  │  - Manages SuggestionBatch entities                       │ │
│  │  - Enforces invariants                                    │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Access Rules:                                                  │
│  - Only aggregate root can create/modify entities              │
│  - External access only through aggregate root                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  STANDALONE ENTITIES (Outside Aggregates)                       │
│  ────────────────────────────────────────                        │
│                                                                 │
│  ┌──────────────┐              ┌──────────────────┐          │
│  │  Debt        │              │  ReviewSession    │          │
│  │  (fileUri)   │              │  (filePath +      │          │
│  │              │              │   sessionStart)   │          │
│  └──────────────┘              └──────────────────┘          │
│                                                                 │
│  Managed By: Application Services                              │
│  - DebtService manages Debt entities                            │
│  - SessionService manages ReviewSession entities                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Summary

- **1 Aggregate**: `SuggestionAggregate` (contains `Suggestion` and `SuggestionBatch`)
- **2 Standalone Entities**: `Debt`, `ReviewSession`
- **3 Value Objects**: `SuggestionId`, `FilePath`, `Score`
- **2 Domain Services**: `ScoreCalculator`, `KeepAllDetector`
- **8 Domain Events**: All properly defined and published

**Architecture Quality**: ✅ **HIGH** - Well-designed, follows DDD principles
