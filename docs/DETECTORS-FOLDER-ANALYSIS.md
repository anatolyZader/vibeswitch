# Detectors Folder Analysis

## Overview

The `detectors/` folder contains **9 specialized detection modules** that analyze text change patterns to classify edits as AI-generated, user-made, or formatter/linter changes. These are pure function utilities that operate on pre-calculated metrics.

**Location**: `business_modules/awareness/app/classification/detectors/`

---

## Architecture

The detectors follow a **composable pipeline pattern**:

1. **Metrics Calculation** (`changeAnalyzer.js`) - Analyzes raw changes and produces metrics
2. **Pattern Detection** (7 detectors) - Each detector analyzes metrics and returns a classification signal
3. **Marker Detection** (`markerDetector.js`) - Checks for explicit `@ai` markers (strongest signal)
4. **Score Accumulation** (`classificationScorer.js`) - Combines detector outputs into final classification

```
changeClassifier.js
  ├─> markerDetector.js (early exit if marker found)
  ├─> changeAnalyzer.js (calculate metrics)
  └─> Detector Pipeline:
      ├─> formatterDetector.js
      ├─> rapidScatteredDetector.js
      ├─> largeInsertionDetector.js
      ├─> multiLineDetector.js
      ├─> pureInsertionDetector.js
      ├─> scatteredEditsDetector.js
      └─> smallEditsDetector.js
  └─> classificationScorer.js (accumulate scores)
```

---

## File-by-File Analysis

### 1. `changeAnalyzer.js` ✅ **REQUIRED**

**Purpose**: Core metrics calculator - analyzes raw text changes and produces structured metrics for all detectors.

**Key Functions**:
- `calculateMetrics(changes, eventTimestamps, eventRangeSets, firstChangeTime, config)` - Main metrics calculator
- `calculateInteractionMetrics(episode, contextSignals, editSpans)` - Workflow pattern metrics (focus switches, saves, jumpiness)

**Metrics Calculated**:
- `totalInserted`, `totalDeleted` - Character counts
- `hasMultiLine` - Boolean flag
- `pureInsertionCount` - Count of changes with no deletions
- `distinctRangeCount`, `maxLineSpan` - Spatial distribution metrics
- `whitespaceOnlyChangeRatio` - Formatter signal
- `rapidEventCount`, `rapidRangeCount`, `burstDurationMs` - Temporal patterns (O(n) optimized sliding window)
- `changeCount` - Total number of changes

**Why Required**: 
- **Single source of truth** for metrics calculation
- **Optimized O(n) algorithm** for rapid scattered detection (was O(n²))
- All detectors depend on these metrics - no duplication

**Dependencies**: None (pure functions)

**Used By**: All 7 pattern detectors via `changeClassifier.js`

---

### 2. `markerDetector.js` ✅ **REQUIRED**

**Purpose**: Detects explicit `@ai` markers in code comments (strongest classification signal).

**Key Function**:
- `hasAIMarker(changes)` - Checks for `@ai` marker in various comment formats

**Supported Formats**:
- `// @ai` - JavaScript/TypeScript/Java/C/C++/C#
- `# @ai` - Python/Shell/Bash
- `<!-- @ai -->` - HTML/XML/Markdown (case-insensitive, flexible whitespace)
- `-- @ai` - SQL
- `/* @ai */` - CSS (flexible block comment matching)

**Why Required**:
- **Early exit optimization** - If marker found, classification is 100% confident, no need to run heuristics
- **Strongest signal** - Overrides all other detectors when present
- **No overlap** - Only file that checks for explicit markers

**Dependencies**: None (pure function)

**Used By**: `changeClassifier.js` (early exit check before running heuristics)

---

### 3. `formatterDetector.js` ✅ **REQUIRED**

**Purpose**: Detects formatter/linter patterns (many scattered changes with high whitespace ratio).

**Key Function**:
- `detectFormatter(metrics, config)` - Returns `{label: 'formatter', score: 0.7-0.9, reason, reasonTag}` or `null`

**Detection Logic**:
- **Primary signal**: High whitespace-only change ratio (>60%)
- **Secondary signal**: Formatter characteristics:
  - Many distinct ranges (`>= config.formatterRangeCount`)
  - Wide line span (`>= config.formatterLineSpan`)
  - Both deletes and inserts (formatters typically modify, not just insert)
  - Small average insert per change (`<= 30 chars/change`)
- **Score**: 0.9 if high whitespace ratio, 0.7 if moderate whitespace but strong other signals

**Why Required**:
- **Distinguishes formatters from AI** - Both can have scattered edits, but formatters have high whitespace ratio
- **No overlap** - Only detector that identifies `formatter` label (others identify `ai` or `user`)
- **Critical for accuracy** - Prevents false AI positives from auto-formatting

**Dependencies**: `changeAnalyzer.js` (via metrics)

**Used By**: `changeClassifier.js` (first in detector pipeline)

---

### 4. `rapidScatteredDetector.js` ✅ **REQUIRED**

**Purpose**: Detects rapid scattered changes - **strongest AI behavioral signal**.

**Key Function**:
- `detectRapidScattered(metrics, config)` - Returns `{label: 'ai', score: 0.7-0.8, reason, reasonTag}` or `null`

**Detection Logic**:
- **Primary pattern**: Many events in short time window across many ranges
  - `rapidEventCount >= config.rapidScatteredEventCount`
  - `rapidRangeCount >= config.rapidScatteredRangeCount`
  - `totalInserted >= config.rapidScatteredMinSize`
  - Score: 0.8
- **Burst pattern**: Rapid burst with scatteredness
  - `rapidEventCount >= 2` (guard against single large events)
  - `burstDurationMs <= 1200ms`
  - `rapidRangeCount >= 2` (guard against tight loop editing one place)
  - `distinctRangeCount >= config.rapidScatteredRangeCount`
  - `changeCount >= config.rapidBurstChangeCount`
  - Score: 0.7

**Why Required**:
- **Key behavioral differentiator** - AI agents make many scattered edits quickly; humans make focused sequential edits
- **Temporal pattern analysis** - Uses event timestamps (not just change counts) for true "rapid" detection
- **No overlap** - Only detector that analyzes temporal patterns (others are spatial/size-based)
- **High confidence** - Score 0.7-0.8 (strong AI signal)

**Dependencies**: `changeAnalyzer.js` (uses `rapidEventCount`, `rapidRangeCount`, `burstDurationMs`)

**Used By**: `changeClassifier.js` (second in detector pipeline)

---

### 5. `largeInsertionDetector.js` ✅ **REQUIRED**

**Purpose**: Detects large single insertions (AI often inserts large blocks).

**Key Function**:
- `detectLargeInsertion(metrics, config)` - Returns `{label: 'ai', score: 0.6, reason, reasonTag}` or `null`

**Detection Logic**:
- `totalInserted > config.largeInsertionThreshold`
- `totalDeleted === 0` (pure insertion, no modifications)
- Score: 0.6

**Why Required**:
- **Simple but effective** - AI often generates large code blocks at once
- **No overlap** - Only detector that checks pure large insertions (others check multi-line, scattered, etc.)
- **Lower confidence** - Score 0.6 (moderate signal, needs other signals to confirm)

**Dependencies**: `changeAnalyzer.js` (uses `totalInserted`, `totalDeleted`)

**Used By**: `changeClassifier.js` (third in detector pipeline)

---

### 6. `multiLineDetector.js` ✅ **REQUIRED**

**Purpose**: Detects large multi-line insertions in localized area (AI pattern).

**Key Function**:
- `detectMultiLineInsertion(metrics, config)` - Returns `{label: 'ai', score: 0.7, reason, reasonTag}` or `null`

**Detection Logic**:
- `hasMultiLine === true`
- `totalInserted >= config.multiLineThreshold` (minimum size)
- `totalInserted >= config.aiMultiLineSize` (AI threshold)
- `maxLineSpan <= config.aiLineSpan` (localized, not scattered)
- Score: 0.7

**Why Required**:
- **Distinguishes from scattered** - Large multi-line insertions in one place vs. scattered edits
- **No overlap** - Only detector that requires `hasMultiLine` AND size AND localized span
- **Medium-high confidence** - Score 0.7

**Dependencies**: `changeAnalyzer.js` (uses `hasMultiLine`, `totalInserted`, `maxLineSpan`)

**Used By**: `changeClassifier.js` (fourth in detector pipeline)

---

### 7. `pureInsertionDetector.js` ✅ **REQUIRED**

**Purpose**: Detects multiple pure insertions (no deletes) - AI often adds without modifying.

**Key Function**:
- `detectPureInsertions(metrics, config)` - Returns `{label: 'ai', score: 0.6, reason, reasonTag}` or `null`

**Detection Logic**:
- `pureInsertionCount >= config.pureInsertionCount`
- `totalInserted > config.pureInsertionSize`
- `totalDeleted === 0` (all changes are pure insertions)
- Score: 0.6

**Why Required**:
- **Behavioral pattern** - AI often adds new code without modifying existing code
- **No overlap** - Only detector that checks for multiple pure insertions (others check single large or scattered)
- **Lower confidence** - Score 0.6 (needs other signals)

**Dependencies**: `changeAnalyzer.js` (uses `pureInsertionCount`, `totalInserted`, `totalDeleted`)

**Used By**: `changeClassifier.js` (fifth in detector pipeline)

---

### 8. `scatteredEditsDetector.js` ✅ **REQUIRED**

**Purpose**: Detects scattered edits pattern (could be AI or formatter, but formatter is caught first).

**Key Function**:
- `detectScatteredEdits(metrics, config)` - Returns `{label: 'ai', score: 0.5, reason, reasonTag}` or `null`

**Detection Logic**:
- `distinctRangeCount >= config.scatteredRangeCount`
- `changeCount >= config.scatteredChangeCount`
- `totalInserted > config.scatteredSizeThreshold`
- Score: 0.5

**Why Required**:
- **Fallback detector** - Catches scattered patterns that weren't caught by formatter or rapid scattered
- **Low confidence** - Score 0.5 (weakest AI signal)
- **No overlap** - Only detector that checks basic scatteredness without temporal or whitespace requirements
- **Order matters** - Runs after `formatterDetector` and `rapidScatteredDetector` (which have higher confidence)

**Dependencies**: `changeAnalyzer.js` (uses `distinctRangeCount`, `changeCount`, `totalInserted`)

**Used By**: `changeClassifier.js` (sixth in detector pipeline)

---

### 9. `smallEditsDetector.js` ✅ **REQUIRED**

**Purpose**: Detects small edits (likely user formatting/typos).

**Key Function**:
- `detectSmallEdits(metrics)` - Returns `{label: 'user', score: 0.4, reason, reasonTag}` or `null`

**Detection Logic**:
- `hasMultiLine === true` (multi-line change)
- `totalInserted < 20` (very small)
- Score: 0.4

**Why Required**:
- **Only user detector** - All other detectors identify AI or formatter; this is the only one that identifies user edits
- **Low confidence** - Score 0.4 (weak signal, but helps distinguish from AI)
- **No overlap** - Only detector that identifies `user` label (others identify `ai` or `formatter`)
- **Simple heuristic** - Small multi-line edits are typically user formatting/typos

**Dependencies**: `changeAnalyzer.js` (uses `hasMultiLine`, `totalInserted`)

**Used By**: `changeClassifier.js` (last in detector pipeline)

---

## Overlap Analysis

### ✅ No Overlapping Functionality Found

**Verification Results**:

1. **Metrics Calculation**: Only `changeAnalyzer.js` calculates metrics. No other file duplicates this logic.
   - ✅ Verified: `grep` shows `calculateMetrics` only in `changeAnalyzer.js` and its usage sites

2. **Marker Detection**: Only `markerDetector.js` checks for `@ai` markers.
   - ✅ Verified: `hasAIMarker` only in `markerDetector.js` and its usage

3. **Pattern Detection**: Each detector has a unique pattern:
   - `formatterDetector` - Whitespace ratio + scattered + small inserts
   - `rapidScatteredDetector` - Temporal patterns (events in time window)
   - `largeInsertionDetector` - Single large pure insertion
   - `multiLineDetector` - Large multi-line localized insertion
   - `pureInsertionDetector` - Multiple pure insertions
   - `scatteredEditsDetector` - Basic scatteredness (fallback)
   - `smallEditsDetector` - Small multi-line edits (user signal)

4. **Score Accumulation**: Only `classificationScorer.js` accumulates scores.
   - ✅ Verified: `accumulateScores` only in `classificationScorer.js`

5. **Classification Orchestration**: Only `changeClassifier.js` orchestrates the pipeline.
   - ✅ Verified: No other file runs the detector pipeline

### Files Checked for Overlap:

- ✅ `changeClassifier.js` - Uses detectors, doesn't duplicate logic
- ✅ `classificationService.js` - Orchestrates classifier, doesn't duplicate detection
- ✅ `classificationScorer.js` - Accumulates scores, doesn't detect patterns
- ✅ `editsBatchAnalyzer.js` - Aggregates changes, doesn't classify
- ✅ `configManager.js` - Manages config, doesn't detect patterns
- ✅ `reasonFilter.js` - Filters reasons, doesn't detect patterns

### Consolidated Files (Historical):

- `awareness-context/domain-consolidated-part2.js` - Contains commented-out detector code (historical consolidation, not active)
- ✅ Verified: These are historical snapshots, not active code

---

## Dependencies Graph

```
changeClassifier.js
  ├─> markerDetector.js (no deps)
  ├─> changeAnalyzer.js (no deps)
  │   └─> [calculates metrics for all detectors]
  ├─> formatterDetector.js
  │   └─> changeAnalyzer.js (metrics)
  ├─> rapidScatteredDetector.js
  │   └─> changeAnalyzer.js (metrics)
  ├─> largeInsertionDetector.js
  │   └─> changeAnalyzer.js (metrics)
  ├─> multiLineDetector.js
  │   └─> changeAnalyzer.js (metrics)
  ├─> pureInsertionDetector.js
  │   └─> changeAnalyzer.js (metrics)
  ├─> scatteredEditsDetector.js
  │   └─> changeAnalyzer.js (metrics)
  ├─> smallEditsDetector.js
  │   └─> changeAnalyzer.js (metrics)
  └─> classificationScorer.js (accumulates scores)
```

---

## Summary

### ✅ All 9 Files Are Required

1. **`changeAnalyzer.js`** - Core metrics calculator (single source of truth)
2. **`markerDetector.js`** - Marker detection (early exit optimization)
3. **`formatterDetector.js`** - Formatter pattern (distinguishes formatters from AI)
4. **`rapidScatteredDetector.js`** - Temporal pattern (strongest AI signal)
5. **`largeInsertionDetector.js`** - Large single insertion (AI pattern)
6. **`multiLineDetector.js`** - Large multi-line localized (AI pattern)
7. **`pureInsertionDetector.js`** - Multiple pure insertions (AI pattern)
8. **`scatteredEditsDetector.js`** - Basic scatteredness (fallback AI signal)
9. **`smallEditsDetector.js`** - Small edits (user signal)

### ✅ No Overlapping Functionality

- Each detector has a **unique pattern** and **unique purpose**
- **No duplication** of metrics calculation, marker detection, or pattern detection
- **Clear separation of concerns**: metrics → detection → scoring → classification

### ✅ Well-Architected

- **Composable pipeline** - Easy to add/remove detectors
- **Pure functions** - No side effects, easy to test
- **Single responsibility** - Each detector does one thing well
- **Optimized** - O(n) metrics calculation (was O(n²))

---

## Recommendations

### ✅ Keep All Files

All 9 files are essential and serve distinct purposes. No files should be removed.

### Potential Improvements (Future):

1. **Add unit tests** for each detector (currently only integration tests exist)
2. **Add detector documentation** with examples of patterns each detects
3. **Consider detector weights** - Some detectors might be more reliable than others
4. **Add detector confidence calibration** - Fine-tune scores based on real-world accuracy

---

## Conclusion

The `detectors/` folder is **well-organized, non-redundant, and essential** to the classification system. All 9 files are required and serve distinct purposes. There is **no overlapping functionality** with other files in the extension.
