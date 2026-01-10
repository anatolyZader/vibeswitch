# AwarenessService Analysis

## Overview

`AwarenessService` is the **application service** that orchestrates the awareness monitoring system. It coordinates domain entities, application services, and infrastructure adapters to track AI-generated code changes and user review behavior.

---

## Method Categorization

### 🔵 Basic/Infrastructure Methods (Lifecycle & Queries)

These methods handle service lifecycle, configuration, and simple queries:

1. **`constructor()`** - Initializes service with adapters
2. **`setCallbacks()`** - Sets external callbacks for events
3. **`start()`** - Starts monitoring (initializes all services)
4. **`stop()`** - Stops monitoring (cleanup)
5. **`updateScore()`** - Triggers score calculation
6. **`getScore()`** - Returns current awareness score
7. **`handleExternallyCreatedFile()`** - Delegates to FileWatcherService
8. **`getStatus()`** - Returns monitoring status
9. **`getSuggestions()`** - Simple getter (delegates to aggregate)
10. **`getSuggestionsByStatus()`** - Simple getter (delegates to aggregate)
11. **`hasPendingSuggestions()`** - Simple query (delegates to aggregate)
12. **`getPendingSuggestionsForFile()`** - Simple query (delegates to aggregate)

---

## 🎯 Specific Functionality: **AI Suggestion Lifecycle Management**

The core functionality of `AwarenessService` is **tracking and managing the complete lifecycle of AI-generated code suggestions**. This includes:

1. **Detection & Recording** - Detecting when AI generates code
2. **User Interaction Tracking** - Detecting when users interact with suggestions
3. **Status Determination** - Determining if suggestions were accepted, rejected, or adapted
4. **Pattern Detection** - Detecting behavioral patterns (e.g., "keep all")

### Methods Implementing This Functionality

#### 1. **`recordAISuggestion(document, change)`** (Lines 469-501)
**Purpose**: Records a single AI-generated code suggestion

**What it does**:
- Creates a `Suggestion` entity from a text change event
- Adds suggestion to the aggregate
- Tracks it (adds to debt, schedules status check)
- Publishes `AISuggestionEvent`

**Key Logic**:
```javascript
// Creates suggestion entity
const suggestion = this.suggestionAggregate.createSuggestion({
    document: uri,
    range: change.range,
    text: change.text,
    size: changeSize
});

// Tracks it (debt, status checks, callbacks)
this._addSuggestionAndTrack(suggestion, changeSize);
```

---

#### 2. **`recordAISuggestionBatch(document, aggregatedChanges, meta)`** (Lines 509-598)
**Purpose**: Records multiple related AI changes as a single batch

**What it does**:
- Merges multiple changes into one suggestion
- Creates/updates a `SuggestionBatch` entity
- Handles range merging with smart capping (for large spans with small inserts)
- Publishes `SuggestionBatchCreatedEvent` for new batches

**Key Logic**:
```javascript
// Merge ranges (union of all changes)
const mergedRange = new Range(start, end);

// Smart capping: if huge span but tiny inserts, cap to 50 lines
if (lineSpan > 100 && avgInsertedPerLine < 5) {
    effectiveRange = cappedRange;
}

// Create batch and link suggestion
const batchId = this.suggestionAggregate.createOrUpdateBatch(uri, suggestion.id, mergedSize);
suggestion.batchId = batchId;
```

**Why it's special**: Handles complex range merging and batch tracking for refactoring operations.

---

#### 3. **`processFileAsSuggestion(fileUri, options)`** (Lines 606-647)
**Purpose**: Processes an entire file as an AI-generated suggestion

**What it does**:
- Opens file and reads entire content
- Creates suggestion for the whole file (range: 0,0 to lastLine,lastChar)
- Marks with metadata: `isFileCreation`, `isExternalCreation`, `isFileWrite`
- Tracks it like other suggestions

**Use Cases**:
- Files created by AI agent
- Files created externally (e.g., by another tool)
- Files written by agent (file write operations)

**Key Logic**:
```javascript
const suggestion = this.suggestionAggregate.createSuggestion({
    document: doc.uri.toString(),
    range: new Range(0, 0, lastLine, lastChar), // Entire file
    text: content,
    size: content.length,
    isFileCreation,
    isExternalCreation,
    isFileWrite
});
```

---

#### 4. **`recordUserEditBatch(document, aggregatedChanges)`** (Lines 654-718)
**Purpose**: Detects when users edit code that overlaps with pending AI suggestions

**What it does**:
- Gets pending suggestions for the document
- Merges user edit ranges (handles overlapping/touching ranges)
- Checks if user edits overlap with suggestion ranges
- Marks suggestions as "user edited" (adaptation detection)

**Key Logic**:
```javascript
// Merge overlapping/touching ranges
const mergedRanges = mergeRanges(aggregatedChanges);

// Check overlap with pending suggestions
for (const suggestion of pendingSuggestions) {
    for (const mergedRange of mergedRanges) {
        if (rangesOverlap(mergedRange, suggestion.range)) {
            suggestion.recordUserEdit(); // Mark as adapted
        }
    }
}
```

**Why it's special**: Complex range merging and overlap detection to identify when users adapt AI suggestions.

---

#### 5. **`checkSuggestionStatus(suggestionId)`** (Lines 735-867)
**Purpose**: Determines if a suggestion was accepted, rejected, or adapted

**What it does**:
- Opens document and reads current text at suggestion range
- Compares current text size to original suggestion size
- Applies business rules:
  - **Rejected**: Current size < 40% of original (or empty for tiny suggestions)
  - **Adapted**: User edited it (`suggestion.userEdited === true`)
  - **Accepted**: Still present and user reviewed it (`suggestion.reviewed === true`)
- Updates suggestion status in aggregate
- Detects "keep all" patterns (all suggestions in batch accepted without edits)
- Publishes `AISuggestionOutcomeEvent`
- Schedules retry if still pending

**Key Logic**:
```javascript
const currentText = doc.getText(safeRange);
const currentSize = currentText.length;
const sizeRatio = currentSize / suggestion.size;

if (currentSize < suggestion.size * 0.4) {
    // Rejected: less than 40% remains
    this.suggestionAggregate.updateSuggestionStatus(suggestion, 'rejected');
} else if (suggestion.userEdited) {
    // Adapted: user edited it
    this.suggestionAggregate.updateSuggestionStatus(suggestion, 'adapted');
} else if (suggestion.reviewed) {
    // Accepted: still present and reviewed
    this.suggestionAggregate.updateSuggestionStatus(suggestion, 'accepted');
    
    // Check for "keep all" pattern
    if (batch.isKeepAllPattern()) {
        this.keepAllDetector.trackAcceptance(result);
    }
} else {
    // Still pending - schedule another check
    setTimeout(() => this.checkSuggestionStatus(suggestion.id), 10000);
}
```

**Why it's special**: Complex heuristics to determine suggestion outcomes without explicit user actions.

---

#### 6. **`createSuggestionAndTrack(options, contentLength)`** (Lines 911-917)
**Purpose**: Public API for creating and tracking suggestions

**What it does**:
- Creates suggestion entity
- Calls `_addSuggestionAndTrack()` to handle tracking

**Use Case**: Called by other services (e.g., FileWatcherService) to create suggestions.

---

#### 7. **`_addSuggestionAndTrack(suggestion, contentLength)`** (Lines 919-947)
**Purpose**: Internal method that handles suggestion tracking workflow

**What it does**:
1. Adds suggestion to aggregate
2. Adds to debt (unreviewed code tracking)
3. Updates file colors in Explorer
4. Schedules status check (after 5 seconds)
5. Updates awareness score

**Key Logic**:
```javascript
// Add to aggregate
this.suggestionAggregate.addSuggestion(suggestion);

// Add to debt (unreviewed code)
this.debtService.addToDebt(uri, contentLength, () => this.updateScore());

// Schedule status check
setTimeout(() => {
    this.checkSuggestionStatus(suggestion.id);
}, 5000);

// Update score immediately
this.updateScore();
```

**Why it's special**: Orchestrates multiple systems (aggregate, debt, UI, scoring) when a suggestion is created.

---

## Functionality Summary

### **Core Functionality: AI Suggestion Lifecycle Management**

The awareness module provides **intelligent tracking of AI-generated code suggestions** through their complete lifecycle:

1. **📝 Detection Phase**
   - `recordAISuggestion()` - Single change detection
   - `recordAISuggestionBatch()` - Batch detection (refactoring)
   - `processFileAsSuggestion()` - File-level detection

2. **👤 Interaction Phase**
   - `recordUserEditBatch()` - Detects user edits overlapping suggestions
   - Tracks user engagement (cursor, scroll, time)

3. **✅ Outcome Phase**
   - `checkSuggestionStatus()` - Determines acceptance/rejection/adaptation
   - Pattern detection ("keep all")
   - Event publishing

4. **📊 Tracking Phase**
   - `_addSuggestionAndTrack()` - Orchestrates tracking workflow
   - Debt management
   - Score calculation
   - UI updates

### **Business Value**

This functionality enables:
- **Code Review Awareness**: Track which AI-generated code has been reviewed
- **Quality Metrics**: Calculate awareness scores based on review behavior
- **Pattern Detection**: Identify when users blindly accept all suggestions
- **Debt Management**: Track unreviewed code that needs attention

---

## Method Extraction Recommendation

If you want to extract the specific functionality, consider creating:

### **`SuggestionLifecycleService`** (New Application Service)

**Extract these methods**:
- `recordAISuggestion()`
- `recordAISuggestionBatch()`
- `processFileAsSuggestion()`
- `recordUserEditBatch()`
- `recordUserEdit()` (deprecated)
- `checkSuggestionStatus()`
- `createSuggestionAndTrack()`
- `_addSuggestionAndTrack()`

**Keep in `AwarenessService`**:
- Lifecycle methods (`start()`, `stop()`)
- Score management (`updateScore()`, `getScore()`)
- Simple queries (delegates to aggregate)
- Status reporting (`getStatus()`)

**Benefits**:
- ✅ Clear separation of concerns
- ✅ Easier testing of suggestion lifecycle logic
- ✅ Better organization
- ✅ `AwarenessService` becomes a coordinator/orchestrator

**Dependencies**:
- `SuggestionAggregate` (domain)
- `DebtService` (application)
- `KeepAllDetector` (domain service)
- Adapters (infrastructure)

---

## Architecture Notes

- **Application Service Pattern**: `AwarenessService` orchestrates domain entities and other services
- **Event-Driven**: Publishes domain events for external consumers
- **Async Status Checking**: Uses timers to periodically check suggestion status
- **Range-Based Logic**: Complex range merging and overlap detection
- **Heuristic-Based**: Uses size ratios and user interaction flags to determine outcomes

---

**Document Version**: 1.0  
**Last Updated**: 2024
