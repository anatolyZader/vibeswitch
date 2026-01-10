# ActiveDocument Usage Analysis

## Summary

`activeDocument` is **dead code** - it's written to but never read. It should be **removed** from `AwarenessEventListener` for the same reasons as `cursorPosition`.

---

## Current Usage

### 1. **AwarenessService** (`app/awarenessService.js`)

**Line 98**: Creates shared mutable reference
```javascript
this.activeDocument = { value: null };
```

**Line 236**: Passes to event listener
```javascript
this.eventHandlers = new AwarenessEventListener(
    controller,
    this.activeDocument,  // ← Shared mutable reference
    {}
);
```

### 2. **AwarenessEventListener** (`input/awarenessEventListener.js`)

**Line 18**: Receives in constructor
```javascript
constructor(controller, activeDocument, options = {}) {
    this.activeDocument = activeDocument;
}
```

**Line 447-449**: Only writes to it (never reads)
```javascript
// Update active document reference
if (this.activeDocument) {
    this.activeDocument.value = editor?.document;  // ← Only write, never read
}
```

---

## Analysis

### ✅ What's Actually Used

The event listener already tracks the active document in a **better way**:

1. **`previousActiveDocumentUri`** (Line 42, 452):
   - Tracks URI string (not document object)
   - Used for flushing previous document on editor change
   - More efficient (just a string, not full document object)

2. **Event parameter** (`editor?.document`):
   - Document is already available from the event
   - Used directly when needed (e.g., `onFileOpened(editor.document)`)
   - No need to store in shared reference

### ❌ What's NOT Used

- `activeDocument.value` is **never read** anywhere in the codebase
- No component accesses it after it's set
- It's just dead code taking up space

---

## Why Remove It?

### 1. **Dead Code**
- Written but never read
- Serves no purpose
- Adds unnecessary complexity

### 2. **Better Isolation**
- Input layer shouldn't maintain shared mutable state with app layer
- Document is already available from events
- No need for shared reference pattern

### 3. **Simpler Architecture**
- Less state to manage
- Clearer data flow (document comes from event)
- Easier to understand and maintain

### 4. **Already Tracked Better**
- `previousActiveDocumentUri` is more efficient (string vs object)
- Document available from event when needed
- No need for reactive access pattern

---

## Comparison with `cursorPosition`

| Aspect | `cursorPosition` | `activeDocument` |
|--------|------------------|-----------------|
| **Created in** | AwarenessService | AwarenessService |
| **Passed to** | EventListener | EventListener |
| **Written in** | `onCursorMove()` | `onEditorChange()` |
| **Read anywhere?** | ❌ No | ❌ No |
| **Status** | ✅ Removed | ❌ Should be removed |
| **Alternative** | Position from event | Document from event |

Both follow the same pattern and both are dead code.

---

## Recommended Action

**Remove `activeDocument`** from:
1. `AwarenessEventListener` constructor parameter
2. `AwarenessEventListener` property storage
3. Update code in `onEditorChange()`
4. `AwarenessService` creation and passing

The document is already available from the event (`editor?.document`), and `previousActiveDocumentUri` handles the flush logic more efficiently.

---

## After Removal

The event listener will:
- Still track `previousActiveDocumentUri` for flush logic ✅
- Still get document from event when needed ✅
- Have no shared mutable state with app layer ✅
- Be more isolated and focused ✅
