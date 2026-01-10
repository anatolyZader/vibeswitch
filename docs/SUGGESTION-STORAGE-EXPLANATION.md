# Suggestion Storage: Why Suggestions Don't Get Lost

## Your Question

> "What about if the user received several suggestions and haven't reviewed them yet? Don't all the suggestions except the activeReviewSuggestion get lost?"

**Short Answer: No, they don't get lost!** All suggestions are stored in the domain layer, and `activeReviewSuggestion` only tracks which one is **currently being reviewed**.

---

## Two-Layer Storage Architecture

### 1. Domain Layer: All Suggestions Stored (Persistent)

**Location**: `SuggestionAggregate` (domain layer)

**Storage**:
```javascript
// Line 33: SuggestionAggregate.suggestionsById
this.suggestionsById = new Map(); // id -> Suggestion entity

// Line 46: Per-document index for fast lookup
this.pendingByDocUri = new Map(); // uri -> Set<id>
```

**What It Stores**:
- **ALL suggestions** (pending, accepted, rejected, adapted)
- **Persistent** across cursor movements
- **Survives** document closes, editor switches
- **Indexed** by document URI for fast lookup

**Example**:
```javascript
// User receives 5 suggestions in utils.js
SuggestionAggregate.suggestionsById = {
    "suggestion-1": Suggestion { status: 'pending', ... },
    "suggestion-2": Suggestion { status: 'pending', ... },
    "suggestion-3": Suggestion { status: 'pending', ... },
    "suggestion-4": Suggestion { status: 'pending', ... },
    "suggestion-5": Suggestion { status: 'pending', ... }
}

// All 5 suggestions remain in aggregate, regardless of cursor position
```

### 2. Input Layer: Currently Reviewing (Temporary)

**Location**: `AwarenessEventListener.activeReviewSuggestion` (input layer)

**Storage**:
```javascript
// Line 23: Only tracks currently reviewing suggestion
this.activeReviewSuggestion = new Map(); // uri -> { suggestionId, reviewStarted, dwellTimer }
```

**What It Stores**:
- **Only ONE suggestion per document** (the one cursor is currently in)
- **Temporary** - created when cursor enters, deleted when cursor leaves
- **Event-driven** - tracks review state for dwell time

**Example**:
```javascript
// User has 5 suggestions, cursor is in suggestion-3
activeReviewSuggestion = {
    "file:///workspace/utils.js": {
        suggestionId: "suggestion-3",  // ← Only this one tracked
        reviewStarted: 1699123456789,
        dwellTimer: Timeout
    }
}

// Suggestions 1, 2, 4, 5 are NOT in this Map
// But they're still in SuggestionAggregate! ✅
```

---

## How It Works: Querying All Suggestions

### Every Cursor Move: Query All Pending Suggestions

```javascript
// Line 335: Event listener queries ALL pending suggestions
const pendingSuggestions = this.controller.getSuggestionsByStatus('pending');
```

**Flow**:
```
AwarenessEventListener.onCursorMove()
    ↓
controller.getSuggestionsByStatus('pending')
    ↓
AwarenessService.getSuggestionsByStatus('pending')
    ↓
SuggestionAggregate.getSuggestionsByStatus('pending')
    ↓
Returns ALL pending suggestions (not just active one)
```

**What Happens**:
1. Event listener queries **ALL pending suggestions** from aggregate
2. Checks which one cursor is currently in
3. Updates `activeReviewSuggestion` Map with **only that one**
4. All other suggestions remain in aggregate, untouched

### Example Scenario

**Initial State**:
```
SuggestionAggregate.suggestionsById:
  - suggestion-1 (pending, lines 10-20)
  - suggestion-2 (pending, lines 30-40)
  - suggestion-3 (pending, lines 50-60)
  - suggestion-4 (pending, lines 70-80)
  - suggestion-5 (pending, lines 90-100)

activeReviewSuggestion: {} (empty - no cursor in any suggestion)
```

**User Moves Cursor to Line 15** (in suggestion-1):
```
1. onCursorMove() called
2. Query: getSuggestionsByStatus('pending')
   → Returns [suggestion-1, suggestion-2, suggestion-3, suggestion-4, suggestion-5]
3. Check: isPositionInRange(15, suggestion-1.range) → YES
4. Set: activeReviewSuggestion.set(uri, { suggestionId: "suggestion-1", ... })
5. Return: Exit loop (line 389)

Result:
  SuggestionAggregate: Still has all 5 suggestions ✅
  activeReviewSuggestion: Only tracks suggestion-1 ✅
```

**User Moves Cursor to Line 35** (in suggestion-2):
```
1. onCursorMove() called
2. Query: getSuggestionsByStatus('pending')
   → Returns [suggestion-1, suggestion-2, suggestion-3, suggestion-4, suggestion-5]
3. Check: Cursor left suggestion-1
   → _closeActiveReview(uri) called
   → activeReviewSuggestion.delete(uri)
4. Check: isPositionInRange(35, suggestion-2.range) → YES
5. Set: activeReviewSuggestion.set(uri, { suggestionId: "suggestion-2", ... })

Result:
  SuggestionAggregate: Still has all 5 suggestions ✅
  activeReviewSuggestion: Now tracks suggestion-2 (suggestion-1 removed from Map) ✅
  Suggestion-1: Still in aggregate, just not actively being reviewed ✅
```

**User Moves Cursor to Line 5** (not in any suggestion):
```
1. onCursorMove() called
2. Query: getSuggestionsByStatus('pending')
   → Returns [suggestion-1, suggestion-2, suggestion-3, suggestion-4, suggestion-5]
3. Check: Cursor left suggestion-2
   → _closeActiveReview(uri) called
   → activeReviewSuggestion.delete(uri)
4. Check: Loop through all suggestions
   → None match (cursor not in any range)
   → No new entry created

Result:
  SuggestionAggregate: Still has all 5 suggestions ✅
  activeReviewSuggestion: Empty (no active review) ✅
  All 5 suggestions: Still in aggregate, waiting to be reviewed ✅
```

---

## Key Points

### 1. **All Suggestions Are Stored in Domain Layer**

```javascript
// SuggestionAggregate.suggestionsById (Map)
// Stores ALL suggestions regardless of cursor position
this.suggestionsById = new Map(); // id -> Suggestion

// Can hold up to 5000 suggestions (with eviction policy)
this.MAX_TOTAL_SUGGESTIONS = 5000;
```

### 2. **activeReviewSuggestion is Just a "Currently Reviewing" Tracker**

```javascript
// Only tracks which suggestion cursor is CURRENTLY in
// NOT a storage mechanism for all suggestions
this.activeReviewSuggestion = new Map(); // uri -> ReviewState
```

### 3. **Every Cursor Move Queries All Suggestions**

```javascript
// Line 335: Always queries ALL pending suggestions
const pendingSuggestions = this.controller.getSuggestionsByStatus('pending');

// This returns ALL suggestions, not just the active one
// Then checks which one cursor is in
```

### 4. **Suggestions Persist Until Resolved**

**Lifecycle**:
```
AI Change Detected
    ↓
Suggestion Created
    ↓
Added to SuggestionAggregate (stored permanently)
    ↓
Status: 'pending'
    ↓
User Reviews (cursor enters range)
    ↓
activeReviewSuggestion tracks it (temporary)
    ↓
User Moves Away (cursor leaves range)
    ↓
activeReviewSuggestion removes it (temporary state cleared)
    ↓
Suggestion STILL in SuggestionAggregate (permanent storage) ✅
    ↓
User Accepts/Rejects/Adapts
    ↓
Status changes to 'accepted'/'rejected'/'adapted'
    ↓
Still in SuggestionAggregate (for history/analytics)
```

---

## Visual Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ SuggestionAggregate (Domain Layer)                           │
│ ───────────────────────────────────────────────────────────  │
│                                                               │
│ suggestionsById: Map {                                       │
│   "suggestion-1": Suggestion { status: 'pending' },         │
│   "suggestion-2": Suggestion { status: 'pending' },         │
│   "suggestion-3": Suggestion { status: 'pending' },         │
│   "suggestion-4": Suggestion { status: 'pending' },        │
│   "suggestion-5": Suggestion { status: 'pending' }          │
│ }                                                             │
│                                                               │
│ ✅ ALL suggestions stored here                               │
│ ✅ Persistent across cursor movements                        │
│ ✅ Survives document closes                                  │
│ ✅ Indexed by document URI                                   │
└─────────────────────────────────────────────────────────────┘
                            ↑
                            │ Queries ALL suggestions
                            │
┌─────────────────────────────────────────────────────────────┐
│ AwarenessEventListener (Input Layer)                          │
│ ───────────────────────────────────────────────────────────  │
│                                                               │
│ activeReviewSuggestion: Map {                                │
│   "file:///workspace/utils.js": {                            │
│     suggestionId: "suggestion-3",  ← Only currently reviewing
│     reviewStarted: 1699123456789,                            │
│     dwellTimer: Timeout                                      │
│   }                                                           │
│ }                                                             │
│                                                               │
│ ⚠️ Only tracks ONE suggestion (currently reviewing)         │
│ ⚠️ Temporary (created/destroyed on cursor move)              │
│ ⚠️ Event-driven (for dwell time tracking)                   │
└─────────────────────────────────────────────────────────────┘
```

---

## What Happens to Non-Active Suggestions?

### They Remain in SuggestionAggregate

**Scenario**: User has 5 suggestions, cursor is only in suggestion-3

```
SuggestionAggregate:
  ✅ suggestion-1 (pending) - Still stored
  ✅ suggestion-2 (pending) - Still stored
  ✅ suggestion-3 (pending) - Still stored (and actively being reviewed)
  ✅ suggestion-4 (pending) - Still stored
  ✅ suggestion-5 (pending) - Still stored

activeReviewSuggestion:
  ✅ Only tracks suggestion-3 (cursor is in its range)
```

**When User Moves Cursor**:
- Cursor enters suggestion-1 range → suggestion-1 tracked in Map
- Cursor leaves suggestion-1 range → suggestion-1 removed from Map
- **But suggestion-1 still in SuggestionAggregate!** ✅

### They Can Be Queried Anytime

```javascript
// Get all pending suggestions
const allPending = controller.getSuggestionsByStatus('pending');
// Returns all 5 suggestions, regardless of cursor position

// Get pending suggestions for specific file
const filePending = controller.getPendingSuggestionsForFile(uri);
// Returns all pending suggestions in that file

// Find specific suggestion
const suggestion = controller.findSuggestion('suggestion-1');
// Returns suggestion-1, even if not actively being reviewed
```

### They're Used for Scoring and Analytics

```javascript
// ScoreCalculator uses ALL suggestions
const allSuggestions = suggestionAggregate.getSuggestions();
const pendingCount = allSuggestions.filter(s => s.status === 'pending').length;
// Counts ALL pending suggestions, not just active one

// DebtService uses ALL suggestions
const pendingSuggestions = aiSuggestions.filter(s => s.status === 'pending');
// Uses ALL pending suggestions for debt calculation
```

---

## Why This Design?

### Separation of Concerns

**Domain Layer (SuggestionAggregate)**:
- **Responsibility**: Store and manage ALL suggestions
- **Lifecycle**: Long-lived, persistent
- **Purpose**: Business logic, analytics, scoring

**Input Layer (activeReviewSuggestion)**:
- **Responsibility**: Track which suggestion is currently being reviewed
- **Lifecycle**: Temporary, event-driven
- **Purpose**: Dwell time tracking, review state management

### Benefits

1. **No Data Loss**: All suggestions stored in aggregate
2. **Efficient Lookup**: Per-document index for fast queries
3. **Clean Separation**: Domain vs input layer concerns
4. **Scalable**: Can handle thousands of suggestions
5. **Queryable**: Can query all suggestions anytime

---

## Summary

**Your Concern**: "Don't all suggestions except activeReviewSuggestion get lost?"

**Answer**: **No!** 

- ✅ **ALL suggestions** are stored in `SuggestionAggregate` (domain layer)
- ✅ **Only ONE suggestion** is tracked in `activeReviewSuggestion` (input layer)
- ✅ **Every cursor move** queries ALL pending suggestions from aggregate
- ✅ **Non-active suggestions** remain in aggregate, fully accessible
- ✅ **Suggestions persist** until resolved (accepted/rejected/adapted)

The `activeReviewSuggestion` Map is just a **"currently reviewing" tracker**, not a storage mechanism. All suggestions are safely stored in the domain layer aggregate.
