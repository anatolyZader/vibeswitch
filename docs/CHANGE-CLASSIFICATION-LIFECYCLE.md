# Change Classification Lifecycle: Agent vs Manual vs Linter

## Overview

This document outlines the complete lifecycle of distinguishing agent-made changes from manual changes, linter/formatter changes, and other sources. The system uses a **two-tier detection strategy**:

1. **PRIMARY**: Behavioral inference via heuristics (edit patterns, batch characteristics, temporal patterns)
2. **SECONDARY**: `@ai` marker detection (strong signal when present, but cannot be relied upon)

---

## 🎯 Complete Lifecycle Flow

```
VS Code Text Change Event
    ↓
awarenessMonitor.js (Event Listener Registration)
    ↓
eventHandlers.js → onTextChange()
    ↓
changeClassifier.js → addEvent() (Debounced Aggregation)
    ↓
changeAggregator.js (Accumulates changes within debounce window)
    ↓
[Debounce Timer Expires]
    ↓
changeClassifier.js → _classifyAndEmit()
    ↓
changeClassifier.js → _classify()
    ├─→ markerDetector.js → hasAIMarker() [Early Exit if Found]
    └─→ changeAnalyzer.js → calculateMetrics()
        ↓
    [Detector Pipeline - Parallel Execution]
    ├─→ formatterDetector.js
    ├─→ rapidScatteredDetector.js
    ├─→ largeInsertionDetector.js
    ├─→ multiLineDetector.js
    ├─→ pureInsertionDetector.js
    ├─→ scatteredEditsDetector.js
    └─→ smallEditsDetector.js
        ↓
    classificationScorer.js → accumulateScores() + determineLabel()
        ↓
    versionDriftHandler.js → applyDriftCap() [Version Drift Check]
        ↓
    reasonFilter.js → filterReasons() [Filter by Label]
        ↓
    [Classification Result]
    {label: 'ai'|'user'|'formatter'|'unknown', confidence: 0..1, reasons: string[]}
        ↓
    eventHandlers.js → Classification Callback
    ├─→ agentSuggestionHandler.js (if AI)
    ├─→ [No Action] (if Formatter - neutral)
    └─→ agentSuggestionHandler.js (if User)
```

---

## 📁 Files Involved (in execution order)

### 1. **awarenessMonitor.js** (Boundary Layer)
**Location:** `awarenessMonitor/awarenessMonitor.js`  
**Role:** Main orchestrator, registers VS Code event listeners

**Key Responsibilities:**
- Registers `vscode.workspace.onDidChangeTextDocument()` event listener
- Wraps handlers in `safe()` utility for error handling
- Routes events to `EventHandlers.onTextChange()`
- Manages lifecycle (start/stop) of all monitoring modules

**Key Code:**
```javascript
// Lines 350-354
vscode.workspace.onDidChangeTextDocument((event) => {
    safe('onTextChange', () => this.eventHandlers.onTextChange(event));
})
```

**Integration Points:**
- Creates `EventHandlers` instance with mode-specific config
- Passes `changeLedger` for DIFF bullet tracking
- Manages disposal/cleanup on stop

---

### 2. **eventHandlers.js** (Event Routing Layer)
**Location:** `awarenessMonitor/eventHandlers.js`  
**Role:** Routes VS Code events to appropriate handlers, manages change classifier

**Key Responsibilities:**
- Receives `TextDocumentChangeEvent` from VS Code
- Filters out non-code documents (output channels, debug, etc.)
- Creates and manages `ChangeClassifier` instance
- Routes classification results to appropriate handlers

**Key Code:**
```javascript
// Lines 120-238
onTextChange(event) {
    // Filter non-code documents
    if (isNonCodeDocument(event.document)) return;
    
    // Process all changes through classifier (once per event)
    this.changeClassifier.addEvent(
        event,
        (document, classification, aggregatedChanges) => {
            // Classification callback - called once per debounce window
            const isAI = classification.label === 'ai';
            const isFormatter = classification.label === 'formatter';
            
            if (isAI) {
                this.agentSuggestionHandler.recordAISuggestionBatch(...);
            } else if (isFormatter) {
                // Formatters are neutral - do nothing
            } else if (classification.label === 'user') {
                this.agentSuggestionHandler.recordUserEditBatch(...);
            }
        }
    );
}
```

**Configuration:**
- Mode-specific classifier config (`vibe` vs `dev`)
- Different thresholds for different modes
- 200ms debounce window

**Integration Points:**
- Creates `ChangeClassifier` with mode-specific config
- Receives classification results via callback
- Routes to `agentSuggestionHandler` based on label
- Records to `changeLedger` for DIFF bullet tracking

---

### 3. **changeClassifier.js** (Core Classification Engine)
**Location:** `awarenessMonitor/changeClassifier.js`  
**Role:** Debounced aggregation and classification orchestration

**Key Responsibilities:**
- Aggregates rapid changes within debounce window (200ms default)
- Orchestrates classification pipeline
- Manages pending changes per document
- Applies version drift caps
- Emits classification results via callback

**Key Methods:**

#### `addEvent(event, onClassified)`
- Receives `TextDocumentChangeEvent` from event handlers
- Aggregates changes per document URI
- Stores callback once per document (prevents double recording)
- Sets debounce timer (200ms)

#### `_classifyAndEmit(uri)`
- Called when debounce timer expires
- Extracts aggregated changes
- Calls `_classify()` to get classification
- Applies version drift cap
- Emits result via stored callback

#### `_classify(changes, eventTimestamps, eventRangeSets, firstChangeTime)`
- **Early Exit**: Checks for `@ai` marker (100% confidence if found)
- **Marker-Only Mode**: Returns `unknown` if enabled and no marker
- **Primary Detection**: Runs behavioral heuristics pipeline
  - Calculates metrics via `changeAnalyzer.js`
  - Runs detector pipeline
  - Accumulates scores via `classificationScorer.js`
  - Determines final label and confidence
  - Filters reasons via `reasonFilter.js`

**Key Code:**
```javascript
// Lines 214-266
_classify(changes, eventTimestamps = [], eventRangeSets = [], firstChangeTime = null) {
    // Early exit: @ai marker check
    if (this._hasAIMarker(changes)) {
        return { label: 'ai', confidence: 1.0, reasons: ['@ai marker found'] };
    }
    
    // Marker-only mode check
    if (this.markerOnly) {
        return { label: 'unknown', confidence: 0.2, reasons: ['marker-only mode: no marker found'] };
    }
    
    // Primary detection: behavioral heuristics
    const metrics = calculateMetrics(changes, eventTimestamps, eventRangeSets, firstChangeTime, this.config);
    
    // Run detector pipeline
    const detectors = [
        () => detectFormatter(metrics, this.config),
        () => detectRapidScattered(metrics, this.config),
        () => detectLargeInsertion(metrics, this.config),
        () => detectMultiLineInsertion(metrics, this.config),
        () => detectPureInsertions(metrics, this.config),
        () => detectScatteredEdits(metrics, this.config),
        () => detectSmallEdits(metrics)
    ];
    
    // Accumulate scores and determine label
    const { aiScore, formatterScore, userScore, reasonObjects } = accumulateScores(detectors);
    const { label, confidence } = determineLabel(aiScore, formatterScore, userScore);
    const filteredReasons = filterReasons(reasonObjects, label);
    
    return { label, confidence, reasons: filteredReasons };
}
```

**Integration Points:**
- Uses `changeAggregator.js` for change accumulation
- Uses `configManager.js` for configuration
- Uses `versionDriftHandler.js` for drift detection
- Calls detector modules in pipeline
- Uses `classificationScorer.js` for score accumulation
- Uses `reasonFilter.js` for reason filtering

---

### 4. **changeAggregator.js** (Change Accumulation)
**Location:** `awarenessMonitor/changeAggregator.js`  
**Role:** Manages pending changes aggregation, tracking, and capping

**Key Functions:**

#### `createPendingEntry()`
- Creates new pending entry structure
- Tracks: changes, event timestamps, event range sets, document version

#### `calculateEventRangeSet(contentChanges)`
- Calculates line-based range keys for scatteredness detection
- Uses format: `${startLine}-${endLine}`

#### `addChangesWithCapping(pending, contentChanges, maxChangesPerDocumentBatch, timestamp)`
- Adds changes to pending entry
- Enforces cap (200 changes per document batch)
- Tracks first change time for temporal analysis

#### `recordEventMetadata(pending, timestamp, eventRangeSet, changeCount)`
- Records event-level metadata (not per-change)
- Tracks timestamps, range sets, change counts per event

**Key Data Structure:**
```javascript
{
    changes: [],                    // Aggregated TextDocumentContentChangeEvent[]
    eventTimestamps: [],            // One timestamp per event
    eventRangeSets: [],             // One range set per event
    eventChangeCounts: [],          // Number of changes per event
    timer: null,                    // Debounce timer
    lastChangeTime: 0,              // Last change timestamp
    firstChangeTime: 0,             // First change timestamp (for temporal analysis)
    documentVersion: null,          // Last seen document version
    onClassified: null,             // Callback function
    document: null,                  // Document reference
    flushSource: null               // Source of flush (for meta tracking)
}
```

**Integration Points:**
- Used by `changeClassifier.js` for change accumulation
- Provides metrics to `changeAnalyzer.js` for analysis

---

### 5. **configManager.js** (Configuration Management)
**Location:** `awarenessMonitor/configManager.js`  
**Role:** Manages classifier configuration: defaults, validation, merging

**Key Functions:**

#### `getDefaultConfig()`
- Returns default configuration with all thresholds
- Mode-specific defaults (vibe vs dev)

#### `validateConfig(config, defaultConfig)`
- Validates and sanitizes user config
- Removes invalid values (ensures defaults win)
- Logs warnings for invalid config

#### `createConfig(userConfig)`
- Merges user config with defaults
- Validates and sanitizes before merge
- Returns frozen config object

**Key Configuration Parameters:**
- `multiLineThreshold`: 50
- `pureInsertionCount`: 3
- `pureInsertionSize`: 20
- `largeInsertionThreshold`: 100
- `scatteredRangeCount`: 5
- `rapidScatteredTimeWindow`: 1000ms
- `rapidScatteredEventCount`: 8
- `rapidScatteredRangeCount`: 6
- `formatterRangeCount`: 8
- `markerOnly`: false (default: use heuristics)

**Integration Points:**
- Used by `changeClassifier.js` constructor
- Used by `eventHandlers.js` for mode-specific config

---

### 6. **detectors/markerDetector.js** (Marker Detection)
**Location:** `awarenessMonitor/detectors/markerDetector.js`  
**Role:** Detects `@ai` markers in code changes (strong signal when present)

**Key Function:**

#### `hasAIMarker(changes)`
- Checks for `@ai` marker in various comment formats:
  - `// @ai` (JavaScript/TypeScript/Java/C/C++/C#)
  - `# @ai` (Python/Shell/Bash)
  - `<!-- @ai -->` (HTML/XML/Markdown)
  - `-- @ai` (SQL)
  - `/* @ai */` (CSS)
- Returns `true` if marker found in any change

**Integration Points:**
- Called early in `changeClassifier._classify()` for early exit
- Provides 100% confidence when marker is present

---

### 7. **detectors/changeAnalyzer.js** (Metrics Calculation)
**Location:** `awarenessMonitor/detectors/changeAnalyzer.js`  
**Role:** Analyzes text changes and calculates metrics for detector analysis

**Key Function:**

#### `calculateMetrics(changes, eventTimestamps, eventRangeSets, firstChangeTime, config)`
- Calculates aggregate metrics from changes:
  - `totalInserted`: Total characters inserted
  - `totalDeleted`: Total characters deleted
  - `hasMultiLine`: Whether any change spans multiple lines
  - `pureInsertionCount`: Number of pure insertions (no deletions)
  - `distinctRanges`: Set of distinct line ranges
  - `distinctRangeCount`: Number of distinct ranges
  - `maxLineSpan`: Maximum line span across all changes
  - `whitespaceOnlyChangeRatio`: Ratio of whitespace-only changes
  - `rapidEventCount`: Number of events in rapid window
  - `rapidRangeSet`: Set of ranges in rapid window
  - `rapidRangeCount`: Number of distinct ranges in rapid window
  - `burstDurationMs`: Duration of burst (first to last event)
  - `changeCount`: Total number of changes

**Temporal Analysis:**
- Analyzes event timestamps (not per-change timestamps)
- Finds window with most events within `rapidScatteredTimeWindow`
- Aggregates ranges from events in rapid window

**Integration Points:**
- Called by `changeClassifier._classify()` before detector pipeline
- Provides metrics to all detectors

---

### 8. **Detector Modules** (Behavioral Heuristics)
**Location:** `awarenessMonitor/detectors/`  
**Role:** Individual detectors that analyze metrics and return scores

**Detector Pipeline (executed in order):**

#### 8a. **formatterDetector.js**
- Detects formatter/linter changes
- Looks for: many scattered changes with deletes across wide span
- Returns: `{label: 'formatter', score: 0.8, reason: '...', reasonTag: 'fmt:...'}`

#### 8b. **rapidScatteredDetector.js**
- Detects rapid scattered changes (strong AI signal)
- Looks for: many events in short time window across many ranges
- Two branches:
  - Rapid scattered: `rapidEventCount >= 8`, `rapidRangeCount >= 6` in 1s window
  - Rapid burst: `rapidEventCount >= 2`, many changes in < 1.2s
- Returns: `{label: 'ai', score: 0.7-0.8, reason: '...', reasonTag: 'ai:rapid_scattered'}`

#### 8c. **largeInsertionDetector.js**
- Detects large insertions (AI-like)
- Looks for: `totalInserted >= largeInsertionThreshold` (100)
- Returns: `{label: 'ai', score: 0.6, reason: '...', reasonTag: 'ai:large_insertion'}`

#### 8d. **multiLineDetector.js**
- Detects multi-line insertions (AI-like)
- Looks for: multi-line changes with size >= `aiMultiLineSize` (50)
- Returns: `{label: 'ai', score: 0.5, reason: '...', reasonTag: 'ai:multi_line'}`

#### 8e. **pureInsertionDetector.js**
- Detects pure insertions (no deletions)
- Looks for: `pureInsertionCount >= 3` and `totalInserted >= pureInsertionSize` (20)
- Returns: `{label: 'ai', score: 0.4, reason: '...', reasonTag: 'ai:pure_insertion'}`

#### 8f. **scatteredEditsDetector.js**
- Detects scattered edits across many ranges
- Looks for: `distinctRangeCount >= scatteredRangeCount` (5) and `totalInserted >= scatteredSizeThreshold` (200)
- Returns: `{label: 'ai', score: 0.5, reason: '...', reasonTag: 'ai:scattered'}`

#### 8g. **smallEditsDetector.js**
- Detects small, focused edits (user-like)
- Looks for: small changes, few ranges, no multi-line
- Returns: `{label: 'user', score: 0.3, reason: '...', reasonTag: 'user:small_edit'}`

**Detector Contract:**
```javascript
{
    label: 'ai' | 'formatter' | 'user',
    score: number,  // Score delta (0.0 to 1.0)
    reason: string,  // Human-readable reason
    reasonTag: string | null  // Tag for filtering (e.g., 'ai:rapid_scattered')
}
```

**Integration Points:**
- All detectors receive same `metrics` object from `changeAnalyzer.js`
- All detectors use `config` for thresholds
- Results accumulated by `classificationScorer.js`

---

### 9. **classificationScorer.js** (Score Accumulation)
**Location:** `awarenessMonitor/classificationScorer.js`  
**Role:** Accumulates detector scores and determines final classification

**Key Functions:**

#### `accumulateScores(detectors)`
- Runs all detectors and accumulates scores by label
- Collects reason objects with tags
- Returns: `{aiScore, formatterScore, userScore, reasonObjects}`

#### `determineLabel(aiScore, formatterScore, userScore)`
- Determines final label based on highest score:
  - `formatter`: If `formatterScore > aiScore && formatterScore > userScore && formatterScore > 0.5`
  - `ai`: If `aiScore > userScore && aiScore > 0.3`
  - `user`: If `userScore > 0`
  - `unknown`: Otherwise
- Calculates confidence: `Math.min(highestScore, 1.0)`
- Returns: `{label, confidence}`

**Integration Points:**
- Called by `changeClassifier._classify()` after detector pipeline
- Provides final label and confidence to classifier

---

### 10. **versionDriftHandler.js** (Version Drift Detection)
**Location:** `awarenessMonitor/versionDriftHandler.js`  
**Role:** Detects document version drift and caps confidence

**Key Functions:**

#### `hasVersionDrift(document, lastSeenVersion)`
- Checks if document version changed externally
- Returns `true` if `document.version !== lastSeenVersion`

#### `applyDriftCap(classification, document, lastSeenVersion, lastSeenTimestamp, metrics)`
- If version drift detected:
  - Caps confidence at 0.6 (reduces from higher values)
  - Adds drift reason to classification
  - Sets `classification.meta.versionDrift = true`
  - Updates metrics drift count

**Integration Points:**
- Called by `changeClassifier._classifyAndEmit()` after classification
- Applied before emitting result

---

### 11. **reasonFilter.js** (Reason Filtering)
**Location:** `awarenessMonitor/reasonFilter.js`  
**Role:** Filters classification reasons by tag prefix based on final label

**Key Function:**

#### `filterReasons(reasonObjects, label)`
- Filters reasons based on final label:
  - `formatter`: Keep only `fmt:*` tags
  - `ai`: Keep only `ai:*` tags
  - `user`: Keep only `user:*` tags
  - `unknown`: Keep all reasons
- Returns filtered array of reason strings

**Integration Points:**
- Called by `changeClassifier._classify()` after label determination
- Reduces noise in classification reasons

---

## 🔄 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ VS Code: onDidChangeTextDocument Event                     │
│ {document, contentChanges: [ChangeEvent, ...]}             │
└────────────────────┬──────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ awarenessMonitor.js                                         │
│ - Registers event listener                                  │
│ - Wraps in safe() for error handling                       │
└────────────────────┬──────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ eventHandlers.js → onTextChange()                           │
│ - Filters non-code documents                                │
│ - Creates ChangeClassifier (if needed)                      │
│ - Calls changeClassifier.addEvent()                          │
└────────────────────┬──────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ changeClassifier.js → addEvent()                            │
│ - Gets/Creates pending entry for document URI               │
│ - Stores callback once per document                          │
│ - Calls changeAggregator functions:                          │
│   • calculateEventRangeSet()                                │
│   • addChangesWithCapping()                                  │
│   • recordEventMetadata()                                   │
│ - Sets debounce timer (200ms)                               │
└────────────────────┬──────────────────────────────────────┘
                     │
                     │ [Timer Expires]
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ changeClassifier.js → _classifyAndEmit()                    │
│ - Extracts aggregated changes                                │
│ - Calls _classify()                                          │
│ - Applies versionDriftHandler.applyDriftCap()                │
│ - Emits result via callback                                  │
└────────────────────┬──────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ changeClassifier.js → _classify()                           │
│                                                              │
│ [Early Exit Check]                                          │
│ ├─→ markerDetector.hasAIMarker() → {label: 'ai', conf: 1.0} │
│ └─→ [If marker-only mode] → {label: 'unknown', conf: 0.2}  │
│                                                              │
│ [Primary Detection]                                          │
│ ├─→ changeAnalyzer.calculateMetrics()                        │
│ │   • Analyzes changes, timestamps, ranges                 │
│ │   • Returns metrics object                                │
│ │                                                             │
│ ├─→ [Detector Pipeline]                                     │
│ │   ├─→ formatterDetector(metrics, config)                  │
│ │   ├─→ rapidScatteredDetector(metrics, config)              │
│ │   ├─→ largeInsertionDetector(metrics, config)             │
│ │   ├─→ multiLineDetector(metrics, config)                   │
│ │   ├─→ pureInsertionDetector(metrics, config)              │
│ │   ├─→ scatteredEditsDetector(metrics, config)              │
│ │   └─→ smallEditsDetector(metrics)                          │
│ │                                                             │
│ ├─→ classificationScorer.accumulateScores(detectors)        │
│ │   • Accumulates scores by label                            │
│ │   • Collects reason objects                              │
│ │                                                             │
│ ├─→ classificationScorer.determineLabel(ai, fmt, user)      │
│ │   • Determines final label and confidence                  │
│ │                                                             │
│ └─→ reasonFilter.filterReasons(reasonObjects, label)       │
│     • Filters reasons by tag prefix                          │
│                                                              │
│ Returns: {label, confidence, reasons}                       │
└────────────────────┬──────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ eventHandlers.js → Classification Callback                  │
│                                                              │
│ if (label === 'ai') {                                       │
│   → agentSuggestionHandler.recordAISuggestionBatch()        │
│ } else if (label === 'formatter') {                          │
│   → [No Action - Formatters are Neutral]                    │
│ } else if (label === 'user') {                               │
│   → agentSuggestionHandler.recordUserEditBatch()             │
│ }                                                            │
│                                                              │
│ [Also records to changeLedger for DIFF bullet tracking]      │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Classification Strategy

### Two-Tier Detection

1. **PRIMARY: Behavioral Inference (Heuristics)**
   - Reliable method since markers cannot be guaranteed to survive edit pipeline
   - Analyzes edit patterns, batch characteristics, temporal patterns
   - Key signals:
     - **Rapid scattered changes**: Many scattered edits within short time window (strong AI signal)
     - Large multi-line insertions
     - Pure insertions (no deletions)
     - Scattered edits across many ranges
     - Formatter patterns: Many scattered changes with deletes across wide span

2. **SECONDARY: @ai Marker (Strong Signal When Present)**
   - Checks for `@ai` marker in various comment formats
   - When marker is present: 100% confidence (definitive signal)
   - When marker is absent: Cannot assume human origin - must use behavioral inference

### Classification Labels

- **`ai`**: AI-generated changes (confidence: 0.3-1.0)
- **`formatter`**: Formatter/linter changes (confidence: 0.5-1.0, treated as neutral)
- **`user`**: Manual user edits (confidence: 0.3-1.0)
- **`unknown`**: Cannot determine origin (confidence: 0.2)

### Confidence Levels

- **1.0**: `@ai` marker found (definitive)
- **0.6-0.8**: Strong behavioral signals (rapid scattered, formatter patterns)
- **0.3-0.6**: Moderate signals (large insertions, multi-line, scattered)
- **0.2**: Unknown or marker-only mode with no marker

---

## 🔧 Configuration Modes

### DEV Mode (Conservative)
- Higher thresholds for AI detection
- More strict scatteredness requirements
- Default configuration

### VIBE Mode (Permissive)
- Lower thresholds for AI detection
- More lenient scatteredness requirements
- Adjusted via `eventHandlers._getClassifierConfig('vibe')`

---

## 🛡️ Error Handling

- **Boundary-based error handling**: Errors handled at system boundaries (VS Code event callbacks, timers)
- **safe() wrapper**: All event listeners wrapped in `safe()` utility
- **Fail-fast validation**: Validation at module boundaries
- **No nested try/catch**: Each boundary has single error handler

---

## 📊 Key Metrics Tracked

### Per-Event Metrics
- Event timestamp
- Event range set (line-based keys)
- Number of changes per event

### Aggregated Metrics
- Total inserted/deleted characters
- Multi-line detection
- Pure insertion count
- Distinct range count
- Maximum line span
- Whitespace-only change ratio
- Rapid event count (within time window)
- Rapid range count (within time window)
- Burst duration (first to last event)

### Document-Level Metrics
- Document version (for drift detection)
- First change time (for temporal analysis)
- Last change time

---

## 🔄 Cleanup & Disposal

### Document Close
- Flushes classifier for closed document
- Emits with `source: 'close'` meta

### Editor Change
- Flushes classifier for previous document
- Emits with `source: 'switch'` meta

### Extension Stop
- `changeClassifier.flushAll()` with callback
- Processes all pending changes
- Clears all timers and pending entries

---

## 📝 Notes

1. **Debounce Window**: 200ms default - aggregates rapid changes within window
2. **Change Capping**: Maximum 200 changes per document batch (safety)
3. **Version Drift**: Caps confidence at 0.6 if document changed externally
4. **Formatter Neutrality**: Formatter classifications do not trigger user edit recording
5. **Single Callback**: Callback stored once per document (prevents double recording)
6. **Event-Level Tracking**: Tracks events (not individual changes) for temporal analysis
7. **Line-Based Ranges**: Uses line-based keys for scatteredness detection (more stable)

---

## 🔍 Debugging

### Classification Result Structure
```javascript
{
    label: 'ai' | 'user' | 'formatter' | 'unknown',
    confidence: 0.0-1.0,
    reasons: string[],  // Filtered reasons based on label
    meta: {
        source: 'timer' | 'close' | 'switch' | 'dispose',
        versionDrift: boolean
    }
}
```

### Key Log Points
- `eventHandlers.js`: Text change detection (rate-limited)
- `changeClassifier.js`: AI detection (rate-limited)
- `versionDriftHandler.js`: Version drift detection
- `configManager.js`: Invalid config sanitization

---

## 📚 Related Documentation

- `LIFECYCLE-AGENT-CHANGE.md`: Complete lifecycle from agent change to UI update
- `awarenessMonitor.js`: Main orchestrator documentation
- `changeClassifier.js`: Classification engine documentation

