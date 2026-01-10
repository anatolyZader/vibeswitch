# Change Classification Refactoring Analysis

## Current Issues

### 1. **Classification Logic in Input Layer**
- `AwarenessEventListener` (input layer) directly uses `ChangeClassifier` (domain utility)
- Input layer is orchestrating business logic (classification workflow)
- Classification configuration is in input layer (`_getClassifierConfig()`)
- This violates separation of concerns - input layer should only translate events

### 2. **No Domain Entity for Changes**
- Changes are just raw VS Code `TextDocumentContentChangeEvent` objects
- No domain representation with identity and lifecycle
- No encapsulation of change metadata (classification, timestamps, etc.)
- Hard to test and reason about changes independently

## Proposed Solution

### 1. **Create `Change` Domain Entity**
```javascript
class Change {
    constructor(id, documentUri, range, text, rangeLength, timestamp, options = {}) {
        this.id = id; // Unique identifier
        this.documentUri = documentUri; // URI string
        this.range = range; // Range object
        this.text = text; // Inserted text
        this.rangeLength = rangeLength; // Deleted length
        this.timestamp = timestamp; // When change occurred
        this.size = text.length; // Inserted size
        this.deletedSize = rangeLength; // Deleted size
        
        // Classification state
        this.classification = null; // {label, confidence, reasons}
        this.classifiedAt = null;
        
        // Metadata
        this.source = options.source || 'unknown'; // 'ai', 'user', 'formatter', 'unknown'
        this.batchId = options.batchId || null;
    }
    
    classify(classification) {
        this.classification = classification;
        this.classifiedAt = Date.now();
        this.source = classification.label;
    }
    
    isClassified() { return !!this.classification; }
    isAI() { return this.classification?.label === 'ai'; }
    isUser() { return this.classification?.label === 'user'; }
    isFormatter() { return this.classification?.label === 'formatter'; }
}
```

### 2. **Create `ChangeClassificationService` (App Layer)**
```javascript
class ChangeClassificationService {
    constructor(changeClassifier, loggerPort = null) {
        this.changeClassifier = changeClassifier;
        this.loggerPort = loggerPort;
    }
    
    /**
     * Classify text document change event
     * @param {vscode.TextDocumentChangeEvent} event - VS Code event
     * @param {Function} onClassified - Callback (document, classification, changes[])
     */
    classifyEvent(event, onClassified) {
        this.changeClassifier.addEvent(event, (document, classification, rawChanges) => {
            // Convert raw changes to Change entities
            const changes = rawChanges.map(c => new Change(...));
            
            // Classify each change
            changes.forEach(change => change.classify(classification));
            
            // Call callback with domain entities
            onClassified(document, classification, changes);
        });
    }
    
    flush(document, options = {}) {
        this.changeClassifier.flush(document, options);
    }
    
    flushAll(onClassified) {
        this.changeClassifier.flushAll((document, classification, rawChanges) => {
            const changes = rawChanges.map(c => new Change(...));
            changes.forEach(change => change.classify(classification));
            onClassified(document, classification, changes);
        });
    }
}
```

### 3. **Refactor `AwarenessEventListener` (Input Layer)**
- Remove `ChangeClassifier` instantiation
- Remove `_getClassifierConfig()` method
- Simply delegate to controller: `this.controller.classifyTextChange(event)`
- Input layer becomes truly "thin" - just event translation

### 4. **Update `AwarenessController`**
- Add `classifyTextChange(event)` method
- Delegates to `AwarenessService.classifyTextChange(event)`

### 5. **Update `AwarenessService`**
- Create `ChangeClassificationService` in `start()`
- Add `classifyTextChange(event)` method that uses the service
- Move classification configuration to service/service creation

## Benefits

1. **Proper Layer Separation**
   - Input layer: Only translates VS Code events → controller calls
   - App layer: Orchestrates classification workflow
   - Domain layer: Change entity with business logic

2. **Testability**
   - Can test classification independently
   - Can test Change entity behavior
   - Can mock classification service easily

3. **Maintainability**
   - Classification logic centralized in app layer
   - Configuration in one place
   - Clear responsibilities

4. **Domain Model**
   - Changes are first-class domain entities
   - Encapsulate change behavior and state
   - Easier to reason about and extend

## Architecture Flow

```
VS Code Event
    ↓
AwarenessEventListener (input) - just translates
    ↓
AwarenessController (input) - delegates
    ↓
AwarenessService (app) - orchestrates
    ↓
ChangeClassificationService (app) - classification workflow
    ↓
ChangeClassifier (domain utility) - classification algorithm
    ↓
Change entities (domain) - classified changes
    ↓
Other services (SuggestionService, etc.)
```

## Implementation Steps

1. Create `Change` domain entity
2. Create `ChangeClassificationService` in app layer
3. Move classification config from input to app layer
4. Refactor `AwarenessEventListener` to delegate
5. Update `AwarenessController` and `AwarenessService`
6. Update tests
