# Change Classification Process - Detailed Explanation

## Overview

The VibeSwitch extension classifies text changes in VS Code documents to determine whether they were made by:
- **AI Agent** (e.g., Cursor AI, GitHub Copilot)
- **User** (manual edits by the developer)
- **Formatter/Linter** (automated code formatting tools like Prettier, ESLint)
- **Unknown** (cannot be determined)

This classification is critical for tracking AI-generated code and measuring review debt.

---

## Classification Strategy

### Primary Detection: Behavioral Inference via Heuristics

The system uses **behavioral heuristics** as the primary detection method because:
1. **Markers are unreliable**: `@ai` markers cannot be guaranteed to survive the edit pipeline
2. **Pattern recognition**: AI agents exhibit distinct behavioral patterns that differ from human editing
3. **Temporal analysis**: AI agents make rapid, scattered changes within short time windows
4. **Batch characteristics**: AI-generated changes have specific size, distribution, and scatteredness patterns

### Secondary Signal: @ai Marker Detection

When `@ai` markers are present in code comments, they provide a **definitive signal** (100% confidence). However:
- **Presence = AI**: If marker found → definitely AI
- **Absence ≠ User**: If no marker found → cannot assume human origin, must use behavioral inference

### Design Philosophy

> **Behavioral heuristics are primary. Markers are helpful hints that strengthen confidence when present, but absence of marker does NOT mean human origin.**

---

## Classification Lifecycle

### Phase 1: Event Capture

**File**: `business_modules/awareness/input/awarenessEventListener.js`

1. **VS Code Event Subscription**
   - `AwarenessEngine` subscribes to `onDidChangeTextDocument` via `vscodeAdapter`
   - Event handler: `awarenessEventListener.onTextChange(event)`

2. **Event Validation**
   - Checks if `event.contentChanges.length > 0`
   - Validates document is a code file (not excluded file types)

3. **Delegation to Engine**
   - `onTextChange()` delegates to `engine.classifyTextChange(event)`

**Flow:**
```
VS Code Event → vscodeAdapter → AwarenessEventListener → AwarenessEngine
```

---

### Phase 2: Classification Service Entry

**File**: `business_modules/awareness/app/classificationService.js`

1. **Engine Delegation**
   - `AwarenessEngine.classifyTextChange(event)` calls `classificationService.classifyEvent(event)`

2. **Service Processing**
   - Extracts document URI
   - Registers event with `ChangeClassifier` via `changeClassifier.addEvent(event, callback)`
   - Callback will be invoked after debounce period with classification result

**Key Method**: `classifyEvent(event, onClassified)`
- Accepts VS Code `TextDocumentChangeEvent`
- Registers callback for post-classification handling
- Automatically handles classified changes (records batch, routes to handlers)

---

### Phase 3: Change Aggregation & Debouncing

**File**: `business_modules/awareness/app/classification/changeClassifier.js`

1. **Event Registration** (`addEvent()`)
   - Creates or retrieves pending entry for document URI
   - Stores callback once per document (prevents double recording)
   - Updates document reference and version

2. **Change Aggregation** (`changeAggregator.js`)
   - **`addChangesWithCapping()`**: Adds changes from event to pending batch
     - Caps at 200 changes per document batch (safety limit)
     - Tracks first change time for temporal analysis
   - **`calculateEventRangeSet()`**: Calculates line-based range set for scatteredness detection
   - **`recordEventMetadata()`**: Records event timestamp, range set, and change count

3. **Debouncing**
   - Clears existing timer for document
   - Sets new timer (default: 200ms debounce window)
   - Timer callback: `_classifyAndEmit(uri)`

**Pending Entry Structure:**
```javascript
{
    changes: [],                    // Aggregated TextDocumentContentChangeEvent objects
    eventTimestamps: [],            // One timestamp per event (for rapid change detection)
    eventRangeSets: [],             // Range set per event (for scattered pattern detection)
    eventChangeCounts: [],          // Number of changes per event
    timer: null,                    // Debounce timer
    lastChangeTime: 0,              // Last change timestamp
    firstChangeTime: 0,             // First change timestamp (for temporal analysis)
    documentVersion: null,          // Document version (for drift detection)
    onClassified: null,             // Callback function
    document: null,                 // Document reference
    flushSource: null               // Source of flush (for meta tracking)
}
```

**Why Debouncing?**
- AI agents often make multiple rapid changes in quick succession
- Debouncing aggregates these changes into a single batch for analysis
- Enables detection of "rapid scattered" patterns (key AI signal)

---

### Phase 4: Classification Execution

**File**: `business_modules/awareness/app/classification/changeClassifier.js`

When debounce timer fires, `_classifyAndEmit()` is called:

1. **Retrieve Pending Changes**
   - Gets pending entry for document URI
   - Extracts aggregated changes, timestamps, range sets, document reference

2. **Classification** (`_classify()`)
   - Calls classification logic with aggregated changes
   - Returns: `{label: 'ai'|'user'|'formatter'|'unknown', confidence: 0..1, reasons: string[]}`

3. **Version Drift Handling** (`versionDriftHandler.js`)
   - Checks if document version changed externally (e.g., file edited outside VS Code)
   - If drift detected, caps confidence to prevent false positives

4. **Emission**
   - Clears timer and pending entry
   - Invokes callback: `onClassified(document, classification, changes)`

---

### Phase 5: Classification Logic

**File**: `business_modules/awareness/app/classification/changeClassifier.js` → `_classify()`

#### Step 5.1: Marker Detection (Strong Signal)

**File**: `business_modules/awareness/app/classification/detectors/markerDetector.js`

1. **Check for @ai Marker** (`hasAIMarker()`)
   - Scans inserted text for `@ai` marker in various comment formats:
     - `// @ai` (JavaScript/TypeScript/Java/C/C++/C#)
     - `# @ai` (Python/Shell/Bash)
     - `<!-- @ai -->` (HTML/XML/Markdown)
     - `-- @ai` (SQL)
     - `/* @ai */` (CSS)
   - **If marker found**: Return `{label: 'ai', confidence: 1.0, reasons: ['@ai marker found']}`
   - **If marker-only mode**: Return `unknown` if no marker (skip heuristics)

#### Step 5.2: Metrics Calculation

**File**: `business_modules/awareness/app/classification/detectors/changeAnalyzer.js`

**Function**: `calculateMetrics(changes, eventTimestamps, eventRangeSets, firstChangeTime, config)`

Calculates comprehensive metrics for detector analysis:

**Size Metrics:**
- `totalInserted`: Total characters inserted
- `totalDeleted`: Total characters deleted
- `changeCount`: Number of changes

**Pattern Metrics:**
- `hasMultiLine`: Whether any change contains newlines
- `pureInsertionCount`: Number of pure insertions (no deletions)
- `distinctRangeCount`: Number of distinct line ranges
- `maxLineSpan`: Maximum line span across all changes

**Whitespace Metrics:**
- `whitespaceOnlyChangeRatio`: Ratio of changes that are whitespace-only

**Temporal Metrics (Key for AI Detection):**
- `rapidEventCount`: Maximum events within time window (default: 1000ms)
- `rapidRangeCount`: Distinct ranges in rapid window
- `burstDurationMs`: Total duration of change burst

**Algorithm**: Uses optimized O(n) sliding window two-pointer technique to find maximum rapid event count within time window.

#### Step 5.3: Detector Pipeline

**File**: `business_modules/awareness/app/classification/changeClassifier.js`

Runs composable detectors in sequence. Each detector returns:
```javascript
{
    label: 'ai'|'user'|'formatter',
    score: 0..1,           // Confidence score
    reason: string,        // Human-readable reason
    reasonTag: string      // Stable tag for filtering (e.g., 'fmt:whitespace')
}
```

**Detector Execution Order:**

1. **Formatter Detector** (`formatterDetector.js`)
   - **Purpose**: Detect formatter/linter patterns
   - **Signals**:
     - High whitespace-only change ratio (>60%)
     - Many scattered ranges (≥8) with wide line span (≥50)
     - Small average insertions per change (≤30 chars)
     - Both deletions and insertions present
   - **Score**: 0.7-0.9 (higher if high whitespace ratio)
   - **Why First**: Formatters should be filtered out before AI detection

2. **Rapid Scattered Detector** (`rapidScatteredDetector.js`)
   - **Purpose**: Detect AI pattern of many scattered edits within short time window
   - **Signals**:
     - Many events (≥8 in 'dev', ≥6 in 'vibe') within time window (1000ms)
     - Many distinct ranges (≥6 in 'dev', ≥5 in 'vibe')
     - Minimum total size (≥50 in 'dev', ≥40 in 'vibe')
   - **Score**: 0.8-0.95 (strong AI signal)
   - **Key Insight**: AI agents make many scattered edits very quickly; humans make more focused, sequential edits

3. **Large Insertion Detector** (`largeInsertionDetector.js`)
   - **Purpose**: Detect large single insertions (common AI pattern)
   - **Signals**:
     - Single change with large insertion (≥100 chars in 'dev', ≥80 in 'vibe')
     - Multi-line insertion (≥50 chars in 'dev', ≥40 in 'vibe')
   - **Score**: 0.6-0.8

4. **Multi-Line Insertion Detector** (`multiLineDetector.js`)
   - **Purpose**: Detect multi-line insertions (common AI pattern)
   - **Signals**:
     - Changes contain newlines
     - Total size ≥ threshold (50 in 'dev', 40 in 'vibe')
   - **Score**: 0.5-0.7

5. **Pure Insertion Detector** (`pureInsertionDetector.js`)
   - **Purpose**: Detect pure insertions (no deletions)
   - **Signals**:
     - Multiple pure insertions (≥3)
     - Total size ≥ threshold (20 in 'dev', 15 in 'vibe')
   - **Score**: 0.4-0.6

6. **Scattered Edits Detector** (`scatteredEditsDetector.js`)
   - **Purpose**: Detect scattered edit pattern (AI-like)
   - **Signals**:
     - Many distinct ranges (≥5)
     - Many changes (≥5)
     - Large total size (≥200)
   - **Score**: 0.5-0.7

7. **Small Edits Detector** (`smallEditsDetector.js`)
   - **Purpose**: Detect small, focused edits (user-like)
   - **Signals**:
     - Small total size (<50)
     - Few changes (≤3)
     - No multi-line changes
   - **Score**: 0.3-0.5 (user signal)

#### Step 5.4: Score Accumulation

**File**: `business_modules/awareness/app/classification/classificationScorer.js`

**Function**: `accumulateScores(detectors)`

1. **Run All Detectors**
   - Executes each detector function
   - Collects scores and reasons by label (ai, formatter, user)

2. **Probabilistic OR Combination**
   - Uses formula: `combined = 1 - Π(1 - score_i)` per label
   - **Why**: Prevents score inflation from multiple weak signals
   - **Example**: Two 0.5 scores → `1 - (1-0.5)*(1-0.5) = 0.75` (not 1.0)

3. **Returns**:
   ```javascript
   {
       aiScore: 0..1,
       formatterScore: 0..1,
       userScore: 0..1,
       reasonObjects: [{tag, text}, ...]
   }
   ```

#### Step 5.5: Label Determination

**File**: `business_modules/awareness/app/classification/classificationScorer.js`

**Function**: `determineLabel(aiScore, formatterScore, userScore)`

**Decision Logic:**

1. **Formatter Priority** (if `formatterScore > aiScore` AND `formatterScore > userScore` AND `formatterScore > 0.5`)
   - Label: `'formatter'`
   - Confidence: `min(formatterScore, 1.0)`

2. **AI Detection** (if `aiScore > userScore` AND `aiScore > 0.3`)
   - Label: `'ai'`
   - Confidence: `min(aiScore, 1.0)`

3. **User Detection** (if `userScore > 0`)
   - Label: `'user'`
   - Confidence: `max(0.3, min(userScore, 1.0))`

4. **Unknown** (if all scores are 0 or no conditions met)
   - Label: `'unknown'`
   - Confidence: `0.2`

#### Step 5.6: Reason Filtering

**File**: `business_modules/awareness/app/classification/reasonFilter.js`

**Function**: `filterReasons(reasonObjects, label)`

- Filters reasons to only include those relevant to the final label
- Uses `reasonTag` prefix matching (e.g., `'fmt:'` for formatter, `'ai:'` for AI)
- Prevents noise from irrelevant detector signals

**Result:**
```javascript
{
    label: 'ai'|'user'|'formatter'|'unknown',
    confidence: 0..1,
    reasons: ['reason1', 'reason2', ...]
}
```

---

### Phase 6: Post-Classification Processing

**File**: `business_modules/awareness/app/classificationService.js`

After classification, `handleClassifiedChanges()` is called:

#### Step 6.1: Convert to Domain Entities

**Function**: `_convertToChangeEntities(rawChanges, documentUri, batchId)`

- Converts raw VS Code `TextDocumentContentChangeEvent` objects to `Change` domain entities
- Each `Change` entity has:
  - `id`: Generated unique ID
  - `documentUri`: Document URI
  - `range`: VS Code Range
  - `text`: Inserted text
  - `rangeLength`: Deleted length
  - `timestamp`: Change timestamp
  - `metadata`: Additional metadata (batchId, etc.)

- Applies classification to each change: `change.classify(classification)`

#### Step 6.2: Record Change Batch

**Function**: `_recordChangeBatch(document, classification, changes)`

1. **Calculate Batch Metrics**
   - Total inserted/deleted characters
   - Line span and distinct range count
   - Change count

2. **Record to Change Ledger** (`changeLedgerService.append()`)
   - Stores batch metadata (timestamp, URI, file, label, confidence, reasons, metrics)
   - Returns `batchId` for linking

3. **Generate Diff Bullets** (`diffBulletService.js`)
   - Creates human-readable diff descriptions
   - Records bullets linked to batchId

#### Step 6.3: Route to Handlers

**Function**: `_routeClassifiedChanges(document, classification, changes)`

Routes classified changes to appropriate handlers based on label:

1. **AI Changes** (`label === 'ai'`)
   - Logs detection with confidence and reasons
   - Calls `suggestionLifecycleService.recordAISuggestionBatch(document, changes)`
   - Creates suggestions in `SuggestionAggregate`
   - Triggers callbacks (e.g., `onAISuggestion` for UsageStats)

2. **Formatter Changes** (`label === 'formatter'`)
   - Logs detection
   - **Neutral**: Does not record as user edits or mark suggestions as adapted
   - Formatters are considered neutral (not user intent)

3. **User Changes** (`label === 'user'`)
   - Calls `suggestionLifecycleService.recordUserEditBatch(document, changes)`
   - May mark suggestions as adapted if they overlap with user edits
   - Tracks user interaction with AI suggestions

4. **Unknown Changes**
   - Ledger captures for audit
   - Does not mark suggestions as adapted
   - Treated as neutral

---

## Files Involved in Classification

### Core Orchestration

1. **`awarenessEngine.js`**
   - Entry point: `classifyTextChange(event)`
   - Delegates to `ClassificationService`

2. **`classificationService.js`**
   - Main service orchestrating classification workflow
   - Converts raw changes to domain entities
   - Handles post-classification routing

3. **`changeClassifier.js`**
   - Change aggregation and debouncing
   - Classification orchestration
   - Detector pipeline execution

### Classification Logic

4. **`changeAnalyzer.js`**
   - Metrics calculation for detector analysis
   - Temporal analysis (rapid scattered detection)

5. **`classificationScorer.js`**
   - Score accumulation (probabilistic OR)
   - Label determination logic

6. **`reasonFilter.js`**
   - Filters reasons by label relevance

7. **`versionDriftHandler.js`**
   - Handles document version drift (external edits)

### Detectors

8. **`markerDetector.js`**
   - Detects `@ai` markers in comments

9. **`formatterDetector.js`**
   - Detects formatter/linter patterns

10. **`rapidScatteredDetector.js`**
    - Detects rapid scattered edits (strong AI signal)

11. **`largeInsertionDetector.js`**
    - Detects large single insertions

12. **`multiLineDetector.js`**
    - Detects multi-line insertions

13. **`pureInsertionDetector.js`**
    - Detects pure insertions (no deletions)

14. **`scatteredEditsDetector.js`**
    - Detects scattered edit patterns

15. **`smallEditsDetector.js`**
    - Detects small, focused edits (user signal)

### Aggregation & Configuration

16. **`changeAggregator.js`**
    - Pending change tracking
    - Event metadata recording
    - Change capping

17. **`classificationConfig.js`**
    - Mode-specific configuration (vibe vs dev)
    - Threshold values for detectors

### Post-Classification

18. **`diffBulletService.js`**
    - Generates human-readable diff descriptions

19. **`changeLedgerService.js`**
    - Persists change batches and diff bullets

20. **`suggestionLifecycleService.js`**
    - Handles AI suggestion recording
    - Handles user edit recording
    - Manages suggestion lifecycle

---

## Configuration

**File**: `business_modules/awareness/app/scoring/classificationConfig.js`

### Mode-Specific Thresholds

**VIBE Mode** (more permissive):
- Lower thresholds for AI detection
- More sensitive to rapid scattered patterns
- `rapidScatteredEventCount: 6` (vs 8 in dev)
- `rapidScatteredRangeCount: 5` (vs 6 in dev)
- `largeInsertionThreshold: 80` (vs 100 in dev)

**DEV Mode** (conservative):
- Higher thresholds for AI detection
- Less sensitive to avoid false positives
- Default thresholds

### Key Configuration Values

```javascript
{
    multiLineThreshold: 50,
    pureInsertionCount: 3,
    pureInsertionSize: 20,
    largeInsertionThreshold: 100,
    scatteredRangeCount: 5,
    scatteredChangeCount: 5,
    scatteredSizeThreshold: 200,
    formatterRangeCount: 8,
    formatterLineSpan: 50,
    rapidScatteredTimeWindow: 1000,      // 1 second window
    rapidScatteredEventCount: 8,         // Minimum events in window
    rapidScatteredRangeCount: 6,         // Minimum distinct ranges
    rapidScatteredMinSize: 50,           // Minimum total size
    markerOnly: false                     // Use heuristics (not marker-only mode)
}
```

---

## Classification Quality Assessment

### Strengths

1. **Multi-Signal Detection**
   - Combines multiple detectors for robust classification
   - Probabilistic OR prevents score inflation

2. **Temporal Analysis**
   - Rapid scattered detection is a strong AI signal
   - Uses optimized O(n) sliding window algorithm

3. **Formatter Distinction**
   - Correctly identifies formatters as neutral
   - Prevents false positives from automated formatting

4. **Marker Support**
   - Strong signal when markers are present
   - Falls back to heuristics when markers absent

5. **Version Drift Handling**
   - Prevents false positives from external edits
   - Caps confidence when document changed externally

### Potential Improvements

1. **Context Analysis**
   - Currently only checks inserted text for markers
   - Could check document context around changes

2. **Learning from Feedback**
   - Could learn from user corrections to improve thresholds

3. **Language-Specific Patterns**
   - Could use language-specific heuristics (e.g., Python vs JavaScript)

4. **Confidence Calibration**
   - Could calibrate confidence scores based on historical accuracy

---

## Example Classification Flow

### Scenario: AI Agent Makes Rapid Scattered Edits

1. **User prompts AI**: "Add error handling to this function"
2. **AI makes 10 rapid edits** across 8 different line ranges within 800ms
3. **VS Code fires events**: 10 `TextDocumentChangeEvent` events
4. **Event listener captures**: All events registered with `ClassificationService`
5. **Change aggregator**: Aggregates all 10 events into single batch
6. **Debounce timer**: Waits 200ms after last event
7. **Metrics calculation**: 
   - `rapidEventCount: 10`
   - `rapidRangeCount: 8`
   - `totalInserted: 450`
8. **Detector pipeline**:
   - Formatter: No (low whitespace ratio)
   - Rapid Scattered: **Yes** (10 events, 8 ranges, 450 chars) → Score: 0.9
   - Large Insertion: No
   - Multi-Line: Yes → Score: 0.6
   - Scattered Edits: Yes → Score: 0.7
9. **Score accumulation**: 
   - `aiScore = 1 - (1-0.9)*(1-0.6)*(1-0.7) = 0.988`
10. **Label determination**: `aiScore (0.988) > 0.3` → Label: `'ai'`, Confidence: `0.988`
11. **Post-processing**:
    - Records batch to change ledger
    - Creates suggestions in `SuggestionAggregate`
    - Triggers `onAISuggestion` callback

**Result**: Correctly classified as AI with high confidence (98.8%)

---

## Conclusion

The classification system is well-designed with:

1. **Robust multi-signal detection** using behavioral heuristics
2. **Strong temporal analysis** for rapid scattered pattern detection
3. **Clear separation of concerns** across multiple files
4. **Composable detector pipeline** for extensibility
5. **Proper handling of edge cases** (formatters, version drift, markers)

The system effectively distinguishes between AI-generated code, user edits, and formatter changes, enabling accurate tracking of review debt and awareness scores.
