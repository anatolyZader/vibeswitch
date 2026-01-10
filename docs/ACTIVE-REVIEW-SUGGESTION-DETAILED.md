# ActiveReviewSuggestion Map - Detailed Explanation

## Overview

The `activeReviewSuggestion` Map is a state management mechanism in the input layer that tracks which AI suggestion the user is currently reviewing. It bridges the gap between VS Code cursor events and domain suggestion entities.

---

## 1. Tracks Which Suggestion is Being Reviewed Per Document

### What It Does

The Map maintains a **one-to-one relationship** between document URIs and the suggestion currently being reviewed in that document.

### Structure

```javascript
// Map structure
activeReviewSuggestion: Map<string, ReviewState>

// Key: Document URI (string)
// Example: "file:///workspace/src/utils.js"

// Value: ReviewState object
{
    suggestionId: "suggestion-123",      // ID of suggestion being reviewed
    reviewStarted: 1699123456789,        // Timestamp when review started
    reviewTime: 0,                       // Accumulated time (updated on close)
    dwellTimer: Timeout                  // Timer reference for cleanup
}
```

### How It Works

#### Step 1: Cursor Enters Suggestion Range

```javascript
// Line 361: Check if cursor is within suggestion range
if (this.controller.isPositionInRange(position, suggestion.range)) {
    // Line 383-388: Store review state
    this.activeReviewSuggestion.set(uri, {
        suggestionId: suggestion.id,
        reviewStarted: Date.now(),
        reviewTime: 0,
        dwellTimer: setTimeout(...)
    });
}
```

**Example Scenario:**
```
Document: file:///workspace/src/utils.js
Cursor Position: Line 45, Column 10
Suggestion Range: Lines 40-50

Result:
activeReviewSuggestion.set("file:///workspace/src/utils.js", {
    suggestionId: "suggestion-abc123",
    reviewStarted: 1699123456789,
    reviewTime: 0,
    dwellTimer: <Timeout>
})
```

#### Step 2: Check Current Review State

```javascript
// Line 336: Get current review state for document
const activeReview = this.activeReviewSuggestion.get(uri);

if (activeReview) {
    // There's an active review - check if still valid
    const activeSuggestion = pendingSuggestions.find(
        s => s.id === activeReview.suggestionId
    );
    
    if (activeSuggestion && activeSuggestion.document === uri) {
        // Review is still valid - check if cursor still in range
        if (!this.controller.isPositionInRange(position, activeSuggestion.range)) {
            // Cursor left - close review
            this._closeActiveReview(uri);
        } else {
            // Still reviewing - continue tracking
            return;
        }
    }
}
```

### Why Per-Document?

**Problem Solved:**
- User can have multiple files open
- Each file can have multiple suggestions
- Need to track which suggestion is active in each file independently

**Solution:**
- Use document URI as key (unique per file)
- One suggestion per document (prevents conflicts)
- Independent tracking per file

**Example:**
```
File A (utils.js):
  activeReviewSuggestion.get("file:///workspace/utils.js")
  → { suggestionId: "suggestion-1", ... }

File B (helper.js):
  activeReviewSuggestion.get("file:///workspace/helper.js")
  → { suggestionId: "suggestion-2", ... }
```

### Benefits

1. **Multi-file support**: Track reviews across multiple open files
2. **State isolation**: Each document's review state is independent
3. **Fast lookup**: O(1) Map lookup by URI
4. **Clear ownership**: Each document owns its review state

---

## 2. Implements Dwell Time (1000ms) Before Marking as Reviewed

### What It Does

Requires the cursor to remain in the suggestion range for **at least 1000ms** before marking the suggestion as reviewed. This prevents accidental "reviewed" marks from quick cursor touches.

### The Problem Without Dwell Time

**Scenario:**
```
User quickly moves cursor through file
Cursor briefly touches suggestion range (50ms)
→ Suggestion marked as reviewed ❌ (false positive)
```

**Issues:**
- Accidental reviews from quick cursor movements
- No way to distinguish intentional review from accidental touch
- Poor user experience (suggestions marked reviewed unintentionally)

### The Solution: Dwell Time

```javascript
// Line 367-380: Dwell time implementation
const reviewStarted = Date.now();

// Create timer that fires after 1000ms
const dwellTimer = setTimeout(() => {
    // Only execute if cursor is still in the same suggestion
    const currentReview = this.activeReviewSuggestion.get(uri);
    if (currentReview && currentReview.suggestionId === suggestion.id) {
        // Cursor stayed for full 1000ms - mark as reviewed
        this.controller.markSuggestionAsReviewed(suggestion.id);
        this.controller.checkSuggestionStatus(suggestion.id);
    }
}, 1000); // 1000ms = 1 second dwell time
```

### How It Works

#### Timeline Example

```
T=0ms:    Cursor enters suggestion range
          → reviewStarted = 1699123456789
          → Timer starts (1000ms countdown)
          → activeReviewSuggestion.set(uri, { dwellTimer, ... })

T=200ms:  Cursor still in range
          → Timer still counting (800ms remaining)
          → No action taken

T=500ms:  Cursor still in range
          → Timer still counting (500ms remaining)
          → No action taken

T=1000ms: Timer fires
          → Check: Is cursor still in same suggestion?
          → Yes: markSuggestionAsReviewed() called ✅
          → No: Timer callback does nothing (review already closed)
```

#### Early Exit Scenario

```
T=0ms:    Cursor enters suggestion range
          → Timer starts (1000ms)

T=300ms:  Cursor leaves suggestion range
          → _closeActiveReview(uri) called
          → clearTimeout(dwellTimer) ✅
          → Timer cancelled (prevents false positive)

T=1000ms: Timer would have fired, but was cancelled
          → No action taken ✅
```

### Why 1000ms?

**Balance:**
- **Too short (< 500ms)**: Still allows accidental touches
- **Too long (> 2000ms)**: Feels unresponsive, user might think it's broken
- **1000ms**: Sweet spot - intentional review but still responsive

**User Experience:**
- Quick cursor movement: No false positives ✅
- Intentional review: Feels natural (1 second is barely noticeable) ✅
- Responsive: Doesn't feel laggy ✅

### Validation in Timer Callback

```javascript
// Line 372-373: Critical validation
const currentReview = this.activeReviewSuggestion.get(uri);
if (currentReview && currentReview.suggestionId === suggestion.id) {
    // Only mark if:
    // 1. Review still exists (wasn't closed)
    // 2. Same suggestion (user didn't switch to different suggestion)
    this.controller.markSuggestionAsReviewed(suggestion.id);
}
```

**Why This Validation?**
- Prevents race conditions
- Handles case where user switches suggestions quickly
- Ensures only the intended suggestion is marked

---

## 3. Manages Timer Cleanup to Prevent Memory Leaks

### What It Does

Stores timer references in the Map and ensures they're properly cleared when reviews end, preventing memory leaks from orphaned timers.

### The Problem Without Cleanup

**Memory Leak Scenario:**
```javascript
// User enters suggestion
const timer1 = setTimeout(() => { ... }, 1000);

// User leaves suggestion (before timer fires)
// Timer still running in background! ❌
// Timer callback will fire even though review ended
// Memory leak: Timer reference never cleared
```

**Issues:**
- Orphaned timers continue running
- Timer callbacks execute on stale state
- Memory not released (timer references held)
- Potential bugs (marking wrong suggestions as reviewed)

### The Solution: Timer Storage and Cleanup

#### Step 1: Store Timer Reference

```javascript
// Line 370-380: Create and store timer
const dwellTimer = setTimeout(() => {
    // Timer callback
}, 1000);

// Line 383-388: Store timer in Map
this.activeReviewSuggestion.set(uri, {
    suggestionId: suggestion.id,
    reviewStarted: reviewStarted,
    reviewTime: 0,
    dwellTimer: dwellTimer  // ← Store reference for cleanup
});
```

**Why Store It?**
- Need reference to clear it later
- Map provides easy access by URI
- Can check if timer exists before clearing

#### Step 2: Cleanup on Review Close

```javascript
// Line 292-299: _closeActiveReview method
_closeActiveReview(uri) {
    const activeReview = this.activeReviewSuggestion.get(uri);
    if (!activeReview) return;
    
    // Critical: Clear timer before doing anything else
    if (activeReview.dwellTimer) {
        clearTimeout(activeReview.dwellTimer);  // ← Prevent memory leak
    }
    
    // ... rest of cleanup
}
```

**Cleanup Scenarios:**

1. **Cursor Leaves Suggestion** (Line 345):
   ```javascript
   if (!this.controller.isPositionInRange(position, activeSuggestion.range)) {
       this._closeActiveReview(uri);  // Clears timer
   }
   ```

2. **Document Closes** (Line 289):
   ```javascript
   onDocumentClose(document) {
       this._closeActiveReview(uri);  // Clears timer
   }
   ```

3. **Editor Changes** (Line 433-436):
   ```javascript
   onEditorChange(editor) {
       // Close all active reviews when switching editors
       for (const uri of this.activeReviewSuggestion.keys()) {
           this._closeActiveReview(uri);  // Clears all timers
       }
   }
   ```

4. **Disposal** (Line 474-477):
   ```javascript
   dispose() {
       // Close all active reviews (cleans up dwell timers)
       for (const uri of this.activeReviewSuggestion.keys()) {
           this._closeActiveReview(uri);  // Clears all timers
       }
       this.activeReviewSuggestion.clear();
   }
   ```

### Memory Leak Prevention Checklist

✅ **Timer stored in Map**: Easy to access and clear
✅ **Cleared on review close**: `clearTimeout()` called
✅ **Cleared on document close**: Prevents orphaned timers
✅ **Cleared on editor change**: Prevents stale timers
✅ **Cleared on disposal**: Clean shutdown

### Impact of Not Cleaning Up

**Without Cleanup:**
```
100 suggestions reviewed
→ 100 timers created
→ 50 timers cancelled (user left early)
→ 50 timers fire (mark suggestions as reviewed)
→ 50 timers never cleared ❌
→ Memory leak: 50 timer references held indefinitely
```

**With Cleanup:**
```
100 suggestions reviewed
→ 100 timers created
→ 50 timers cancelled (user left early)
→ clearTimeout() called for all 50 ✅
→ 50 timers fire (mark suggestions as reviewed)
→ clearTimeout() called for all 50 ✅
→ Memory released: 0 timer references held ✅
```

---

## 4. Separates Review State (Input Layer) from Suggestion Entities (Domain Layer)

### What It Does

Keeps review tracking state (event-driven, temporary) separate from suggestion domain entities (business logic, persistent). This maintains clean architectural boundaries.

### The Separation

#### Input Layer (Event Listener)
```javascript
// Temporary, event-driven state
this.activeReviewSuggestion = new Map();  // ← Input layer

// Contains:
{
    suggestionId: "suggestion-123",
    reviewStarted: 1699123456789,
    reviewTime: 0,
    dwellTimer: Timeout  // ← Event-driven concern
}
```

#### Domain Layer (Suggestion Entity)
```javascript
// Persistent, business logic state
class Suggestion {
    constructor(...) {
        // Domain properties
        this.id = id;
        this.document = document;
        this.range = range;
        this.text = text;
        
        // Lifecycle state (domain concern)
        this.reviewed = false;      // ← Domain property
        this.reviewTime = 0;         // ← Domain property
        this.reviewStarted = null;   // ← Domain property
        this.status = 'pending';
    }
}
```

### Why This Separation?

#### 1. **Different Lifecycles**

**Input Layer State:**
- Created when cursor enters suggestion
- Destroyed when cursor leaves or document closes
- Temporary, event-driven
- Lives only during active review

**Domain Entity State:**
- Created when AI suggestion is detected
- Persists until suggestion is resolved
- Long-lived, business-driven
- Lives for entire suggestion lifecycle

**Example:**
```
Input Layer:
  Cursor enters → Map entry created
  Cursor leaves → Map entry deleted
  (Temporary, event-driven)

Domain Entity:
  AI change detected → Suggestion created
  User reviews → reviewed = true
  User accepts → status = 'accepted'
  (Persistent, business-driven)
```

#### 2. **Different Responsibilities**

**Input Layer:**
- Reacts to VS Code events (cursor moves)
- Manages event-driven timers
- Tracks temporary review state
- Bridges events to domain

**Domain Layer:**
- Encapsulates business rules
- Manages suggestion lifecycle
- Stores persistent state
- No knowledge of VS Code events

#### 3. **Different Concerns**

**Input Layer Concerns:**
- Event handling
- Timer management
- Cursor position tracking
- VS Code API interaction

**Domain Layer Concerns:**
- Business logic
- State validation
- Lifecycle management
- Domain rules

### How They Interact

#### Input Layer → Domain Layer

```javascript
// Line 374: Input layer marks domain entity as reviewed
this.controller.markSuggestionAsReviewed(suggestion.id);

// Line 309: Input layer updates domain entity review time
this.controller.updateSuggestionReviewTime(
    activeReview.suggestionId,
    (suggestion.reviewTime || 0) + reviewDuration
);
```

**Flow:**
```
Input Layer (Event Listener)
    ↓ (calls controller)
AwarenessController
    ↓ (calls service)
AwarenessService
    ↓ (updates domain entity)
Suggestion Entity
    ↓ (domain logic)
reviewed = true
reviewTime = 5000
```

#### Domain Layer → Input Layer

```javascript
// Line 335: Input layer queries domain for suggestions
const pendingSuggestions = this.controller.getSuggestionsByStatus('pending');

// Line 340: Input layer finds specific suggestion
const activeSuggestion = pendingSuggestions.find(
    s => s.id === activeReview.suggestionId
);
```

**Flow:**
```
Input Layer (Event Listener)
    ↓ (queries via controller)
AwarenessController
    ↓ (queries via service)
AwarenessService
    ↓ (queries domain aggregate)
SuggestionAggregate
    ↓ (returns domain entities)
Suggestion Entities
    ↓ (input layer uses for tracking)
activeReviewSuggestion Map
```

### Benefits of Separation

1. **Clean Architecture**: Input layer doesn't pollute domain
2. **Testability**: Can test domain logic without VS Code events
3. **Flexibility**: Can change event handling without affecting domain
4. **Maintainability**: Clear boundaries, easier to understand
5. **Reusability**: Domain entities can be used in different contexts

### What Happens Without Separation?

**Anti-Pattern:**
```javascript
// ❌ BAD: Domain entity knows about timers
class Suggestion {
    constructor(...) {
        this.dwellTimer = null;  // ← Domain shouldn't know about timers
    }
    
    startReview() {
        this.dwellTimer = setTimeout(...);  // ← Domain shouldn't handle events
    }
}
```

**Problems:**
- Domain entities become coupled to VS Code
- Can't test domain logic without VS Code
- Hard to reuse domain entities elsewhere
- Violates separation of concerns

---

## 5. Ensures Only One Suggestion is Tracked Per Document at a Time

### What It Does

Enforces a constraint that only one suggestion can be actively reviewed per document at any given time. This prevents conflicts and simplifies state management.

### The Problem Without This Constraint

**Scenario: Multiple Overlapping Suggestions**
```
Document: utils.js
Suggestion A: Lines 10-20
Suggestion B: Lines 15-25  (overlaps with A)
Suggestion C: Lines 30-40

Cursor at Line 17 (within both A and B)
```

**Without Constraint:**
```javascript
// ❌ BAD: Could track multiple suggestions
for (const suggestion of pendingSuggestions) {
    if (this.controller.isPositionInRange(position, suggestion.range)) {
        // Track suggestion A
        this.activeReviewSuggestion.set(uri, { suggestionId: suggestionA.id, ... });
        // Also track suggestion B (overlap!)
        this.activeReviewSuggestion.set(uri, { suggestionId: suggestionB.id, ... });
        // Conflict! Which one is active?
    }
}
```

**Issues:**
- Multiple timers for same document
- Ambiguity: Which suggestion is being reviewed?
- Race conditions: Which timer fires first?
- State conflicts: Map entry overwritten multiple times

### The Solution: Single Suggestion Per Document

#### Implementation

```javascript
// Line 356-391: Only track one suggestion
for (const suggestion of pendingSuggestions) {
    if (suggestion.document !== uri) continue;
    
    if (this.controller.isPositionInRange(position, suggestion.range)) {
        // Found a suggestion - track it
        this.activeReviewSuggestion.set(uri, {
            suggestionId: suggestion.id,
            reviewStarted: reviewStarted,
            reviewTime: 0,
            dwellTimer: dwellTimer
        });
        
        return;  // ← CRITICAL: Exit immediately after finding first match
    }
}
```

**Key Line: `return;` (Line 389)**
- Exits loop after finding first matching suggestion
- Prevents tracking multiple suggestions
- Ensures only one entry per document

### How It Handles Overlapping Suggestions

#### Scenario: Cursor in Overlapping Range

```
Suggestion A: Lines 10-20
Suggestion B: Lines 15-25
Cursor: Line 17 (in both ranges)
```

**Behavior:**
```javascript
// Loop through suggestions
for (const suggestion of pendingSuggestions) {
    // Check suggestion A (first in array)
    if (isPositionInRange(position, suggestionA.range)) {
        // Match! Track suggestion A
        activeReviewSuggestion.set(uri, { suggestionId: "A", ... });
        return;  // ← Exit - don't check suggestion B
    }
    
    // suggestion B never checked (loop exited)
}
```

**Result:**
- Only suggestion A is tracked
- Suggestion B is ignored (even though cursor is in its range)
- No conflicts, no ambiguity

### Priority: First Match Wins

**Order Matters:**
- Suggestions are checked in array order
- First matching suggestion wins
- Later suggestions are ignored

**Why This Works:**
- Predictable behavior
- No ambiguity
- Simple implementation
- Good enough for most cases

### Edge Cases Handled

#### Case 1: Cursor Moves Between Overlapping Suggestions

```
T=0:    Cursor at Line 17 (in A and B)
        → Tracks suggestion A (first match)
        → activeReviewSuggestion = { suggestionId: "A" }

T=100:  Cursor moves to Line 18 (still in A and B)
        → Checks if still in A: YES
        → Returns early (line 348)
        → Suggestion A still tracked

T=200:  Cursor moves to Line 16 (only in A, not B)
        → Checks if still in A: YES
        → Returns early
        → Suggestion A still tracked
```

#### Case 2: Active Suggestion Becomes Invalid

```javascript
// Line 339-353: Handle invalid active review
if (activeReview) {
    const activeSuggestion = pendingSuggestions.find(
        s => s.id === activeReview.suggestionId
    );
    
    if (activeSuggestion && activeSuggestion.document === uri) {
        // Active suggestion still exists and is in same document
        if (!this.controller.isPositionInRange(position, activeSuggestion.range)) {
            // Cursor left - close review
            this._closeActiveReview(uri);
        } else {
            // Still in range - continue tracking
            return;
        }
    } else {
        // Active suggestion no longer exists or is in different document
        this.activeReviewSuggestion.delete(uri);  // ← Clean up invalid state
    }
}
```

**Scenarios Handled:**
- Suggestion was accepted/rejected (no longer in pendingSuggestions)
- Suggestion was in different document (document changed)
- Suggestion was deleted (user edited it away)

### Benefits of Single Suggestion Constraint

1. **No Conflicts**: Only one suggestion tracked, no ambiguity
2. **Simpler State**: One entry per document, easy to reason about
3. **Predictable**: First match wins, consistent behavior
4. **Efficient**: Early return, no unnecessary checks
5. **Clean Cleanup**: One timer per document, easy to manage

### Alternative Approaches (Not Used)

#### Option 1: Track All Overlapping Suggestions
```javascript
// ❌ Not used: Too complex
activeReviewSuggestion.set(uri, {
    suggestionIds: ["A", "B"],  // Multiple suggestions
    timers: [timerA, timerB]    // Multiple timers
});
```
**Problems:**
- Complex state management
- Multiple timers to clean up
- Ambiguity: Which suggestion is primary?

#### Option 2: Priority-Based Selection
```javascript
// ❌ Not used: Unnecessary complexity
// Select suggestion with highest priority/confidence
const bestSuggestion = suggestions
    .filter(s => isPositionInRange(position, s.range))
    .sort((a, b) => b.confidence - a.confidence)[0];
```
**Problems:**
- More complex logic
- Requires priority system
- Overkill for current needs

#### Option 3: User Selection
```javascript
// ❌ Not used: Requires UI
// Let user choose which suggestion to review
showQuickPick(suggestions, "Which suggestion to review?");
```
**Problems:**
- Requires UI interaction
- Interrupts workflow
- Not automatic

**Current Approach (First Match) is Best Because:**
- Simple and predictable
- No UI required
- Good enough for 99% of cases
- Easy to understand and maintain

---

## Summary

The `activeReviewSuggestion` Map is a sophisticated state management mechanism that:

1. **Tracks per-document**: One suggestion per document, independent tracking
2. **Implements dwell time**: 1000ms requirement prevents false positives
3. **Manages timers**: Proper cleanup prevents memory leaks
4. **Separates concerns**: Input layer state vs domain entities
5. **Enforces constraint**: Only one suggestion tracked at a time

This design provides a clean, maintainable, and efficient solution for tracking suggestion reviews in a VS Code extension.
