# Architectural Improvements

## Overview
This document summarizes the architectural improvements made to fix hex boundary violations and optimize performance.

## 1. Fixed Hex Boundary Violations

### Moved `domain/utils/utils.js` → `app/vscodeDocUtilities.js`
**Problem**: Domain layer had direct VS Code dependencies (`vscode.Range`, `vscode.Uri`, `vscode.workspace`), violating hexagonal architecture boundaries.

**Solution**: Moved to application layer where VS Code dependencies are acceptable.

**Files Updated**:
- `app/suggestionService.js`
- `app/sessionService.js`
- `app/awarenessService.js`
- `app/debtService.js`
- `input/awarenessController.js`

**Impact**: Domain layer is now pure and testable without VS Code runtime.

### Moved `domain/utils/diffBulletBuilder.js` → `app/diffBulletService.js`
**Problem**: Presentation/reporting logic was in domain layer, violating separation of concerns.

**Solution**: Moved to application layer where presentation logic belongs.

**Files Updated**:
- `app/classificationService.js`
- `app/awarenessService.js`

**Impact**: Domain layer now contains only business logic, not presentation.

---

## 2. Performance Optimizations

### Optimized `calculateMetrics()`: O(n²) → O(n)
**Problem**: Nested loop in rapid scattered detection was O(n²), expensive for large event batches.

**Before**:
```javascript
// O(n²) - nested loop
for (let i = 0; i < eventTimestamps.length; i++) {
    for (let j = i; j < eventTimestamps.length; j++) {
        // Count events in window
    }
}
```

**After**:
```javascript
// O(n) - sliding window two-pointer technique
let left = 0;
let right = 0;
while (right < eventTimestamps.length) {
    // Expand window
    while (right < eventTimestamps.length && 
           eventTimestamps[right] - eventTimestamps[left] <= timeWindow) {
        right++;
    }
    // Shrink window
    left++;
}
```

**Impact**: Significant performance improvement for formatters and AI agents that generate many events.

---

## 3. Improved Confidence Aggregation

### Changed from Additive to Probabilistic OR
**Problem**: Additive scoring (`sum + cap at 1.0`) allowed multiple weak signals to inflate scores unintentionally, making calibration difficult.

**Before**:
```javascript
// Additive with cap
if (result.label === 'ai') {
    aiScore += result.score;
}
// Later: Math.min(aiScore, 1.0)
```

**After**:
```javascript
// Probabilistic OR: 1 - Π(1 - score_i)
const aiScores = [];
// ... collect scores ...
const aiScore = aiScores.length > 0
    ? 1 - aiScores.reduce((product, score) => product * (1 - score), 1)
    : 0;
```

**Benefits**:
- Prevents score inflation from multiple weak signals
- Easier to calibrate (each detector's score is independent)
- Mathematically sound (probabilistic OR)
- If no scores, result is 0 (correct)

**Example**:
- Two weak signals (0.3 each):
  - Additive: 0.3 + 0.3 = 0.6 (could be misleading)
  - Probabilistic OR: 1 - (0.7 × 0.7) = 0.51 (more conservative)

---

## Summary

**Files Moved**:
- `domain/utils/utils.js` → `app/vscodeDocUtilities.js`
- `domain/utils/diffBulletBuilder.js` → `app/diffBulletService.js`

**Files Optimized**:
- `domain/utils/detectors/changeAnalyzer.js` (O(n²) → O(n))
- `domain/utils/classificationScorer.js` (additive → probabilistic OR)

**Files Updated** (references):
- 7 files updated with new import paths

**Impact**:
- ✅ Domain layer is now pure (no VS Code dependencies)
- ✅ Better separation of concerns (presentation in app layer)
- ✅ Better performance (O(n) instead of O(n²))
- ✅ Better calibration (probabilistic OR instead of additive)

All improvements maintain backward compatibility and don't change external APIs.
