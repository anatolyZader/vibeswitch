# Awareness Score Algorithm - Detailed Review (v2 - Corrected)

**Date:** January 23, 2026 (Updated: 15:17)  
**Version:** v2 - Production-Grade Implementation (Last Mile Complete)  
**Purpose:** Comprehensive review of the awareness score calculation workflow with all correctness fixes, design improvements, and "last mile" robustness enhancements

---

## Table of Contents

1. [Overview](#overview)
2. [End-to-End Workflow](#end-to-end-workflow)
3. [Data Model & Inputs](#data-model--inputs)
4. [Risk Score Calculation (Canonical Formula)](#risk-score-calculation-canonical-formula)
5. [Component Score Calculations](#component-score-calculations)
6. [Debt Score Calculation](#debt-score-calculation)
7. [Stability & Smoothing Mechanisms](#stability--smoothing-mechanisms)
8. [UI Display & Mapping](#ui-display--mapping)
9. [Key Constants & Thresholds](#key-constants--thresholds)
10. [Implementation Files](#implementation-files)
11. [Corrections & Improvements](#corrections--improvements)

---

## Overview

The **Awareness Score** is a unified **RiskScore** (0-100) displayed in the status bar that reflects the developer's engagement with AI-generated code suggestions. The score is **consistent** across all components:

- **Low risk (0-39) = 🟢 GOOD**: Careful, skeptical, thorough review
- **Medium risk (40-59) = 🟡 CAUTION**: Moderate engagement
- **High risk (60-79) = 🟠 WARNING**: Too trusting, not selective enough
- **Very high risk (80-100) = 🔴 DANGER**: Blind acceptance, no review

**⚠️ Important:** The score is a **unified RiskScore** where **higher = worse** across all components. This eliminates semantic confusion from the previous mixed-direction approach.

The score is calculated from four components:
1. **Review Score** (0-40): Measures review rate and depth (converted to risk: higher review = lower risk)
2. **Blind Acceptance Risk** (0-30): Measures "accepted without review" (higher = worse)
3. **Adaptation Score** (0-30): Measures customization (converted to risk: higher adaptation = lower risk)
4. **Debt Score** (0-30): Measures unreviewed AI-generated changes (higher = worse)

**Calculation:** Components are converted to risk, normalized to 0-1 range (by native max), then combined using weighted sum (weights total 1.0) and scaled to 0-100.

## Invariants (Source of Truth)

These invariants are guaranteed by the implementation and serve as the source of truth for all calculations:

* `calculateReviewScore()` returns **[0..40]** (clamped at return)
* `calculateBlindAcceptanceScore()` returns **[0..30]** (clamped at return)
* `calculateAdaptationScore()` returns **[0..30]** (clamped at return)
* `calculateRiskBasedDebtScore()` returns **[0..30]** (clamped at return)
* All calculators return **0** on empty input (`!Array.isArray(suggestions) || suggestions.length === 0`)
* Canonical normalization uses **native max** (40 for review, 30 for others)
* All component outputs are clamped at return to prevent NaN/Infinity/negative from bubbling into EMA

---

## Risk Score Calculation (Canonical Formula)

This is the **single canonical formula** used throughout the system. All component calculations feed into this.

### Formula

```javascript
// 1. Calculate component scores
reviewScore = calculateReviewScore(completed);           // 0-40, higher = better
blindAcceptanceRisk = calculateBlindAcceptanceScore(completed); // 0-30, higher = worse
adaptationScore = calculateAdaptationScore(completed);    // 0-30, higher = better
debtRisk = calculateRiskBasedDebtScore(...);              // 0-30, higher = worse

// 2. Convert "good" scores to risk (invert) and normalize to 0-1 range
// Scale by component's native max for consistent scaling
reviewRisk01 = clamp((40 - reviewScore) / 40, 0, 1);
adaptationRisk01 = clamp((30 - adaptationScore) / 30, 0, 1);
blindAcceptanceRisk01 = clamp(blindAcceptanceRisk / 30, 0, 1);
debtRisk01 = clamp(debtRisk / 30, 0, 1);

// 3. Weighted combination (weights sum to 1.0, directly map to 0-100)
RISK_WEIGHTS = {
    review: 0.30,        // 30% weight
    blindAcceptance: 0.30, // 30% weight
    adaptation: 0.20,    // 20% weight
    debt: 0.20          // 20% weight
}

riskScore = 
    RISK_WEIGHTS.review * reviewRisk01 +
    RISK_WEIGHTS.blindAcceptance * blindAcceptanceRisk01 +
    RISK_WEIGHTS.adaptation * adaptationRisk01 +
    RISK_WEIGHTS.debt * debtRisk01;

// 4. Scale to 0-100
finalScore = round(riskScore * 100);
```

### Key Design Decisions

1. **Consistent Scaling**: All components normalized to 0-1 by their native max (40 for review, 30 for others)
2. **Direct Mapping**: Weights sum to 1.0, no need for 130→100 normalization
3. **Unified Direction**: All components in risk terms (higher = worse) before combination
4. **No Saturation**: Worst-case review (score=0) contributes full risk weight (not clamped)

---

## Component Score Calculations

### 1. Review Score (0-40 points, higher = better)

**Location:** `business_modules/awareness/app/scoring/scoreCalculations.js::calculateReviewScore()`

**⚠️ Returns "good" score (higher = better). Will be converted to risk before summing.**

**Formula:**
```javascript
reviewedCount = suggestions.filter(s => s.reviewed).length

// Review rate (0-20): % of suggestions reviewed
reviewRate = (reviewedCount / suggestions.length) * 20

// Review depth (0-20): Time spent per 1000 characters (size-aware)
// FIXED: Use reviewed suggestions only, not total size (prevents gaming)
reviewed = suggestions.filter(s => s.reviewed);
reviewedSize = sum(reviewed.size);
reviewedTime = sum(reviewed.reviewTime);

reviewedSizeInKChars = max(reviewedSize / 1000, 0.1);
reviewSecondsPerKChar = reviewedSize > 0 ? (reviewedTime / 1000) / reviewedSizeInKChars : 0;

// Use configurable target (TARGET_SEC_PER_KCHAR) for calibration
// FIXED: Non-linear saturating function to prevent "farming" depth by hovering longer
// Uses exponential saturation: depth = 20 * (1 - Math.exp(-secPerKChar / TARGET))
// This saturates quickly, making it harder to game by just spending more time
// FIXED: Gate depth on minimum reviewed size (MIN_REVIEWED_SIZE = 200) to prevent tiny-size loophole
TARGET_SEC_PER_KCHAR = 12; // Calibratable constant (defined in scoreCalculations.js)
MIN_REVIEWED_SIZE = 200; // Minimum characters reviewed to count depth (prevents gaming)
reviewDepth = reviewedSize >= MIN_REVIEWED_SIZE && reviewSecondsPerKChar > 0
    ? 20 * (1 - Math.exp(-reviewSecondsPerKChar / TARGET_SEC_PER_KCHAR))
    : 0;

// Resolution bonus: Reviewed + decision made (clamp -5 to +5)
// FIXED: Use Set for proper status checking (was buggy: 'rejected' || 'adapted' always truthy)
// FIXED: Require minimum review time to prevent gaming (fast accept/reject without quality review)
MINIMUM_REVIEW_TIME_MS = 5000; // 5 seconds
resolvedStatuses = new Set(['accepted', 'rejected', 'adapted']);
resolvedAfterReview = suggestions.filter(s => 
    s.reviewed && 
    (s.reviewTime || 0) >= MINIMUM_REVIEW_TIME_MS &&
    resolvedStatuses.has(s.status)
).length;
reviewedButUnresolved = reviewedCount - resolvedAfterReview;

// FIXED: Allow negative values (clamp -5 to +5, not just max(0, ...))
resolutionBonus = clamp(
    (resolvedAfterReview / suggestions.length) * 5 - 
    (reviewedButUnresolved / suggestions.length) * 5,
    -5, 5
);

// FIXED: Clamp final reviewScore to 0-40 range (can go negative or exceed 40 otherwise)
rawScore = reviewRate + reviewDepth + resolutionBonus;
reviewScore = clamp(round(rawScore), 0, 40)
```

**Interpretation:**
- **Review Rate (0-20)**: Percentage of suggestions reviewed
- **Review Depth (0-20)**: Time spent per 1000 characters of **reviewed** suggestions only (prevents gaming)
- **Resolution Bonus (-5 to +5)**: Encourages review that leads to decisions, penalizes reviewed but unresolved

**Key Fixes:**
- ✅ Uses reviewed size only (not total size) for depth calculation
- ✅ Configurable target (TARGET_SEC_PER_KCHAR = 12) for calibration
- ✅ Proper status checking using Set (not buggy || operator)
- ✅ Resolution bonus allows negative values (clamp -5 to +5)

---

### 2. Blind Acceptance Risk Score (0-30 points, higher = worse)

**Location:** `business_modules/awareness/app/scoring/scoreCalculations.js::calculateBlindAcceptanceScore()`

**⚠️ Returns risk score (higher = worse). Measures "accepted without review" instead of just acceptance rate.**

**Formula (Simplified, Stable):**
```javascript
resolved = suggestions.filter(s => 
    s.status === 'accepted' || s.status === 'rejected' || s.status === 'adapted'
)

if (resolved.length === 0) return 0;

total = resolved.length

// Key distinction: accepted WITHOUT effective review vs accepted AFTER effective review
// FIXED: Use effectiveReviewed helper for consistency (eliminates "reviewed=true but 0ms" drift)
isEffectivelyReviewed = (s) => !!s.reviewed && (s.reviewTime || 0) >= MINIMUM_REVIEW_TIME_MS;
blind = resolved.filter(s => s.status === 'accepted' && !isEffectivelyReviewed(s)).length
carefulAccept = resolved.filter(s => s.status === 'accepted' && isEffectivelyReviewed(s)).length
// FIXED: Require effective review for adapted mitigation (makes "adaptation reduces blind risk" defensible)
adapted = resolved.filter(s => s.status === 'adapted' && isEffectivelyReviewed(s)).length

// Calculate rates
blindRate = blind / total
carefulAcceptRate = carefulAccept / total
adaptRate = adapted / total

// Core: blind acceptance dominates (85% weight), careful acceptance is mild (15% weight)
risk = 30 * clamp(0.85 * blindRate + 0.15 * carefulAcceptRate, 0, 1);

// Mitigation: adaptation reduces risk (up to -6 points, reduced from -10 to avoid double-counting)
// Note: Adaptation already has its own component (0.20 weight), so mitigation is capped tighter
risk = max(0, risk - 6 * adaptRate);

return round(clamp(risk, 0, 30));
```

**Interpretation:**
- **Blind acceptance (85% weight)**: Accepting without review = high risk
- **Careful acceptance (15% weight)**: Accepting after review = mild risk
- **Mitigation (-6 max)**: Adaptation reduces risk (shows engagement, capped to avoid double-counting with adaptation component)

**Key Improvements:**
- ✅ Simplified formula (no piecewise branches, avoids weird cliffs)
- ✅ Stable and easy to reason about
- ✅ Adaptation explicitly reduces risk (not counted as blind acceptance)

**Example:**
- 10 resolved: 3 blind, 2 careful, 3 adapted, 2 rejected
- `blindRate = 0.3`, `carefulAcceptRate = 0.2`, `adaptRate = 0.3`
- `risk = 30 * clamp(0.85*0.3 + 0.15*0.2, 0, 1) = 30 * 0.285 = 8.55`
- `risk = max(0, 8.55 - 6*0.3) = max(0, 6.75) = 6.75 ≈ 7`

**Note:** If user has only pending suggestions and no resolved ones, blind acceptance returns 0. This is correct - pending risk is handled by debtRisk (which counts pending suggestions).

---

### 3. Adaptation Score (0-30 points, higher = better)

**Location:** `business_modules/awareness/app/scoring/scoreCalculations.js::calculateAdaptationScore()`

**⚠️ Returns "good" score (higher = better). Will be converted to risk before summing.**

**Formula (FIXED: Based on accepted surface only):**
```javascript
// FIXED: Base calculation on "accepted surface" (accepted or adapted), not all suggestions
// This prevents penalizing sessions with many rejections/pending, and aligns with what we measure
resolvedAcceptedSurface = suggestions.filter(s => 
    s.status === 'accepted' || s.status === 'adapted'
)

if (resolvedAcceptedSurface.length === 0) return 0; // No accepted/adapted = no adaptation data

adapted = resolvedAcceptedSurface.filter(s => s.status === 'adapted')
adaptedCount = adapted.length

// Adaptation rate (0-15): % of accepted/adapted suggestions that were adapted
adaptRate = adaptedCount / resolvedAcceptedSurface.length
adaptationRate = adaptRate * 15

// Adaptation depth (0-15): Average edits per adapted suggestion (not all suggestions)
// FIXED: Only count edits on adapted suggestions, not all suggestions
// FIXED: Non-linear saturating function to prevent "farming" depth with many small edits
totalEditsOnAdapted = sum(s.editCount for adapted suggestions)
avgEditsPerAdapted = adaptedCount > 0 ? totalEditsOnAdapted / adaptedCount : 0

// Non-linear saturation: depth = 15 * (1 - Math.exp(-avgEditsPerAdapted / 2))
// This prevents farming and allows future swap to "meaningful edits" metric without touching score shape
adaptationDepth = 15 * (1 - Math.exp(-avgEditsPerAdapted / 2))

// Clamp output to prevent NaN/Infinity/negative from bubbling into EMA
adaptationScore = clamp(round(adaptationRate + adaptationDepth), 0, 30)
```

**Interpretation:**
- **Adaptation Rate (0-15)**: Percentage of accepted/adapted suggestions that were adapted (not all suggestions)
- **Adaptation Depth (0-15)**: Average edits per adapted suggestion (not all suggestions)

**Key Fix:**
- ✅ Based on "accepted surface" only (prevents penalizing sessions with many rejections/pending)
- ✅ Only counts edits on adapted suggestions (aligns with what we measure)

---

### 4. Debt Score (0-30 points, higher = worse)

**Location:** `business_modules/awareness/app/scoring/scoreCalculations.js::calculateRiskBasedDebtScore()`

Debt combines **file-level debt** and **suggestion-level debt** using a risk-based approach.

#### 4.1 File-Level Debt Calculation

For each unreviewed `FileDebt`:

```javascript
fileUri = fileDebt.fileUri
fileCriticality = getFileCriticality(fileUri)  // 0.5 to 2.0
semanticMultiplier = getSemanticRiskMultiplier(fileUri) || 1

footprint = fileDebt.totalChanges  // Character count
ageHours = (now - fileDebt.modifiedAt) / (1000 * 60 * 60)

// Base risk (capped at 6 per file)
baseRisk = min((footprint / 1000) * fileCriticality * semanticMultiplier, 6)

// Age multiplier (piecewise: fast first hour, slower after)
ageMultiplier = calculateAgeMultiplier(ageHours)

fileDebtValue = baseRisk * ageMultiplier
```

#### 4.2 Suggestion-Level Debt Calculation

For each pending `Suggestion`:

```javascript
fileUri = suggestion.document
fileCriticality = getFileCriticality(fileUri)
semanticMultiplier = getSemanticRiskMultiplier(fileUri) || 1

footprint = suggestion.size  // Character count
scatter = suggestion.rangeCount ?? 0  // Number of ranges (default to 0, not 1)
// FIXED: Use ?? instead of || to handle provenanceScore=0 correctly (|| would coerce 0 to 0.5)
provenanceScore = suggestion.provenanceScore ?? suggestion.classificationConfidence ?? 0.5  // AI-likelihood (0-1)
hasVerification = suggestion.hasVerification() ?? false
ageHours = (now - suggestion.timestamp) / (1000 * 60 * 60)

// Base risk (capped at 3 per suggestion)
// FIXED: Use sqrt for scatter to reduce outliers from multi-range edits
// FIXED: Guard for undefined/0 - sqrt(0)=0, ensure scatter defaults consistently
scatterTerm = Math.sqrt(Math.max(scatter, 0)) / 3;  // Tunable: adjust divisor to calibrate
baseRisk = Math.min(((footprint / 500) + scatterTerm) * fileCriticality * semanticMultiplier, 3)

// Provenance multiplier: AI-likelihood increases risk
// FIXED: Only apply when provenance is confidently AI (>0.7), otherwise it amplifies noise
provenanceMultiplier = provenanceScore > 0.7 
    ? 1 + (alpha * provenanceScore)  // alpha = 0.5 (default)
    : 1.0;  // No amplification for uncertain/low-confidence classifications

// Verification penalty: lack of verification increases debt
verificationPenalty = hasVerification ? 0.5 : 1.0

// Age multiplier (piecewise)
ageMultiplier = calculateAgeMultiplier(ageHours)

suggestionDebt = baseRisk * provenanceMultiplier * verificationPenalty * ageMultiplier
```

#### 4.3 Total Debt Score

```javascript
totalDebt = sum(fileDebtValue for all unreviewed files) + 
            sum(suggestionDebt for all pending suggestions)

debtScore = round(min(totalDebt, 30))  // Capped at 30
```

**Key Improvements:**
- ✅ Provenance multiplier only applies when >0.7 (prevents noise amplification)
- ✅ Scatter uses sqrt to reduce outliers (multi-cursor edits can spike rangeCount)

---

## Stability & Smoothing Mechanisms

### 1. Extended Horizon (15 minutes or last 20 resolved)

**Purpose:** Prevents score from thrashing when activity is intermittent.

**Implementation:**
```javascript
// Use extended horizon for detailed scoring (not just 10s window)
completed = horizonSuggestions.length > 0 ? horizonSuggestions : 
           recentSuggestions.filter(s => s.status !== 'pending')
```

### 2. Exponential Moving Average (EMA) Smoothing

**Location:** `business_modules/awareness/app/scoring/scoreService.js::_applySmoothing()`

**Formula:**
```javascript
EMA_ALPHA = 0.3  // Smoothing factor (0-1, lower = more smoothing)

if (!hasSmoothedScore) {
  smoothedScore = newScore  // Initialize
  hasSmoothedScore = true
} else {
  smoothedScore = EMA_ALPHA * newScore + (1 - EMA_ALPHA) * smoothedScore
}

return round(smoothedScore)
```

### 3. No Recent Activity Regime (FIXED: Smooth Transition)

**Purpose:** Prevents score from dropping to 0 when debt exists but activity is older than 10 seconds.

**FIXED Implementation (Smooth Transition):**
```javascript
// Note: If user has only pending suggestions and no resolved ones, blind acceptance returns 0.
// This is correct - pending risk is handled by debtRisk (which counts pending suggestions).
if (recentSuggestions.length === 0) {
  // Compute target score using debt-only risk (same model, empty completed set)
  // FIXED: Naming consistency - use debtRisk (0-30) consistently
  debtRisk = debtScore; // debtScore is already 0-30 range
  debtRisk01 = clamp(debtRisk / 30, 0, 1);
  
  // If there are pending suggestions, ensure minimum floor (tunable pending risk)
  // FIXED: Replace hard floor with tunable pending risk (removes magic behavior, gives calibration knobs)
  // FIXED: Specify which pending list - use pendingSuggestions.filter(s => s.status === 'pending') to avoid ambiguity
  PENDING_SOFT_CAP = 5; // Tunable: adjust to calibrate pending risk impact (defined in scoreService.js)
  targetScore = debtRisk01 * 100;
  if (hasPending && pendingSuggestions.length > 0) {
    // FIXED: Explicitly filter to pending status to avoid ambiguity
    pendingCount = pendingSuggestions.filter(s => s && s.status === 'pending').length;
    pendingRisk01 = Math.max(0, Math.min(1, pendingCount / PENDING_SOFT_CAP));
    targetScore = Math.max(targetScore, pendingRisk01 * 60);  // Up to 60 points from pending risk
  }
  
  // Apply EMA smoothing to glide toward debt-based target (smooth transition)
  currentScore = applySmoothing(clamp(targetScore, 0, 100));
}
```

**Key Improvements:**
- ✅ Smooth transition using EMA (no hard discontinuity at 10s boundary)
- ✅ Tunable pending risk (replaces hard floor, removes magic behavior)
- ✅ Debt-based target computed using same model
- ✅ Calibration knobs (PENDING_SOFT_CAP) for easy tuning

---

## UI Display & Mapping

### Visual Meter (7 segments)

**Location:** `ui/awarenessMeterDisplay.js::getScoreMeter()`

```javascript
segments = 7
filled = round((score / 100) * segments)

meter = ''
for (i = 0; i < segments; i++) {
  meter += (i < filled) ? '▰' : '▱'
}
```

### Emoji Indicator

**Location:** `ui/awarenessMeterDisplay.js::getScoreEmoji()`

**Risk Score** (higher = worse):

```javascript
if (score >= 80) return '🔴'  // Danger: High risk
if (score >= 60) return '🟠'  // Warning: Elevated risk
if (score >= 40) return '🟡'  // Caution: Moderate risk
return '🟢'                    // Good: Low risk
```

### Tooltip Breakdown

**FIXED:** Shows risk components with weighted contributions (makes tuning easier):

```
DEV Mode Risk Score: 57/100 (higher = worse)

Component Breakdown (with contributions):
Review Quality: 32/40 (higher = better)
  → Review Risk: 8/40 → contributes 6 points (30% weight)
Blind Acceptance Risk: 15/30 (higher = worse)
  → contributes 15 points (30% weight)
Adaptation Quality: 15/30 (higher = better)
  → Adaptation Risk: 15/30 → contributes 10 points (20% weight)
Debt Risk: 11/30 (higher = worse)
  → contributes 7 points (20% weight)
```

---

## Key Constants & Thresholds

### Time Windows
- `DEFAULT_RECENT_WINDOW_MS = 10,000` (10 seconds) - Recent activity detection
- `SCORING_HORIZON_MS = 900,000` (15 minutes) - Extended horizon for stability
- `SCORING_HORIZON_COUNT = 20` - Count-based horizon (last N resolved)

### Smoothing
- `EMA_ALPHA = 0.3` - Exponential moving average smoothing factor

### Review Detection
- `MINIMUM_REVIEW_TIME_MS = 5,000` (5 seconds) - Minimum review time to count as "effectively reviewed"
  - **Scoping**: Defined in `scoreCalculations.js` as a shared constant (not a magic global)
  - Used by `isEffectivelyReviewed()` helper function
- `MINIMUM_REVIEW_TIME = 5,000` (5 seconds) - Minimum review time to clear debt
- `MAX_REVIEW_TIME_MS = 60,000` (60 seconds) - Cap per-suggestion review time
- `ENGAGEMENT_TIMEOUT_MS = 5,000` (5 seconds) - Idle timeout for review accumulation
- `isEffectivelyReviewed(s)` - Helper function: checks both `reviewed` flag AND minimum review time (eliminates "reviewed=true but 0ms" drift)
- `MIN_REVIEWED_SIZE = 200` - Minimum characters reviewed to count depth (prevents tiny-size loophole)

### Review Depth Calibration
- `TARGET_SEC_PER_KCHAR = 12` - Target seconds per 1000 characters for full depth score (calibratable)
  - **Scoping**: Defined in `scoreCalculations.js` as a shared constant (not a magic global)
- Uses exponential saturation: `depth = 20 * (1 - Math.exp(-secPerKChar / TARGET))` (non-linear, prevents gaming)
- **JS Note**: All formulas use `Math.exp()` explicitly (not `exp()`) to match JavaScript implementation
- `MIN_REVIEWED_SIZE = 200` - Minimum characters reviewed to count depth (prevents "review 5 chars for 5 seconds → decent depth" loophole)

### Score Ranges
- **Review Score**: 0-40 points (higher = better, converted to risk)
- **Blind Acceptance Risk**: 0-30 points (higher = worse)
- **Adaptation Score**: 0-30 points (higher = better, converted to risk)
- **Debt Score**: 0-30 points (higher = worse)
- **RiskScore (final)**: 0-100 points (higher = worse, weighted combination)

### UI Thresholds
- **🟢 Green**: 0-39 (good: low risk)
- **🟡 Yellow**: 40-59 (caution: moderate risk)
- **🟠 Orange**: 60-79 (warning: elevated risk)
- **🔴 Red**: 80-100 (danger: high risk)

### File Criticality
- **Security/Auth**: 2.0x multiplier
- **Infrastructure/Config**: 1.5x multiplier
- **Database/API**: 1.3x multiplier
- **Regular Code**: 1.0x multiplier (baseline)
- **Test Files**: 0.5x multiplier

### Debt Calculation
- **Base risk cap (file)**: 6 points per file
- **Base risk cap (suggestion)**: 3 points per suggestion
- **Total debt cap**: 30 points
- **Age multiplier**: 1.0 → 2.0 (piecewise: fast first hour, slower after)
- **Provenance alpha**: 0.5 (default)
- **Provenance threshold**: 0.7 (only apply multiplier if >0.7)
- **Scatter term**: `sqrt(scatter) / 3` (tunable divisor)

---

## Corrections & Improvements

### Critical Correctness Fixes

#### 1. Fixed `resolvedAfterReview` Predicate Bug

**Problem:** 
```javascript
// WRONG: 'rejected' || 'adapted' always evaluates to truthy string
s.reviewed && (s.status === 'accepted' || 'rejected' || 'adapted')
```

**Fix:**
```javascript
// CORRECT: Use Set for proper status checking + effectiveReviewed helper
const resolvedStatuses = new Set(['accepted', 'rejected', 'adapted']);
const isEffectivelyReviewed = (s) => !!s.reviewed && (s.reviewTime || 0) >= MINIMUM_REVIEW_TIME_MS;
const resolvedAfterReview = suggestions.filter(s => 
    isEffectivelyReviewed(s) && resolvedStatuses.has(s.status)
).length;
```

#### 2. Fixed Risk Normalization Inconsistency

**Problem:** Clamping review/adaptation risk to 0-30 after inversion saturates at 30, losing the worst 25% of review-risk range.

**Fix:** Scale by component's native max (consistent 0-1 normalization):
```javascript
// CORRECT: Scale by native max
reviewRisk01 = clamp((40 - reviewScore) / 40, 0, 1);
adaptationRisk01 = clamp((30 - adaptationScore) / 30, 0, 1);
blindAcceptanceRisk01 = clamp(blindAcceptanceRisk / 30, 0, 1);
debtRisk01 = clamp(debtRisk / 30, 0, 1);

riskScore = 
    RISK_WEIGHTS.review * reviewRisk01 +
    RISK_WEIGHTS.blindAcceptance * blindAcceptanceRisk01 +
    RISK_WEIGHTS.adaptation * adaptationRisk01 +
    RISK_WEIGHTS.debt * debtRisk01;
```

#### 3. Fixed Review Depth to Use Reviewed Size Only

**Problem:** Used total size, allowing gaming by reviewing only tiny suggestions.

**Fix:**
```javascript
// CORRECT: Use reviewed suggestions only
const reviewed = suggestions.filter(s => s.reviewed);
const reviewedSize = reviewed.reduce((sum, s) => sum + (s.size || 0), 0);
const reviewedTime = reviewed.reduce((sum, s) => sum + (s.reviewTime || 0), 0);
const reviewedSizeInKChars = Math.max(reviewedSize / 1000, 0.1);
const reviewSecondsPerKChar = reviewedSize > 0 ? (reviewedTime / 1000) / reviewedSizeInKChars : 0;
```

#### 3a. Fixed Review Score Clamp to 0-40 Range

**Problem:** Review score can go negative (0 + 0 - 5 = -5) or exceed 40 (20 + 20 + 5 = 45), but canonical formula assumes 0-40 range.

**Fix:**
```javascript
// CORRECT: Clamp final reviewScore to 0-40 range
const rawScore = reviewRate + reviewDepth + resolutionBonus;
return Math.max(0, Math.min(40, Math.round(rawScore)));
```

#### 4. Fixed Resolution Bonus Range

**Problem:** `Math.max(0, good - bad)` only allows 0 to +5, never negative.

**Fix:**
```javascript
// CORRECT: Allow negative values (clamp -5 to +5)
resolutionBonus = Math.max(-5, Math.min(5, 
    (resolvedAfterReview / suggestions.length) * 5 - 
    (reviewedButUnresolved / suggestions.length) * 5
));
```

### Design Improvements

#### 1. Simplified Blind Acceptance Formula

**Before:** Complex piecewise function with multiple branches.

**After:** Simple, stable formula:
```javascript
risk = 30 * clamp(0.85 * blindRate + 0.15 * carefulAcceptRate, 0, 1);
risk = max(0, risk - 6 * adaptRate);  // Reduced from -10 to -6 to avoid double-counting
```

**Benefits:**
- Easier to reason about
- Avoids weird cliffs
- Stable behavior
- Mitigation capped tighter (-6 instead of -10) to avoid double-counting with adaptation component (0.20 weight)

#### 2. Smooth Regime B Transition

**Before:** Hard discontinuity: `min(50 + debtScore, 100)` at 10s boundary.

**After:** Smooth EMA transition:
```javascript
targetScore = (debtRisk01 * 100);
if (hasPending) targetScore = max(targetScore, 40);
currentScore = applySmoothing(clamp(targetScore, 0, 100));
```

**Benefits:**
- No abrupt jumps
- Smooth user experience
- Debt-based target (not arbitrary floor)

#### 3. Configurable Review Depth Scale (Non-Linear)

**Before:** Hardcoded 10 seconds per 1k chars, linear scaling (easy to "farm" depth by hovering longer).

**After:** Configurable constant with non-linear saturating function:
```javascript
const TARGET_SEC_PER_KCHAR = 12; // Calibratable
// Non-linear saturating: depth = 20 * (1 - Math.exp(-secPerKChar / TARGET))
reviewDepth = reviewedSize > 0 && reviewSecondsPerKChar > 0
    ? 20 * (1 - Math.exp(-reviewSecondsPerKChar / TARGET_SEC_PER_KCHAR))
    : 0;
```

**Benefits:**
- Easy to calibrate for different languages/complexities
- Tunable without touching domain code
- Non-linear saturation prevents "farming" depth by just spending more time
- Saturates quickly, making it harder to game

#### 4. Scatter Term Smoothing

**Before:** Linear scatter term: `scatter / 10` (can dominate for multi-range edits).

**After:** Square root smoothing with guard:
```javascript
scatterTerm = sqrt(max(scatter, 0)) / 3;  // Tunable divisor, guarded for undefined/0
```

**Benefits:**
- Reduces impact of outliers
- Prevents multi-cursor edits from dominating
- Guarded for undefined/0 cases (consistent defaults)

#### 5. Provenance Multiplier Gating

**Before:** Applied to all suggestions (amplified noise).

**After:** Only when confident:
```javascript
provenanceMultiplier = provenanceScore > 0.7 
    ? 1 + (alpha * provenanceScore) 
    : 1.0;  // No amplification for uncertain classifications
```

**Benefits:**
- Prevents noise amplification
- Only applies to confident AI classifications

#### 6. Resolution Bonus Requires Minimum Review Time

**Problem:** Resolution bonus can be gamed by quickly "resolving" without quality (fast accept/reject right after minimal review).

**Fix:**
```javascript
// CORRECT: Require minimum review time to prevent gaming
const resolvedAfterReview = suggestions.filter(s => 
    s.reviewed && 
    (s.reviewTime || 0) >= MINIMUM_REVIEW_TIME_MS &&
    resolvedStatuses.has(s.status)
).length;
```

**Benefits:**
- Prevents gaming with fast accept/reject without quality review
- Ensures resolution bonus reflects genuine review engagement

#### 7. Adaptation Score Based on Accepted Surface (Non-Linear Depth)

**Problem:** Adaptation score penalizes sessions with many rejections/pending, and gives "adaptation" credit for edits on suggestions you didn't accept. Linear depth allows "farming" with many small edits.

**Fix:**
```javascript
// CORRECT: Base calculation on "accepted surface" (accepted or adapted), not all suggestions
const resolvedAcceptedSurface = suggestions.filter(s => 
    s.status === 'accepted' || s.status === 'adapted'
);
const adaptRate = adaptedCount / resolvedAcceptedSurface.length;
const avgEditsPerAdapted = adaptedCount > 0 ? totalEditsOnAdapted / adaptedCount : 0;

// Non-linear saturation: depth = 15 * (1 - Math.exp(-avgEditsPerAdapted / 2))
// This prevents farming and allows future swap to "meaningful edits" metric without touching score shape
const adaptationDepth = 15 * (1 - Math.exp(-avgEditsPerAdapted / 2));
```

**Benefits:**
- Prevents penalizing sessions with many rejections/pending
- Only counts edits on adapted suggestions (aligns with what we measure)
- Non-linear saturation prevents "farming" depth with many small edits
- Allows future swap to "meaningful edits" metric without touching score shape

#### 8. Component Contributions in Tooltip

**Enhancement:** Tooltip now shows weighted contributions to final score, making tuning easier.

**Implementation:**
```javascript
const reviewContribution = Math.round(RISK_WEIGHTS.review * reviewRisk01 * 100);
// ... (similar for other components)
tooltip = `... contributes ${reviewContribution} points (${RISK_WEIGHTS.review * 100}% weight)`;
```

**Benefits:**
- Makes tuning easier by showing each component's impact on final score
- Transparent about how weights affect the final score

---

## Implementation Files

### Core Calculation
- `business_modules/awareness/app/scoring/scoreService.js` - Main orchestration
- `business_modules/awareness/app/scoring/scoreCalculations.js` - Pure calculation functions

### Debt Management
- `business_modules/awareness/app/debt/debtService.js` - Debt service
- `business_modules/awareness/app/utilities/fileCriticality.js` - File criticality detection

### Suggestion Tracking
- `business_modules/awareness/app/suggestions/suggestionLifecycleService.js` - Lifecycle management
- `business_modules/awareness/domain/entities/suggestion.js` - Suggestion entity
- `business_modules/awareness/domain/entities/fileDebt.js` - FileDebt entity

### Event Detection
- `business_modules/awareness/input/awarenessEventListener.js` - VS Code event listeners

### UI Display
- `ui/awarenessMeterDisplay.js` - Status bar meter display
- `ui/fileColoringDisplay.js` - File decoration provider (debt indicators)

### Orchestration
- `business_modules/awareness/app/awarenessEngine.js` - Main engine (orchestrates all components)

---

## Summary

The awareness score algorithm is a **production-grade, multi-stage, multi-component** system that:

1. **Detects** AI-generated code changes via VS Code events
2. **Tracks** suggestions through their lifecycle (pending → accepted/rejected/adapted)
3. **Monitors** review engagement (cursor movement, scroll, dwell time)
4. **Accumulates** debt for unreviewed changes (file-level and suggestion-level)
5. **Calculates** four component scores (review, blind acceptance, adaptation, debt)
6. **Converts** "good" scores to risk and combines using weighted sum
7. **Smooths** the score using EMA to prevent UI thrashing
8. **Displays** the score in the status bar with visual indicators

### Key Achievements (v2 - Production Ready)

- ✅ **Semantic Consistency**: Unified RiskScore (higher = worse)
- ✅ **Correctness**: Fixed all predicate bugs, normalization issues, and edge cases (review score clamp, scatter guard, provenance ??, null checks)
- ✅ **Gaming Prevention**: Size-aware review depth, reviewed-size-only calculation, non-linear saturation, minimum review time for resolution bonus, tiny-size gate (MIN_REVIEWED_SIZE)
- ✅ **Stability**: Smooth regime transitions, no hard discontinuities, consistent pending-risk model
- ✅ **Calibratability**: Configurable constants (TARGET_SEC_PER_KCHAR, scatter divisor, PENDING_SOFT_CAP) with clear scoping
- ✅ **Accuracy**: Provenance gating, scatter smoothing, proper blind acceptance measurement (effectiveReviewed), adaptation based on accepted surface
- ✅ **Transparency**: Component contributions shown in tooltip for easier tuning
- ✅ **Double-Counting Prevention**: Blind acceptance mitigation capped at -6 (not -10) to avoid double-counting with adaptation component
- ✅ **Robustness**: Empty input guards, null checks, output clamping, correct field names (fileDebts not debts)
- ✅ **Doc-Code Alignment**: All formulas use explicit `Math.exp()`, constants have scoping notes, JS-specific notes (?? vs ||)

The system is designed for **stability** (extended horizon, EMA smoothing) and **accuracy** (risk-based debt calculation, file criticality weighting) while remaining **responsive** to recent activity (10-second window for activity detection) and **hard to game** (size-aware metrics, proper status checking).

**See also:** 
- `docs/AWARENESS-SCORE-ALGORITHM-REVIEW.md` - Original review (superseded)
- `docs/SCORE-ALGORITHM-IMPROVEMENTS.md` - Change log of improvements
