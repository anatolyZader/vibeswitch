# Event Listener vs Controller: Architectural Rationale

## Overview

The `AwarenessEventListener` and `AwarenessController` serve distinct roles in a layered architecture. While they may seem redundant at first glance, they provide critical separation of concerns that improves maintainability, testability, and flexibility.

## Main Reasons for Both Components

### 1. **Separation of Event Binding from Business Logic**

**Event Listener** = **Event Binding Layer**
- Binds directly to VS Code event APIs (`workspace.onDidChangeTextDocument`, `window.onDidChangeActiveTextEditor`, etc.)
- Handles VS Code-specific event structures and types
- Manages event subscription lifecycle (register/dispose)
- Acts as a **thin bridge** between external events and internal orchestration

**Controller** = **Orchestration Layer**
- Receives normalized method calls (not raw VS Code events)
- Handles validation, logging, and business logic coordination
- Can work with any event source (not just VS Code)
- Acts as the **orchestrator** between input and application layers

**Why this matters:**
- If you need to support multiple editors (VS Code, Cursor, etc.), you only need to create new event listeners
- The controller remains unchanged, maintaining business logic consistency
- Event binding is a separate concern from business orchestration

### 2. **Input-Layer State Management**

**Event Listener** maintains **ephemeral input-layer state**:
- `activeReviewSuggestion` Map: Tracks which suggestion is being reviewed per document (input-layer concern)
- `saveCache` Map: Prevents duplicate processing of file saves (input-layer optimization)
- `previousActiveDocumentUri`: Tracks editor switches for flushing (input-layer concern)
- Dwell timers: Manages review timing (input-layer UX concern)

**Controller** maintains **no state** (stateless orchestrator):
- Only validates, logs, and delegates
- All persistent state lives in services/domain layer

**Why this matters:**
- Input-layer state is temporary and tied to the event lifecycle
- Domain state (suggestions, debt) lives in the domain layer
- Clear separation prevents state leakage between layers

### 3. **Testability and Dependency Isolation**

**Event Listener** dependencies:
- Only depends on `AwarenessController` (single dependency)
- No direct dependencies on services, ports, or domain utilities
- Can be tested with a mock controller

**Controller** dependencies:
- Depends on `AwarenessService` and optional logger
- Can be tested with mock services
- No direct dependencies on VS Code APIs

**Why this matters:**
- Event listener tests don't need to mock complex service hierarchies
- Controller tests don't need to mock VS Code event structures
- Each component can be tested in isolation

### 4. **Single Responsibility Principle**

**Event Listener** responsibility:
- **"Receive VS Code events and delegate to controller"**
- That's it. No validation, no logging, no business logic.

**Controller** responsibility:
- **"Orchestrate business workflows by validating, logging, and delegating to services"**
- Handles cross-cutting concerns (validation, logging, error handling)

**Why this matters:**
- Each component has one clear reason to change
- Event listener changes only when VS Code event structure changes
- Controller changes only when business workflow changes

### 5. **Flexibility for Different Event Sources**

**Current Architecture:**
```
VS Code Events → Event Listener → Controller → Service
```

**Future Architecture (multi-editor support):**
```
VS Code Events → VS Code Event Listener → Controller → Service
Cursor Events  → Cursor Event Listener  → Controller → Service
CLI Events     → CLI Event Listener     → Controller → Service
```

**Why this matters:**
- Controller remains unchanged when adding new event sources
- Business logic stays consistent across different input mechanisms
- Event listeners are swappable adapters

### 6. **Error Handling Boundaries**

**Event Listener**:
- Catches and handles event binding errors
- Prevents event errors from crashing the extension
- Minimal error handling (just prevents crashes)

**Controller**:
- Handles business logic errors
- Provides structured error logging
- Throws errors for composition root to handle (UI layer)

**Why this matters:**
- Event binding errors don't propagate to business logic
- Business logic errors are properly logged and handled
- Clear error boundaries improve debugging

## Correct Division of Responsibilities

### AwarenessEventListener Responsibilities

✅ **DO:**
- Bind to VS Code event APIs
- Extract basic event data (URI, position, document)
- Maintain input-layer state (review tracking, caches, timers)
- Delegate to controller methods
- Manage event subscription lifecycle
- Handle timer cleanup (prevent memory leaks)

❌ **DON'T:**
- Validate documents or URIs (delegate to controller)
- Log events (delegate to controller)
- Call service methods directly
- Import domain utilities
- Import ports/adapters
- Contain business logic

**Example (Correct):**
```javascript
onTextChange(event) {
    if (event.contentChanges.length === 0) return;
    // Simple delegation - no validation, no logging, no business logic
    this.controller.classifyTextChange(event);
}
```

### AwarenessController Responsibilities

✅ **DO:**
- Validate input (documents, URIs)
- Log events and errors
- Orchestrate business workflows
- Delegate to service methods
- Provide helper functions to event listener when needed
- Handle cross-cutting concerns (validation, logging, error handling)

❌ **DON'T:**
- Bind to VS Code event APIs directly
- Maintain input-layer state (timers, caches)
- Contain business logic implementation
- Import VS Code APIs directly (use adapters)

**Example (Correct):**
```javascript
classifyTextChange(event) {
    try {
        // Validation (controller responsibility)
        if (!this.awarenessService.isValidCodeDocument(event.document)) {
            return;
        }
        
        // Logging (controller responsibility)
        this.log(`AwarenessMonitor: Text change detected...`, `onTextChange:${uri}`);
        
        // Orchestration (controller responsibility)
        this.awarenessService.classifyTextChange(event, (document, classification, changes) => {
            this.awarenessService.handleClassifiedChanges(document, classification, changes);
        });
    } catch (error) {
        this.logger?.error('AwarenessController.classifyTextChange failed', error);
        throw error;
    }
}
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    VS Code Extension                         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              INPUT LAYER (Event Binding)                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │     AwarenessEventListener                          │   │
│  │  • Binds to VS Code events                          │   │
│  │  • Maintains input-layer state (review, cache)      │   │
│  │  • Manages timers and cleanup                       │   │
│  │  • Delegates to controller                          │   │
│  └──────────────────┬───────────────────────────────────┘   │
└─────────────────────┼───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              INPUT LAYER (Orchestration)                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │     AwarenessController                              │   │
│  │  • Validates input                                   │   │
│  │  • Logs events and errors                           │   │
│  │  • Orchestrates workflows                           │   │
│  │  • Delegates to services                            │   │
│  └──────────────────┬───────────────────────────────────┘   │
└─────────────────────┼───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              APPLICATION LAYER                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │     AwarenessService                                 │   │
│  │  • Business logic implementation                    │   │
│  │  • Coordinates domain entities                      │   │
│  │  • Uses adapters (ports)                            │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## When to Merge vs. Keep Separate

### Keep Separate When:
- ✅ You need to support multiple event sources (VS Code, Cursor, CLI)
- ✅ Event binding logic is complex (subscriptions, cleanup, state management)
- ✅ Input-layer state needs to be isolated from business logic
- ✅ You want maximum testability and flexibility

### Consider Merging When:
- ❌ Event binding is trivial (single event, no state, no cleanup)
- ❌ You'll never support multiple event sources
- ❌ The overhead of two files outweighs the benefits
- ❌ Event listener is just a pass-through with no logic

## Current Implementation Assessment

**Your current implementation is correct:**

1. ✅ **Event Listener** is a thin bridge:
   - Only calls controller methods
   - Maintains input-layer state (review tracking, caches)
   - No validation, logging, or business logic

2. ✅ **Controller** orchestrates workflows:
   - Validates input
   - Logs events
   - Delegates to services
   - Provides helper functions when needed

3. ✅ **Clear separation**:
   - Event listener doesn't import services, ports, or domain utilities
   - Controller doesn't bind to VS Code events directly
   - Each component has a single, clear responsibility

## Summary

**Event Listener** = **Event Binding + Input-Layer State**
- Receives VS Code events
- Maintains ephemeral state (review tracking, caches, timers)
- Delegates to controller

**Controller** = **Orchestration + Cross-Cutting Concerns**
- Validates input
- Logs events
- Orchestrates business workflows
- Delegates to services

**Together**, they provide:
- Clear separation of concerns
- Maximum testability
- Flexibility for multiple event sources
- Proper state management boundaries
- Single responsibility per component

This architecture follows the **Ports and Adapters (Hexagonal Architecture)** pattern, where the event listener is an **inbound adapter** that translates external events into internal method calls, and the controller is the **application boundary** that orchestrates business workflows.
