# Cursor Position Treatment Through the Workflow

## Overview

Cursor position is treated differently across the awareness module depending on the use case:
1. **Shared mutable reference** - For real-time access to current cursor position
2. **Event parameter** - For processing cursor movement events
3. **Position validation** - For checking if cursor is within suggestion ranges

---

## Architecture Flow

```
VS Code Event (onDidChangeTextEditorSelection)
    ↓
AwarenessEventListener (input layer)
    ├─> Updates shared reference: cursorPosition.value = position
    ├─> Uses position for suggestion review tracking
    └─> Delegates to controller: handleCursorMove(uri, position)
    ↓
AwarenessController (input layer)
    └─> Delegates to service: handleCursorMove(uri, position)
    ↓
AwarenessService (app layer)
    └─> Delegates to SessionService: updateCursorActivity(uri)
    ↓
SessionService (app layer)
    └─> Updates ReviewSession: recordCursorMovement()
    ↓
ReviewSession (domain entity)
    └─> Increments cursorMovements counter
```

---

## File-by-File Treatment

### 1. **AwarenessService** (`app/awarenessService.js`)

**Role**: Creates and manages the shared cursor position reference

**Treatment**:
```javascript
// Line 99: Creates mutable reference object
this.cursorPosition = { value: null };

// Line 238: Passes reference to event listener
this.eventHandlers = new AwarenessEventListener(
    controller,
    this.activeDocument,
    this.cursorPosition,  // ← Shared mutable reference
    {}
);
```

**Purpose**:
- Creates a **shared mutable reference** that can be updated by the event listener
- Allows other parts of the system to access the current cursor position in real-time
- Uses object wrapper (`{ value: null }`) to enable mutation across component boundaries

**Why this pattern?**
- JavaScript primitives are passed by value, so a simple variable wouldn't work
- Object reference allows mutation from event listener while maintaining access in service
- Enables reactive access to current cursor position without polling

---

### 2. **AwarenessEventListener** (`input/awarenessEventListener.js`)

**Role**: Receives cursor events, updates shared reference, and tracks suggestion reviews

**Treatment**:
```javascript
// Line 19: Receives cursor position reference in constructor
constructor(controller, activeDocument, cursorPosition, options = {}) {
    this.cursorPosition = cursorPosition;  // ← Stores reference
}

// Line 342-353: onCursorMove event handler
onCursorMove(event) {
    const position = event.selections[0].active;
    const uri = editor.document.uri.toString();
    
    // Update shared reference (for real-time access)
    if (this.cursorPosition) {
        this.cursorPosition.value = position;  // ← Mutates shared object
    }
    
    // Pass position as parameter to controller (for event processing)
    this.controller.handleCursorMove(uri, position);  // ← Passed as parameter
    
    // Use position for suggestion review tracking (local use)
    const pendingSuggestions = this.controller.getSuggestionsByStatus('pending');
    // ... check if position is within suggestion ranges
    if (this.controller.isPositionInRange(position, suggestion.range)) {
        // Track review state
    }
}
```

**Three Different Uses**:

1. **Shared Reference Update** (Line 351-352):
   - Updates `cursorPosition.value` for real-time access
   - Other components can read current position via `cursorPosition.value`
   - **Purpose**: Enable reactive access to current cursor position

2. **Event Parameter** (Line 356):
   - Passes `position` as parameter to `handleCursorMove(uri, position)`
   - **Purpose**: Process cursor movement event for review session tracking

3. **Position Validation** (Line 367, 385):
   - Uses `position` to check if cursor is within suggestion ranges
   - Calls `this.controller.isPositionInRange(position, suggestion.range)`
   - **Purpose**: Determine if user is reviewing a specific AI suggestion

**Key Behaviors**:
- **Dual responsibility**: Updates shared state AND processes events
- **Suggestion tracking**: Manages `activeReviewSuggestion` Map to track which suggestion cursor is in
- **Dwell time**: Requires 1000ms dwell time before marking suggestion as reviewed
- **Single suggestion tracking**: Only tracks one suggestion at a time per document

---

### 3. **AwarenessController** (`input/awarenessController.js`)

**Role**: Thin bridge that delegates cursor events to service

**Treatment**:
```javascript
// Line 187-194: Delegates cursor move to service
handleCursorMove(uri, position) {
    try {
        this.awarenessService.handleCursorMove(uri, position);
    } catch (error) {
        this.logger?.error('AwarenessController.handleCursorMove failed', error);
        throw error;
    }
}

// Line 359-365: Provides position validation (delegates to service)
isPositionInRange(position, range) {
    try {
        return this.awarenessService.isPositionInRange(position, range);
    } catch (error) {
        this.logger?.error('AwarenessController.isPositionInRange failed', error);
        return false;
    }
}
```

**Purpose**:
- **Thin delegation**: No business logic, just error handling
- **Position validation**: Provides `isPositionInRange()` for event listener to check if cursor is in suggestion range
- **Error handling**: Catches and logs errors, re-throws for composition root

---

### 4. **AwarenessService** (`app/awarenessService.js`) - Cursor Event Handling

**Role**: Orchestrates cursor movement processing

**Treatment**:
```javascript
// Line 741-746: Handles cursor move event
handleCursorMove(uri, position) {
    // Update review tracking if this file has debt
    if (this.sessionTracker) {
        this.sessionTracker.updateCursorActivity(uri);
    }
}
```

**Key Points**:
- **No position parameter used**: Only passes `uri` to `SessionService`
- **Why?**: `SessionService` only needs to know that cursor moved, not the exact position
- **Position is not needed**: Review session tracking counts movements, not positions

**Note**: The `position` parameter is accepted but not used. This is intentional - the service only needs to know that cursor activity occurred, not the exact position.

---

### 5. **SessionService** (`app/sessionService.js`)

**Role**: Manages review sessions and tracks cursor activity

**Treatment**:
```javascript
// Line 76-83: Updates cursor activity for review session
updateCursorActivity(filePathOrUri) {
    const uri = normalizeToUri(filePathOrUri);
    if (!uri) return;
    const session = this.sessions.get(uri);
    if (session) {
        session.recordCursorMovement();  // ← Only increments counter
    }
}
```

**Key Points**:
- **No position needed**: Only needs to know cursor moved, not where
- **Increments counter**: Calls `session.recordCursorMovement()` which increments `cursorMovements`
- **Purpose**: Track engagement metrics (how many times cursor moved during review)

---

### 6. **ReviewSession** (`domain/entities/reviewSession.js`)

**Role**: Domain entity representing a review session

**Treatment**:
```javascript
// Line 19: Tracks cursor movements as a counter
this.cursorMovements = 0;

// Line 29-33: Records cursor movement (increments counter)
recordCursorMovement() {
    if (!this.isActive) return;
    this.cursorMovements++;  // ← Just increments, no position stored
    this.lastActivity = Date.now();
}

// Line 53-57: Uses cursor movements for engagement validation
hasSufficientEngagement(minimumReviewTime = 30000, minimumMovements = 5, minimumScrolls = 3) {
    const duration = Date.now() - this.sessionStart;
    return duration >= minimumReviewTime && 
           (this.cursorMovements >= minimumMovements || this.scrollEvents >= minimumScrolls);
}
```

**Key Points**:
- **Counter, not position**: Tracks number of movements, not positions
- **Engagement metric**: Used to determine if user is actively reviewing
- **Domain logic**: Encapsulates business rules for sufficient engagement

---

## Summary of Treatment Patterns

### Pattern 1: Shared Mutable Reference
**Files**: `AwarenessService`, `AwarenessEventListener`
**Purpose**: Real-time access to current cursor position
**Implementation**: `{ value: null }` object passed by reference
**Use Case**: When other components need to read current cursor position

### Pattern 2: Event Parameter
**Files**: `AwarenessEventListener` → `AwarenessController` → `AwarenessService` → `SessionService`
**Purpose**: Process cursor movement events
**Implementation**: Position passed as parameter through call chain
**Use Case**: Track cursor activity for review sessions

### Pattern 3: Position Validation
**Files**: `AwarenessEventListener` → `AwarenessController` → `AwarenessService`
**Purpose**: Check if cursor is within suggestion ranges
**Implementation**: `isPositionInRange(position, range)` method
**Use Case**: Determine if user is reviewing a specific AI suggestion

### Pattern 4: Counter Tracking
**Files**: `SessionService` → `ReviewSession`
**Purpose**: Track engagement metrics
**Implementation**: Increment counter, don't store position
**Use Case**: Determine if user has sufficient engagement during review

---

## Key Design Decisions

### 1. **Why Shared Reference?**
- Enables reactive access to current cursor position
- Avoids polling or event subscription overhead
- Simple pattern for cross-component state sharing

### 2. **Why Position Not Used in SessionService?**
- Review session tracking only needs to know "cursor moved"
- Exact position is not relevant for engagement metrics
- Simpler API and less data to track

### 3. **Why Position Validation in Event Listener?**
- Event listener is closest to VS Code events
- Needs to check position immediately when cursor moves
- Determines which suggestion is being reviewed in real-time

### 4. **Why Dwell Time?**
- Prevents accidental "reviewed" marks from quick cursor touches
- Requires 1000ms of cursor being in suggestion range
- Improves accuracy of review tracking

### 5. **Why Single Suggestion Tracking?**
- User can only review one suggestion at a time
- Simplifies state management
- Prevents conflicts when cursor is near multiple suggestions

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ VS Code: onDidChangeTextEditorSelection                     │
│ Event: { textEditor, selections: [{ active: Position }] }  │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ AwarenessEventListener.onCursorMove(event)                  │
│                                                              │
│ 1. Extract: position = event.selections[0].active            │
│ 2. Update: cursorPosition.value = position  (shared ref)   │
│ 3. Delegate: controller.handleCursorMove(uri, position)     │
│ 4. Validate: isPositionInRange(position, suggestion.range)   │
│ 5. Track: activeReviewSuggestion Map                       │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
        ▼                               ▼
┌───────────────────┐         ┌──────────────────────┐
│ Controller        │         │ Event Listener      │
│ handleCursorMove  │         │ (suggestion review) │
│ (delegates)       │         │ (dwell timer)       │
└─────────┬─────────┘         └──────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│ AwarenessService.handleCursorMove(uri, position)            │
│                                                              │
│ Note: position parameter not used, only uri                │
│ Calls: sessionTracker.updateCursorActivity(uri)             │
└─────────┬───────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│ SessionService.updateCursorActivity(uri)                    │
│                                                              │
│ Gets: session = this.sessions.get(uri)                     │
│ Calls: session.recordCursorMovement()                       │
└─────────┬───────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│ ReviewSession.recordCursorMovement()                        │
│                                                              │
│ Increments: this.cursorMovements++                         │
│ Updates: this.lastActivity = Date.now()                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Conclusion

Cursor position is treated in **four distinct ways** across the workflow:

1. **Shared mutable reference** - For real-time access (AwarenessService → AwarenessEventListener)
2. **Event parameter** - For processing events (Event → Controller → Service → SessionService)
3. **Position validation** - For suggestion review tracking (Event Listener → Controller → Service)
4. **Counter tracking** - For engagement metrics (SessionService → ReviewSession)

Each pattern serves a specific purpose and is appropriate for its use case. The design maintains clear separation of concerns while enabling efficient cursor position tracking and review session management.
