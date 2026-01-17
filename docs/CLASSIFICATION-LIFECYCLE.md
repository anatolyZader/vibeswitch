# Classification Lifecycle Documentation

## Overview

The classification system determines whether code changes are made by **AI**, **human users**, or **formatters**. This document explains how different files participate in the classification lifecycle, from initial change detection to final classification result.

---

## Architecture Overview

```
VS Code Event
    ↓
AwarenessEventListener (input layer)
    ↓
ClassificationService (application service - orchestrator)
    ↓
ChangeClassifier (core classification engine)
    ↓
Detectors (behavioral inference)
    ↓
ClassificationScorer (score accumulation)
    ↓
Classification Result
    ↓
Post-Classification Routing (suggestion tracking, debt management)
```

---

## File Structure and Responsibilities

### 1. **`classificationService.js`** - Application Service (Orchestrator)

**Location**: `app/classificationService.js`

**Role**: High-level orchestrator that coordinates the entire classification workflow.

**Responsibilities**:
- Manages `ChangeClassifier` lifecycle
- Converts raw VS Code events to `Change` domain entities
- Handles classification configuration (mode-specific)
- Processes classification results:
  - Records change batches in `ChangeLedgerService`
  - Routes classified changes to appropriate handlers
  - Generates diff bullets for logging
- Provides clean interface for classification workflow

**Key Methods**:
- `classifyEvent(event, onClassified)` - Main entry point for classification
- `handleClassifiedChanges(document, classification, changes)` - Routes results
- `_recordChangeBatch()` - Records batch metadata
- `_routeClassifiedChanges()` - Routes to `SuggestionLifecycleService` or user edit handlers
- `flush()` / `flushAll()` - Forces classification of pending changes

**Dependencies**:
- `ChangeClassifier` (core engine)
- `Change` domain entity
- `ChangeLedgerService` (persistence)
- `SuggestionLifecycleService` (AI suggestion tracking)
- `getClassifierConfig()` (configuration)

---

### 2. **`classification/changeClassifier.js`** - Core Classification Engine

**Location**: `app/classification/changeClassifier.js`

**Role**: Core classification engine that performs debounced aggregation and behavioral inference.

**Responsibilities**:
- **Debouncing**: Aggregates rapid changes within a time window (default: 200ms)
- **Change Aggregation**: Collects changes per document until debounce timer expires
- **Version Drift Handling**: Detects when document version changes (external edits)
- **Classification Logic**: Orchestrates detector pipeline and scoring
- **Callback Management**: Invokes callbacks with classification results

**Key Methods**:
- `addEvent(event, onClassified)` - Adds change event, sets up debounce timer
- `_classifyAndEmit(uri)` - Classifies pending changes and emits result
- `_classify(changes, ...)` - Core classification logic
- `flush(document)` - Forces immediate classification
- `clear()` - Cleans up pending changes

**Classification Flow**:
1. **Marker Detection** (if enabled): Check for `@ai` markers
2. **Behavioral Inference**: Run detector pipeline
3. **Score Accumulation**: Combine detector scores
4. **Label Determination**: Choose final label (ai/user/formatter/unknown)
5. **Metadata Generation**: Calculate confidence, reasons, contributors, uncertainty

**Dependencies**:
- All detectors (marker, formatter, rapid scattered, etc.)
- `classificationScorer` (score accumulation)
- `changeAggregator` (aggregation logic)
- `configManager` (configuration)
- `versionDriftHandler` (drift detection)
- `reasonFilter` (reason filtering)

---

### 3. **`classification/classificationScorer.js`** - Score Accumulation

**Location**: `app/classification/classificationScorer.js`

**Role**: Pure functions for accumulating detector scores and determining final classification.

**Responsibilities**:
- **Score Accumulation**: Combines multiple detector scores using probabilistic OR
- **Label Determination**: Chooses final label based on scores
- **Explainability**: Calculates top contributors and uncertainty levels

**Key Functions**:
- `accumulateScores(detectors)` - Combines detector scores using probabilistic OR formula
- `determineLabel(aiScore, formatterScore, userScore)` - Chooses final label
- `getTopContributors(contributors, finalLabel, finalScore)` - Top 3 contributing features
- `calculateUncertainty(aiScore, formatterScore, userScore)` - Uncertainty level (low/medium/high)

**Scoring Formula**:
```
Probabilistic OR: combined = 1 - Π(1 - score_i)
```
This prevents score inflation from multiple weak signals.

**Label Priority**:
1. **formatter** (if formatterScore > 0.5 and highest)
2. **ai** (if aiScore > 0.3 and highest)
3. **user** (if userScore > 0)
4. **unknown** (if all scores are 0)

---

### 4. **`classification/detectors/`** - Behavioral Inference Detectors

**Location**: `app/classification/detectors/`

**Role**: Individual detectors that analyze change patterns to infer origin.

**Detector Files**:

#### **`markerDetector.js`**
- Detects `@ai` markers in code
- Strong signal when present (high confidence)
- Returns: `{ label: 'ai', score: 0.9, reason: 'AI marker detected' }`

#### **`formatterDetector.js`**
- Detects formatter patterns (many small changes, consistent formatting)
- Checks: range count, line span, change patterns
- Returns: `{ label: 'formatter', score: 0.0-1.0, reason: '...' }`

#### **`rapidScatteredDetector.js`**
- Detects rapid scattered changes (AI agents often make many edits quickly)
- Checks: event count, time window, range count
- Returns: `{ label: 'ai', score: 0.0-1.0, reason: 'Rapid scattered changes' }`

#### **`largeInsertionDetector.js`**
- Detects large single insertions (common AI pattern)
- Checks: insertion size threshold
- Returns: `{ label: 'ai', score: 0.0-1.0, reason: 'Large insertion' }`

#### **`multiLineDetector.js`**
- Detects multi-line insertions (AI often inserts complete blocks)
- Checks: line span, size
- Returns: `{ label: 'ai', score: 0.0-1.0, reason: 'Multi-line insertion' }`

#### **`pureInsertionDetector.js`**
- Detects pure insertions (no deletions, only additions)
- Checks: insertion count, size
- Returns: `{ label: 'ai', score: 0.0-1.0, reason: 'Pure insertions' }`

#### **`scatteredEditsDetector.js`**
- Detects scattered edits across many ranges
- Checks: range count, change count, size
- Returns: `{ label: 'ai', score: 0.0-1.0, reason: 'Scattered edits' }`

#### **`smallEditsDetector.js`**
- Detects small, focused edits (typical human pattern)
- Checks: change size, focus
- Returns: `{ label: 'user', score: 0.0-1.0, reason: 'Small focused edits' }`

#### **`changeAnalyzer.js`**
- Utility that calculates metrics for all detectors
- Aggregates: total size, line span, range count, timestamps, etc.
- Used by all detectors to avoid duplicate calculations

**Detector Pattern**:
```javascript
function detectX(metrics, config) {
    // Analyze metrics
    // Return: { label: 'ai'|'user'|'formatter', score: 0.0-1.0, reason: string, reasonTag: string }
    // or null if no match
}
```

---

### 5. **`classification/changeAggregator.js`** - Change Aggregation

**Location**: `app/classification/changeAggregator.js`

**Role**: Utilities for aggregating changes during debounce window.

**Responsibilities**:
- Creates pending entry structure
- Calculates event range sets (for scatteredness detection)
- Adds changes with capping (safety limit)
- Records event metadata (timestamps, ranges)

**Key Functions**:
- `createPendingEntry()` - Creates pending change structure
- `calculateEventRangeSet(changes)` - Calculates line ranges for event
- `addChangesWithCapping(pending, changes, maxChanges, now)` - Adds changes with safety cap
- `recordEventMetadata(pending, now, rangeSet, changeCount)` - Records metadata

---

### 6. **`classification/config.js`** - Configuration

**Location**: `app/classification/config.js`

**Role**: Mode-specific configuration for classification thresholds.

**Responsibilities**:
- Provides configuration for 'vibe' and 'dev' modes
- Defines thresholds for all detectors
- Mode-specific tuning (vibe = more permissive, dev = conservative)

**Key Function**:
- `getClassifierConfig(mode)` - Returns configuration object

**Configuration Parameters**:
- `multiLineThreshold` - Threshold for multi-line detection
- `largeInsertionThreshold` - Threshold for large insertions
- `rapidScatteredTimeWindow` - Time window for rapid scattered detection
- `rapidScatteredEventCount` - Minimum events for rapid scattered
- `formatterRangeCount` - Range count threshold for formatter
- `markerOnly` - Whether to use markers only (default: false, uses behavioral inference)

---

### 7. **`classification/configManager.js`** - Configuration Management

**Location**: `app/classification/configManager.js`

**Role**: Validates and merges configuration objects.

**Responsibilities**:
- Validates configuration parameters
- Merges user config with defaults
- Logs warnings for invalid configurations

**Key Function**:
- `createConfig(userConfig, loggerPort)` - Validates and merges config

---

### 8. **`classification/versionDriftHandler.js`** - Version Drift Handling

**Location**: `app/classification/versionDriftHandler.js`

**Role**: Handles document version drift (external edits).

**Responsibilities**:
- Detects when document version changes unexpectedly
- Applies drift cap to prevent classification of stale changes
- Tracks drift metrics

**Key Function**:
- `applyDriftCap(pending, currentVersion)` - Handles version drift

---

### 9. **`classification/reasonFilter.js`** - Reason Filtering

**Location**: `app/classification/reasonFilter.js`

**Role**: Filters and formats classification reasons.

**Responsibilities**:
- Filters reasons by label (only show relevant reasons)
- Formats reason text for display

**Key Function**:
- `filterReasons(reasonObjects, label)` - Filters reasons for final label

---

## Complete Classification Lifecycle

### Phase 1: Event Reception

```
VS Code fires: onDidChangeTextDocument
    ↓
AwarenessEventListener.onTextChange()
    ↓
AwarenessEngine.classifyTextChange()
    ↓
ClassificationService.classifyEvent(event, onClassified)
```

**Files Involved**:
- `input/awarenessEventListener.js` - Receives VS Code events
- `awarenessEngine.js` - Routes to classification service
- `classificationService.js` - Entry point

---

### Phase 2: Debouncing and Aggregation

```
ClassificationService.classifyEvent()
    ↓
ChangeClassifier.addEvent(event, onClassified)
    ↓
changeAggregator.addChangesWithCapping()
    ↓
Debounce timer set (200ms default)
```

**Files Involved**:
- `classificationService.js` - Calls classifier
- `changeClassifier.js` - Manages debounce
- `changeAggregator.js` - Aggregates changes

**What Happens**:
1. Changes are added to pending map (keyed by document URI)
2. Timer is reset on each new change
3. Changes accumulate until timer expires
4. Safety cap prevents excessive changes (200 per document)

---

### Phase 3: Classification Trigger

```
Debounce timer expires
    ↓
ChangeClassifier._classifyAndEmit(uri)
    ↓
Version drift check (versionDriftHandler)
    ↓
ChangeClassifier._classify(changes, ...)
```

**Files Involved**:
- `changeClassifier.js` - Triggers classification
- `versionDriftHandler.js` - Checks for drift

**What Happens**:
1. Timer expires or `flush()` is called
2. Version drift is checked (external edits)
3. Classification begins

---

### Phase 4: Behavioral Inference

```
ChangeClassifier._classify()
    ↓
changeAnalyzer.calculateMetrics()
    ↓
Detector Pipeline:
    - markerDetector (if markers present)
    - formatterDetector
    - rapidScatteredDetector
    - largeInsertionDetector
    - multiLineDetector
    - pureInsertionDetector
    - scatteredEditsDetector
    - smallEditsDetector
    ↓
classificationScorer.accumulateScores()
```

**Files Involved**:
- `changeClassifier.js` - Orchestrates detectors
- `changeAnalyzer.js` - Calculates metrics
- All detector files - Analyze patterns
- `classificationScorer.js` - Accumulates scores

**What Happens**:
1. Metrics are calculated once (size, ranges, timestamps, etc.)
2. Each detector analyzes metrics and returns score
3. Scores are accumulated using probabilistic OR
4. Reasons and contributors are collected

---

### Phase 5: Score Accumulation and Label Determination

```
classificationScorer.accumulateScores(detectors)
    ↓
Probabilistic OR: combined = 1 - Π(1 - score_i)
    ↓
classificationScorer.determineLabel(aiScore, formatterScore, userScore)
    ↓
classificationScorer.getTopContributors()
    ↓
classificationScorer.calculateUncertainty()
```

**Files Involved**:
- `classificationScorer.js` - All scoring logic

**What Happens**:
1. Detector scores are combined using probabilistic OR
2. Final label is determined (formatter > ai > user > unknown)
3. Confidence is calculated
4. Top contributors are identified (for explainability)
5. Uncertainty level is calculated (low/medium/high)

---

### Phase 6: Result Processing

```
ChangeClassifier._classifyAndEmit()
    ↓
Callback: onClassified(document, classification, rawChanges)
    ↓
ClassificationService.handleClassifiedChanges()
    ↓
1. _recordChangeBatch() - Records in ChangeLedgerService
2. _routeClassifiedChanges() - Routes to handlers
```

**Files Involved**:
- `changeClassifier.js` - Emits result
- `classificationService.js` - Processes result

**What Happens**:
1. Classification result is returned
2. Changes are converted to `Change` domain entities
3. Batch is recorded in `ChangeLedgerService`
4. Diff bullets are generated
5. Changes are routed:
   - **AI**: → `SuggestionLifecycleService.recordAISuggestionBatch()`
   - **User**: → `SuggestionLifecycleService.recordUserEditBatch()`
   - **Formatter**: Logged, no action
   - **Unknown**: Logged for audit

---

### Phase 7: Post-Classification Routing

```
ClassificationService._routeClassifiedChanges()
    ↓
If label === 'ai':
    → SuggestionLifecycleService.recordAISuggestionBatch()
    → Creates Suggestion entities
    → Adds to review debt
    → Tracks AI suggestions
    ↓
If label === 'user':
    → SuggestionLifecycleService.recordUserEditBatch()
    → Marks suggestions as adapted
    → Updates review debt
    ↓
If label === 'formatter':
    → Logged, no action (neutral)
```

**Files Involved**:
- `classificationService.js` - Routes changes
- `suggestions/suggestionLifecycleService.js` - Handles suggestions
- `debt/debtService.js` - Manages review debt

---

## Classification Result Structure

```javascript
{
    label: 'ai' | 'user' | 'formatter' | 'unknown',
    confidence: 0.0-1.0,
    reasons: string[],                    // Human-readable reasons
    topContributors: [                    // Top 3 contributing features
        {
            feature: string,              // Feature name (e.g., 'largeInsertion')
            contribution: number,          // Contribution percentage
            score: number,                 // Raw score
            reason: string                // Reason text
        }
    ],
    uncertainty: 'low' | 'medium' | 'high',
    provenanceScore: number               // AI-likelihood (0.0-1.0)
}
```

---

## Key Design Decisions

### 1. **Debouncing**
- **Why**: AI agents make rapid changes that should be classified as a single batch
- **Window**: 200ms default (configurable)
- **Benefit**: Prevents false positives from rapid user edits

### 2. **Probabilistic OR Scoring**
- **Why**: Prevents score inflation from multiple weak signals
- **Formula**: `combined = 1 - Π(1 - score_i)`
- **Benefit**: More accurate than additive scoring

### 3. **Behavioral Inference (Primary)**
- **Why**: Markers cannot be guaranteed, behavioral patterns are more reliable
- **Method**: Multiple detectors analyze change patterns
- **Benefit**: Works even without markers

### 4. **Version Drift Handling**
- **Why**: External edits (e.g., git merge) can cause stale classifications
- **Method**: Detect version changes, cap stale changes
- **Benefit**: Prevents false classifications from external edits

### 5. **Mode-Specific Configuration**
- **Why**: Different modes need different sensitivity
- **VIBE**: More permissive (lower thresholds)
- **DEV**: Conservative (higher thresholds)
- **Benefit**: Adapts to user's collaboration style

---

## Testing Classification

### Unit Tests
- Test individual detectors
- Test score accumulation
- Test label determination

### Integration Tests
- Test full classification pipeline
- Test debouncing behavior
- Test version drift handling

### Manual Testing
- Use `vibeswitch.testAddAICode` command
- Check classification results in logs
- Verify suggestions are created correctly

---

## Troubleshooting

### Classification Not Working
1. Check `ClassificationService` is initialized
2. Verify `ChangeClassifier` is created
3. Check debounce timer is working
4. Verify detectors are running

### False Positives/Negatives
1. Adjust thresholds in `config.js`
2. Check detector scores in logs
3. Review top contributors
4. Adjust mode (vibe vs dev)

### Performance Issues
1. Check debounce window (too short = more classifications)
2. Verify change capping (200 per document)
3. Check detector performance
4. Review aggregation logic

---

## Summary

The classification system is a **multi-stage pipeline** that:
1. **Receives** VS Code change events
2. **Debounces** rapid changes
3. **Analyzes** change patterns with detectors
4. **Scores** and determines label
5. **Routes** results to appropriate handlers

Each file has a **clear, single responsibility**, making the system:
- **Maintainable**: Easy to modify individual components
- **Testable**: Each component can be tested independently
- **Extensible**: New detectors can be added easily
- **Explainable**: Top contributors and uncertainty provide transparency
