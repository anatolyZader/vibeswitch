# Awareness Score Algorithm Improvements

**Date:** January 19, 2026  
**Status:** Implemented

## Overview

This document describes the major improvements made to the awareness score algorithm based on detailed analysis of conceptual overlaps and design issues.

---

## Key Problems Identified

### 1. Score Direction Inconsistency (CRITICAL)

**Problem:** Review Score and Adaptation Score were "higher = good" but added to a total interpreted as "higher = worse". This created semantic confusion.

**Solution:** 
- Unified all scores to **RiskScore** (0-100, higher = worse)
- Convert "good" scores (Review, Adaptation) to risk before summing
- Use weighted combination with weights summing to 1.0 (direct 0-100 mapping)

### 2. Blind Acceptance Risk Definition (CRITICAL)

**Problem:** Measured only acceptance rate, penalizing legitimate acceptance after careful review.

**Solution:**
- Redefined to measure **"accepted without review"** vs **"accepted after review"**
- Heavy penalty (30 points) for accepting without review
- Mild penalty (10 points) for accepting after review
- Adaptation reduces risk (mitigation, -5 points per 10% adapted)

### 3. Review Depth Gameability (HIGH)

**Problem:** Average review time per suggestion ignored size/complexity. 10 seconds on 20 lines ≠ 10 seconds on 1 line.

**Solution:**
- Changed to **reviewSecondsPerKChar** (time per 1000 characters)
- Prevents gaming by reviewing small changes quickly
- Added bonus for "reviewed + decision made" and penalty for "reviewed but unresolved"

### 4. Provenance Multiplier Amplification (MEDIUM)

**Problem:** Provenance multiplier applied to all suggestions, amplifying noise from uncertain classifications.

**Solution:**
- Only apply provenance multiplier when `provenanceScore > 0.7` (confident AI classification)
- Low-confidence classifications use multiplier of 1.0 (no amplification)

---

## Implementation Details

### Score Calculation Flow

```javascript
// 1. Calculate component scores
reviewScore = calculateReviewScore(completed);           // 0-40, higher = better
blindAcceptanceRisk = calculateBlindAcceptanceScore(completed); // 0-30, higher = worse
adaptationScore = calculateAdaptationScore(completed);    // 0-30, higher = better
debtRisk = calculateRiskBasedDebtScore(...);              // 0-30, higher = worse

// 2. Convert "good" scores to risk
reviewRisk = 40 - reviewScore;        // Invert: higher review = lower risk
adaptationRisk = 30 - adaptationScore; // Invert: higher adaptation = lower risk

// 3. Normalize all to 0-30 range
reviewRiskNormalized = clamp(reviewRisk, 0, 30);
adaptationRiskNormalized = clamp(adaptationRisk, 0, 30);
blindAcceptanceRiskNormalized = clamp(blindAcceptanceRisk, 0, 30);
debtRiskNormalized = clamp(debtRisk, 0, 30);

// 4. Weighted combination (weights sum to 1.0)
riskScore = 
    RISK_WEIGHTS.review * (reviewRiskNormalized / 30) +
    RISK_WEIGHTS.blindAcceptance * (blindAcceptanceRiskNormalized / 30) +
    RISK_WEIGHTS.adaptation * (adaptationRiskNormalized / 30) +
    RISK_WEIGHTS.debt * (debtRiskNormalized / 30);

// 5. Scale to 0-100
finalScore = round(riskScore * 100);
```

### Risk Weights

```javascript
const RISK_WEIGHTS = {
    review: 0.30,        // 30% weight
    blindAcceptance: 0.30, // 30% weight
    adaptation: 0.20,    // 20% weight
    debt: 0.20          // 20% weight
};
// Sum = 1.0, directly maps to 0-100 scale
```

### Blind Acceptance Risk Formula

```javascript
// Key distinction: accepted WITHOUT review vs accepted AFTER review
acceptedWithoutReviewRate = accepted && !reviewed / resolved
acceptedAfterReviewRate = accepted && reviewed / resolved
adaptedRate = adapted / resolved

risk = 
    acceptedWithoutReviewRate * 30 +  // Heavy penalty
    acceptedAfterReviewRate * 10 -    // Mild penalty
    adaptedRate * 5;                   // Mitigation

risk = max(0, min(risk, 30)); // Clamp to 0-30
```

### Review Depth Formula (Size-Aware)

```javascript
// Old: avgReviewTime per suggestion (gameable)
reviewDepth = min((avgReviewTime / 10000) * 20, 20);

// New: reviewSecondsPerKChar (size-aware)
totalSize = sum(s.size for all suggestions);
sizeInKChars = max(totalSize / 1000, 0.1);
reviewSecondsPerKChar = (totalReviewTime / 1000) / sizeInKChars;
reviewDepth = min((reviewSecondsPerKChar / 10) * 20, 20);

// Bonus: Reviewed + decision made
resolvedAfterReview = suggestions.filter(s => 
    s.reviewed && (s.status === 'accepted' || 'rejected' || 'adapted')
).length;
resolutionBonus = max(0, (resolvedAfterReview / total) * 5 - (reviewedButUnresolved / total) * 5);
```

---

## Benefits

1. **Semantic Consistency:** All scores now use unified RiskScore (higher = worse)
2. **Harder to Game:** Size-aware review depth prevents quick reviews of small changes
3. **More Accurate:** Blind acceptance now measures actual risk (accepted without review)
4. **Better UX:** Clear distinction between "good" behaviors (review, adaptation) and "risk" behaviors (blind acceptance, debt)
5. **Direct Mapping:** Weights sum to 1.0, no need for 130→100 normalization

---

## Remaining Considerations

### Regime Switching
The "no recent activity" baseline (50 + debtScore) can cause abrupt jumps at the 10s boundary. Consider:
- Continuous approach with EMA always on
- Debt-anchored target with slow decay

### Scatter Handling
Range count can spike from formatting or multi-cursor edits. Consider:
- Ensure formatter classification fully excludes from pending debt
- Downweight scatter when "formatter-likely"

### Configuration
Consider freezing constants into a single versioned config object for easy calibration without touching domain code.

---

## Files Modified

- `business_modules/awareness/app/scoring/scoreCalculations.js`
  - `calculateReviewScore()`: Size-aware review depth, resolution bonus
  - `calculateBlindAcceptanceScore()`: Redefined to measure "accepted without review"
  - `calculateRiskBasedDebtScore()`: Provenance multiplier only when >0.7

- `business_modules/awareness/app/scoring/scoreService.js`
  - Added `RISK_WEIGHTS` constant
  - Convert "good" scores to risk before summing
  - Weighted combination with direct 0-100 mapping

- `ui/awarenessMeterDisplay.js`
  - Updated tooltip to clarify RiskScore semantics
  - Updated comments to reflect unified risk model

---

## Testing

All existing tests pass. The changes maintain backward compatibility for:
- Score ranges (0-100)
- UI thresholds (🟢/🟡/🟠/🔴)
- Component score storage (for display)

The semantic meaning is now consistent: **higher total score = higher risk = worse behavior**.
