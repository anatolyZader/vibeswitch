# Visibility of Proposed Changes (Before Approval)

## Current Situation

### ❌ The Extension **CANNOT** See Proposed Changes

**Current behavior:**
- The extension only sees changes **AFTER** they're applied to the document
- `onDidChangeTextDocument` fires **only when changes are actually written** to the document
- Proposed/diff changes shown in Cursor's UI are **not accessible** via standard VS Code API

### What the Extension Currently Sees

```javascript
// This only fires when changes are APPLIED, not when they're PROPOSED
vscode.workspace.onDidChangeTextDocument((event) => {
    // event.document.getText() = current document content (with changes applied)
    // event.contentChanges = the changes that were just applied
    // 
    // ❌ Cannot see what was PROPOSED before approval
    // ❌ Cannot see diff/preview content
});
```

---

## Why This Is a Limitation

### The Problem

1. **Cursor shows proposed changes** in a diff view or inline preview
2. **User reviews** the proposed changes
3. **User clicks "Accept" or "Keep All"**
4. **Only then** does `onDidChangeTextDocument` fire
5. **Extension sees the change** - but it's already applied!

### Impact on Awareness Tracking

- ✅ Can detect **after** changes are accepted
- ❌ Cannot detect **while** changes are being reviewed
- ❌ Cannot track **review time** for proposed changes
- ❌ Cannot show **pending changes** in awareness meter

---

## What VS Code API Provides

### 1. Diff Editor API

VS Code has a `DiffEditor` API, but it's for **comparing two documents**, not for accessing proposed changes:

```javascript
// This is for comparing two existing documents
const diffEditor = await vscode.window.createDiffEditor();
await diffEditor.setModel({
    original: originalDoc,
    modified: modifiedDoc
});
```

**Limitation:** This requires you to **create** the diff editor yourself. Cursor's internal diff views are not accessible.

### 2. Text Document Events

```javascript
// These only fire for ACTUAL document changes
vscode.workspace.onDidChangeTextDocument()  // ✅ Fires when applied
vscode.workspace.onDidOpenTextDocument()    // ✅ Fires when file opened
vscode.workspace.onDidSaveTextDocument()    // ✅ Fires when saved
```

**No event for:** Proposed changes, diff previews, pending edits.

### 3. Editor API

```javascript
// Can see current editor state
const editor = vscode.window.activeTextEditor;
const document = editor.document;
const text = document.getText(); // Current content only

// Cannot access:
// - Proposed changes
// - Diff preview content
// - Pending edits
```

---

## Cursor-Specific Behavior

### How Cursor Shows Proposed Changes

Cursor likely uses one of these mechanisms:

1. **Inline diff decorations** - Visual overlays (not accessible via API)
2. **Separate diff editor** - Internal, not exposed
3. **WebView/UI components** - Custom UI (not accessible)
4. **Temporary document** - Might create a temporary document for preview

### Potential Workaround: Check for Temporary Documents

Some editors create temporary documents for previews. We could try:

```javascript
vscode.workspace.onDidOpenTextDocument((document) => {
    const uri = document.uri;
    
    // Check for temporary/preview documents
    if (uri.scheme === 'file') {
        const path = uri.fsPath;
        
        // Cursor might create temporary files for previews
        // Pattern: .cursor-preview-*.js or similar
        if (path.includes('.cursor-preview') || 
            path.includes('.cursor-diff') ||
            path.includes('~')) {
            console.log('Possible preview document detected:', path);
            // This might be a proposed change preview
        }
    }
});
```

**However:** This is speculative and may not work, as Cursor's implementation is unknown.

---

## What We CAN Track (Current Implementation)

### ✅ After Changes Are Applied

```javascript
// 1. Change is applied to document
onDidChangeTextDocument() fires
  ↓
// 2. Extension detects AI-like change
recordAISuggestion() called
  ↓
// 3. Suggestion marked as 'pending'
status: 'pending'
  ↓
// 4. After 5 seconds, check if still exists
checkSuggestionStatus() called
  ↓
// 5. Determine if accepted/rejected/adapted
status: 'accepted' | 'rejected' | 'adapted'
```

### ✅ Review Time (After Acceptance)

```javascript
// Track cursor movements over accepted code
onCursorMove() {
    if (cursor is on suggestion) {
        suggestion.reviewed = true;
        suggestion.reviewStarted = Date.now();
    }
}

// Calculate review time
suggestion.reviewTime = accumulated time cursor spent on code
```

**But:** This only works **after** the code is applied, not during the proposal phase.

---

## Potential Solutions

### Option 1: Monitor File System (Not Recommended)

```javascript
// Watch for temporary files Cursor might create
const watcher = vscode.workspace.createFileSystemWatcher('**/.cursor-*');
watcher.onDidCreate((uri) => {
    // Might be a preview file
});
```

**Problems:**
- Cursor might not create temporary files
- Hard to distinguish from other temp files
- Platform-specific behavior

### Option 2: Monitor Editor Decorations (Not Possible)

```javascript
// VS Code doesn't expose decoration content via API
// Decorations are visual only, not accessible
```

### Option 3: Request Cursor API (Best Long-term)

**Request from Cursor team:**
- Expose proposed changes via extension API
- Provide event: `onDidProposeChanges`
- Allow extensions to access diff preview content

### Option 4: Accept Current Limitation (Pragmatic)

**Current approach is actually reasonable:**
- Track changes **after** they're applied
- Measure review time **after** acceptance
- Detect "Keep All" via pattern matching
- This gives us **good enough** awareness metrics

---

## Current Implementation Analysis

### What We Track

```javascript
// In awareness-monitor.js

// 1. When change is APPLIED
onTextChange(event) {
    // event.document = document with changes already applied
    // event.contentChanges = the changes that were just written
    // 
    // We can see:
    // - What was inserted (change.text)
    // - Where it was inserted (change.range)
    // - What was replaced (change.rangeLength)
    
    // We CANNOT see:
    // - What was proposed before approval
    // - The diff preview
    // - Pending changes
}

// 2. Track as "pending" suggestion
recordAISuggestion(document, change) {
    // Create suggestion object
    // Mark as 'pending'
    // Wait 5 seconds, then check status
}

// 3. Check if still exists (determine acceptance)
checkSuggestionStatus(suggestionId) {
    // Open document
    // Check if code at range still exists
    // If exists and unchanged → 'accepted'
    // If modified → 'adapted'
    // If deleted → 'rejected'
}
```

### The Gap

**Missing:** Visibility into the **proposal phase**:
- When changes are first shown to user
- How long user reviews before accepting
- What the user sees in the diff preview

**We only see:** The **result** after approval/rejection.

---

## Conclusion

### Current Reality

**The extension sees:**
- ✅ Changes **after** they're applied
- ✅ The final result (accepted/rejected/adapted)
- ✅ Review time **after** acceptance (cursor movements)

**The extension does NOT see:**
- ❌ Proposed changes before approval
- ❌ Diff preview content
- ❌ Pending edits in Cursor's UI
- ❌ Review time during proposal phase

### Why This Is Acceptable

1. **Pattern detection works:** We can detect "Keep All" via rapid acceptances
2. **Post-acceptance review tracking:** We track cursor movements after code is applied
3. **Status determination:** We can determine if code was accepted/rejected/adapted
4. **Good enough metrics:** This provides meaningful awareness data

### Future Improvements

If Cursor exposes proposed changes via API, we could:
- Track review time during proposal phase
- Show pending changes in awareness meter
- Provide more accurate awareness scores
- Detect when user reviews proposals without accepting

But for now, **the current approach is the best we can do** with available VS Code APIs.


