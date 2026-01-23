# Awareness Score Algorithm - Detailed Review

**Date:** January 19, 2026  
**Version:** Current Implementation  
**Purpose:** Comprehensive review of the awareness score calculation workflow and all mathematical components

---

## Table of Contents

1. [Overview](#overview)
2. [End-to-End Workflow](#end-to-end-workflow)
3. [Data Model & Inputs](#data-model--inputs)
4. [Score Calculation Stages](#score-calculation-stages)
5. [Component Score Calculations](#component-score-calculations)
6. [Debt Score Calculation](#debt-score-calculation)
7. [Stability & Smoothing Mechanisms](#stability--smoothing-mechanisms)
8. [UI Display & Mapping](#ui-display--mapping)
9. [Key Constants & Thresholds](#key-constants--thresholds)
10. [Implementation Files](#implementation-files)

---

## Overview

The **Awareness Score** is now a unified **RiskScore** (0-100) displayed in the status bar that reflects the developer's engagement with AI-generated code suggestions. The score is **consistent** across all components:

- **Low risk (0-39) = 🟢 GOOD**: Careful, skeptical, thorough review
- **Medium risk (40-59) = 🟡 CAUTION**: Moderate engagement
- **High risk (60-79) = 🟠 WARNING**: Too trusting, not selective enough
- **Very high risk (80-100) = 🔴 DANGER**: Blind acceptance, no review

**⚠️ Important:** The score is now a **unified RiskScore** where **higher = worse** across all components. This eliminates semantic confusion from the previous mixed-direction approach.

The score is calculated from four components:
1. **Review Score** (0-40): Measures review rate and depth (converted to risk: higher review = lower risk)
2. **Blind Acceptance Risk** (0-30): Measures "accepted without review" (higher = worse)
3. **Adaptation Score** (0-30): Measures customization (converted to risk: higher adaptation = lower risk)
4. **Debt Score** (0-30): Measures unreviewed AI-generated changes (higher = worse)

**Calculation:** Components are converted to risk, normalized to 0-30, then combined using weighted sum (weights total 1.0) and scaled to 0-100.

---

## End-to-End Workflow

### Stage 1: Event Detection
**Location:** `business_modules/awareness/input/awarenessEventListener.js`

VS Code events are captured:
- `onDidChangeTextDocument`: Text changes in editors
- `onDidSaveTextDocument`: File saves
- `onDidOpenTextDocument`: File opens
- `onCursorMove`: Cursor movements (for review detection)
- `onScroll`: Scroll events (for review detection)

**Filtering:**
- Only processes `file://` scheme URIs (excludes virtual documents like Output panel)
- Checks for `@ai` markers in content to identify AI-generated changes
- Filters out formatter-only changes

### Stage 2: Classification
**Location:** `business_modules/awareness/app/classification/classificationService.js`

Changes are classified as:
- **AI-generated**: High confidence, large changes, or `@ai` markers
- **User-generated**: Small, incremental changes
- **Formatter**: Auto-formatting changes

**Output:** `Suggestion` entities with:
- `status`: `pending`, `accepted`, `rejected`, `adapted`
- `provenanceScore`: AI-likelihood (0-1)
- `size`: Character count
- `rangeCount`: Number of ranges (scatter proxy)
- `timestamp`: When detected

### Stage 3: Suggestion Tracking
**Location:** `business_modules/awareness/app/suggestions/suggestionLifecycleService.js`

Suggestions are:
- Added to `SuggestionAggregate` (in-memory collection)
- Tracked for lifecycle events (accept/reject/adapt)
- Monitored for review engagement (cursor movement, scroll, dwell time)
- Scheduled for status checks after 5 seconds

**Review Detection:**
- Cursor in suggestion range + dwell time ≥ 5 seconds
- Editor must be focused
- Engagement timeout: 5 seconds (stops accumulating if idle)
- Max review time per suggestion: 60 seconds (cap)

### Stage 4: Debt Accumulation
**Location:** `business_modules/awareness/app/debt/debtService.js`

Two types of debt:
1. **File-level debt**: Unreviewed AI changes in files (`FileDebt` entities)
2. **Suggestion-level debt**: Pending suggestions (`Suggestion.status === 'pending'`)

Debt is persisted to workspace storage and loaded on startup.

### Stage 5: Score Calculation
**Location:** `business_modules/awareness/app/scoring/scoreService.js`

The `ScoreService.calculateScore()` method:
1. Filters suggestions by time windows
2. Calculates component scores
3. Applies smoothing (EMA)
4. Returns normalized score (0-100)

### Stage 6: UI Update
**Location:** `ui/awarenessMeterDisplay.js`

The status bar item is updated with:
- Visual meter (7 segments: ▰▰▰▱▱▱▱)
- Emoji indicator (🟢/🟡/🟠/🔴)
- Tooltip with detailed breakdown

---

## Data Model & Inputs

### Suggestion Entity
**Location:** `business_modules/awareness/domain/entities/suggestion.js`

Key fields:
- `id`: string
- `document`: string (URI)
- `status`: 'pending' | 'accepted' | 'rejected' | 'adapted'
- `timestamp`: number (ms since epoch)
- `reviewed`: boolean
- `reviewTime`: number (ms, accumulated)
- `reviewStarted`: number (ms)
- `userEdited`: boolean
- `editCount`: number
- `size`: number (characters)
- `rangeCount`: number
- `provenanceScore`: number (0-1)
- `hasVerification`: () => boolean

### FileDebt Entity
**Location:** `business_modules/awareness/domain/entities/fileDebt.js`

Key fields:
- `fileUri`: string
- `reviewed`: boolean
- `modifiedAt`: number (ms)
- `totalChanges`: number (footprint)
- `modificationCount`: number

---

## Score Calculation Stages

### Stage 1: Time Window Filtering

**Recent Activity Window** (default: 10 seconds)
```javascript
recentSuggestions = suggestions.filter(s => (now - s.timestamp) <= 10000)
```

**Extended Horizon** (for stability: 15 minutes OR last 20 resolved)
```javascript
// Time-based: last 15 minutes
timeBased = completedSuggestions.filter(s => (now - s.timestamp) <= 900000)

// Count-based: last 20 resolved
countBased = completedSuggestions.sort(by timestamp desc).slice(0, 20)

// Use whichever gives more suggestions (more stable)
horizonSuggestions = timeBased.length >= countBased.length ? timeBased : countBased
```

**Constants:**
- `DEFAULT_RECENT_WINDOW_MS = 10,000` (10 seconds)
- `SCORING_HORIZON_MS = 900,000` (15 minutes)
- `SCORING_HORIZON_COUNT = 20`

### Stage 2: Risk Score Calculation

The algorithm converts component scores to a unified **RiskScore** (0-100, higher = worse):

```javascript
// 1. Calculate component scores
reviewScore = calculateReviewScore(completed);           // 0-40, higher = better
blindAcceptanceRisk = calculateBlindAcceptanceScore(completed); // 0-30, higher = worse
adaptationScore = calculateAdaptationScore(completed);    // 0-30, higher = better
debtRisk = calculateRiskBasedDebtScore(...);              // 0-30, higher = worse

// 2. Convert "good" scores to risk (invert)
reviewRisk = 40 - reviewScore;        // Higher review = lower risk
adaptationRisk = 30 - adaptationScore; // Higher adaptation = lower risk

// 3. Normalize all to 0-30 range
reviewRiskNormalized = clamp(reviewRisk, 0, 30);
adaptationRiskNormalized = clamp(adaptationRisk, 0, 30);
blindAcceptanceRiskNormalized = clamp(blindAcceptanceRisk, 0, 30);
debtRiskNormalized = clamp(debtRisk, 0, 30);

// 4. Weighted combination (weights sum to 1.0, direct 0-100 mapping)
RISK_WEIGHTS = {
    review: 0.30,        // 30% weight
    blindAcceptance: 0.30, // 30% weight
    adaptation: 0.20,    // 20% weight
    debt: 0.20          // 20% weight
}

riskScore = 
    RISK_WEIGHTS.review * (reviewRiskNormalized / 30) +
    RISK_WEIGHTS.blindAcceptance * (blindAcceptanceRiskNormalized / 30) +
    RISK_WEIGHTS.adaptation * (adaptationRiskNormalized / 30) +
    RISK_WEIGHTS.debt * (debtRiskNormalized / 30);

// 5. Scale to 0-100
finalScore = round(riskScore * 100);
```

### Stage 3: Regime Detection

The algorithm uses **two regimes** based on recent activity:

#### Regime A: Recent Activity Exists
- `recentSuggestions.length > 0`
- Uses detailed component scoring with risk conversion
- Applies EMA smoothing

#### Regime B: No Recent Activity
- `recentSuggestions.length === 0`
- Special handling for pending/debt
- Prevents score from dropping to 0 if debt exists

---

## Component Score Calculations

### 1. Review Score (0-40 points)

**Location:** `business_modules/awareness/app/scoring/scoreCalculations.js::calculateReviewScore()`

**⚠️ Returns "good" score (higher = better). Will be converted to risk before summing.**

**Formula:**
```javascript
reviewedCount = suggestions.filter(s => s.reviewed).length
totalReviewTime = sum(s.reviewTime for all suggestions)
totalSize = sum(s.size for all suggestions)

// Review rate (0-20): % of suggestions reviewed
reviewRate = (reviewedCount / suggestions.length) * 20

// Review depth (0-20): Time spent per 1000 characters (SIZE-AWARE)
// This prevents gaming: 10 seconds on 20 lines ≠ 10 seconds on 1 line
sizeInKChars = max(totalSize / 1000, 0.1)  // Avoid division by zero
reviewSecondsPerKChar = (totalReviewTime / 1000) / sizeInKChars
reviewDepth = min((reviewSecondsPerKChar / 10) * 20, 20)

// Resolution bonus: Reviewed + decision made (max +5 points)
// Penalty: Reviewed but unresolved (max -5 points)
resolvedAfterReview = suggestions.filter(s => 
    s.reviewed && (s.status === 'accepted' || 'rejected' || 'adapted')
).length
reviewedButUnresolved = reviewedCount - resolvedAfterReview
resolutionBonus = max(0, (resolvedAfterReview / suggestions.length) * 5 - 
                          (reviewedButUnresolved / suggestions.length) * 5)

reviewScore = round(reviewRate + reviewDepth + resolutionBonus)
```

**Interpretation:**
- **Review Rate (0-20)**: Percentage of suggestions reviewed
  - 100% reviewed = 20 points
  - 50% reviewed = 10 points
  - 0% reviewed = 0 points

- **Review Depth (0-20)**: Time spent per 1000 characters (size-aware)
  - ≥10 seconds per 1k chars = 20 points (full depth)
  - 5-10 seconds per 1k chars = 10-20 points
  - <5 seconds per 1k chars = 0-10 points

- **Resolution Bonus (-5 to +5)**: Encourages review that leads to decisions
  - Bonus for reviewed + resolved (accepted/rejected/adapted)
  - Penalty for reviewed but unresolved (noise)

**Example:**
- 10 suggestions, 8 reviewed, total review time = 80,000ms, total size = 5,000 chars
- `reviewRate = (8/10) * 20 = 16`
- `sizeInKChars = 5000 / 1000 = 5`
- `reviewSecondsPerKChar = (80000 / 1000) / 5 = 16 seconds per 1k chars`
- `reviewDepth = min((16/10) * 20, 20) = 20` (capped)
- `resolutionBonus = (7/10) * 5 = 3.5` (assuming 7 resolved after review)
- `reviewScore = 16 + 20 + 3.5 = 39.5 ≈ 40`

---

### 2. Blind Acceptance Risk Score (0-30 points)

**Location:** `business_modules/awareness/app/scoring/scoreCalculations.js::calculateBlindAcceptanceScore()`

**⚠️ INVERTED LOGIC**: High score = BAD (blind acceptance), Low score = GOOD (careful review)

**Formula:**
```javascript
accepted = suggestions.filter(s => s.status === 'accepted').length
rejected = suggestions.filter(s => s.status === 'rejected').length
total = suggestions.length

acceptRate = accepted / total
rejectRate = rejected / total

// Piecewise function:
if (acceptRate === 1.0) {
  return 30;  // WORST: Accepts everything blindly
} else if (rejectRate === 1.0) {
  return 20;  // Rejects everything (not using AI effectively)
} else if (acceptRate >= 0.6 && acceptRate <= 0.8) {
  return 15;  // Moderate acceptance
} else if (acceptRate < 0.5) {
  return 0;   // BEST: Low acceptance = careful review
} else {
  return round(acceptRate * 30);  // Linear interpolation
}
```

**Interpretation:**
- **30 points**: Accepts 100% of suggestions (worst case)
- **20 points**: Rejects 100% of suggestions (not using AI)
- **15 points**: Accepts 60-80% (moderate risk)
- **0 points**: Accepts <50% (best case: careful, selective)

**Example:**
- 10 suggestions: 7 accepted, 2 rejected, 1 adapted
- `acceptRate = 7/10 = 0.7` (Note: "adapted" is NOT counted as "accepted" here)
- `blindAcceptanceScore = 15` (moderate risk)

**⚠️ Important:** The current implementation counts `status === 'accepted'` separately from `status === 'adapted'`. However, both represent acceptance of AI code, so there's conceptual overlap with Adaptation Score (which rewards adaptation).

---

### 3. Adaptation Score (0-30 points, higher = better)

**Location:** `business_modules/awareness/app/scoring/scoreCalculations.js::calculateAdaptationScore()`

**⚠️ Returns "good" score (higher = better). Will be converted to risk before summing.**

**Formula:**
```javascript
adapted = suggestions.filter(s => s.status === 'adapted').length
adaptRate = adapted / suggestions.length

totalEdits = sum(s.editCount for all suggestions)
avgEdits = totalEdits / suggestions.length

adaptationRate = adaptRate * 15  // 0-15 points
adaptationDepth = min((avgEdits / 2) * 15, 15)  // 0-15 points

adaptationScore = round(adaptationRate + adaptationDepth)
```

**Interpretation:**
- **Adaptation Rate (0-15)**: Percentage of suggestions that were adapted
  - 100% adapted = 15 points
  - 50% adapted = 7.5 points
  - 0% adapted = 0 points

- **Adaptation Depth (0-15)**: Average edits per suggestion
  - ≥2 edits/suggestion = 15 points (full depth)
  - 1 edit = 7.5 points
  - 0 edits = 0 points

**Example:**
- 10 suggestions, 4 adapted, total edits = 12
- `adaptRate = 4/10 = 0.4`
- `adaptationRate = 0.4 * 15 = 6`
- `avgEdits = 12/10 = 1.2`
- `adaptationDepth = min((1.2/2) * 15, 15) = 9`
- `adaptationScore = 6 + 9 = 15`

---

### 4. Debt Score (0-30 points)

**Location:** `business_modules/awareness/app/scoring/scoreCalculations.js::calculateRiskBasedDebtScore()`

Debt combines **file-level debt** and **suggestion-level debt** using a risk-based approach.

#### 4.1 File-Level Debt Calculation

For each unreviewed `FileDebt`:

```javascript
fileUri = fileDebt.fileUri
fileCriticality = getFileCriticality(fileUri)  // 0.5 to 2.0
semanticMultiplier = getSemanticRiskMultiplier(fileUri) || 1  // Optional LLM enrichment

footprint = fileDebt.totalChanges  // Character count
ageHours = (now - fileDebt.modifiedAt) / (1000 * 60 * 60)

// Base risk (capped at 6 per file)
baseRisk = min((footprint / 1000) * fileCriticality * semanticMultiplier, 6)

// Age multiplier (piecewise: fast first hour, slower after)
ageMultiplier = calculateAgeMultiplier(ageHours)

// File debt contribution
fileDebtValue = baseRisk * ageMultiplier
```

**Age Multiplier Formula:**
```javascript
if (ageHours <= 1.0) {
  ageMultiplier = 1.0 + (0.5 * ageHours)  // Fast ramp: 1.0 → 1.5 at 1 hour
} else {
  ageMultiplier = min(1.5 + (0.1 * (ageHours - 1)), 2.0)  // Slower ramp: 1.5 → 2.0 at 6 hours
}
```

**File Criticality Multipliers:**
- **2.0**: Security/auth files (`/auth/`, `/security/`, `.env`, `.pem`, etc.)
- **1.5**: Infrastructure/config (`/infra/`, `dockerfile`, `k8s`, etc.)
- **1.3**: Database/API (`/db/`, `/api/`, `/routes/`, etc.)
- **1.0**: Regular code files (baseline)
- **0.5**: Test files (`/test/`, `.test.js`, etc.)

#### 4.2 Suggestion-Level Debt Calculation

For each pending `Suggestion`:

```javascript
fileUri = suggestion.document
fileCriticality = getFileCriticality(fileUri)
semanticMultiplier = getSemanticRiskMultiplier(fileUri) || 1

footprint = suggestion.size  // Character count
scatter = suggestion.rangeCount  // Number of ranges
provenanceScore = suggestion.provenanceScore || 0.5  // AI-likelihood (0-1)
hasVerification = suggestion.hasVerification() || false
ageHours = (now - suggestion.timestamp) / (1000 * 60 * 60)

// Base risk (capped at 3 per suggestion)
baseRisk = min(((footprint / 500) + (scatter / 10)) * fileCriticality * semanticMultiplier, 3)

// Provenance multiplier: AI-likelihood increases risk
// Only apply when provenance is confidently AI (>0.7), otherwise it amplifies noise
provenanceMultiplier = provenanceScore > 0.7 
    ? 1 + (alpha * provenanceScore)  // alpha = 0.5 (default)
    : 1.0  // No amplification for uncertain/low-confidence classifications

// Verification penalty: lack of verification increases debt
verificationPenalty = hasVerification ? 0.5 : 1.0

// Age multiplier (piecewise)
ageMultiplier = calculateAgeMultiplier(ageHours)

// Suggestion debt contribution
suggestionDebt = baseRisk * provenanceMultiplier * verificationPenalty * ageMultiplier
```

#### 4.3 Total Debt Score

```javascript
totalDebt = sum(fileDebtValue for all unreviewed files) + 
            sum(suggestionDebt for all pending suggestions)

debtScore = round(min(totalDebt, 30))  // Capped at 30
```

**Example:**
- 2 unreviewed files:
  - File 1: 2000 chars, criticality 1.5, age 2 hours
    - `baseRisk = min((2000/1000) * 1.5, 6) = 3`
    - `ageMultiplier = min(1.5 + (0.1 * 1), 2.0) = 1.6`
    - `fileDebtValue = 3 * 1.6 = 4.8`
  - File 2: 500 chars, criticality 1.0, age 0.5 hours
    - `baseRisk = min((500/1000) * 1.0, 6) = 0.5`
    - `ageMultiplier = 1.0 + (0.5 * 0.5) = 1.25`
    - `fileDebtValue = 0.5 * 1.25 = 0.625`
- 3 pending suggestions:
  - Suggestion 1: 1000 chars, 2 ranges, criticality 1.3, provenance 0.8, no verification, age 1 hour
    - `baseRisk = min(((1000/500) + (2/10)) * 1.3, 3) = min(2.86, 3) = 2.86`
    - `provenanceMultiplier = 1 + (0.5 * 0.8) = 1.4` (provenance 0.8 > 0.7, so multiplier applied)
    - `verificationPenalty = 1.0`
    - `ageMultiplier = 1.0 + (0.5 * 1) = 1.5`
    - `suggestionDebt = 2.86 * 1.4 * 1.0 * 1.5 = 6.0`
    
  - Suggestion 2: 500 chars, 1 range, criticality 1.0, provenance 0.5, no verification, age 0.5 hours
    - `baseRisk = min(((500/500) + (1/10)) * 1.0, 3) = 1.1`
    - `provenanceMultiplier = 1.0` (provenance 0.5 ≤ 0.7, so no amplification)
    - `verificationPenalty = 1.0`
    - `ageMultiplier = 1.0 + (0.5 * 0.5) = 1.25`
    - `suggestionDebt = 1.1 * 1.0 * 1.0 * 1.25 = 1.375`
- `totalDebt = 4.8 + 0.625 + 6.0 + 1.375 = 12.8`
- `debtScore = round(min(12.8, 30)) = 13`

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

This ensures the score reflects behavior over a longer period, not just the last 10 seconds.

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

**Effect:**
- Reduces UI thrashing from rapid score changes
- 70% weight on previous score, 30% on new score
- Smooth transitions instead of jumps

**Example:**
- Previous score: 50
- New score: 70
- `smoothedScore = 0.3 * 70 + 0.7 * 50 = 21 + 35 = 56`

### 3. No Recent Activity Regime

**Purpose:** Prevents score from dropping to 0 when debt exists but activity is older than 10 seconds.

**Implementation:**
```javascript
if (recentSuggestions.length === 0) {
  if (hasPending) {
    // Keep baseline elevated if pending suggestions exist
    currentScore = min(50 + debtScore, 100)
  } else if (debtScore > 0) {
    // Normalize debt to 0-100 scale
    currentScore = round(clamp(100 * debtScore / 30, 0, 100))
  } else {
    currentScore = 0  // Truly no activity
  }
}
```

This ensures the meter doesn't "snap back" to green while debt/pending reviews are still outstanding.

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

**Example:**
- Score = 57
- `filled = round((57/100) * 7) = 4`
- Meter = `▰▰▰▰▱▱▱`

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

Displays:
- Total score: `57/100`
- Component scores:
  - Review: `32/40`
  - Blind Acceptance Risk: `15/30`
  - Adaptation: `15/30`
  - Debt: `11/30`
- Suggestion counts:
  - Total: `25`
  - Accepted: `12`
  - Adapted: `5`
  - Rejected: `6`
  - Pending: `2`
- Debt files list (if any)
- Last activity timestamp
- Monitoring status

---

## Key Constants & Thresholds

### Time Windows
- `DEFAULT_RECENT_WINDOW_MS = 10,000` (10 seconds) - Recent activity detection
- `SCORING_HORIZON_MS = 900,000` (15 minutes) - Extended horizon for stability
- `SCORING_HORIZON_COUNT = 20` - Count-based horizon (last N resolved)

### Smoothing
- `EMA_ALPHA = 0.3` - Exponential moving average smoothing factor

### Review Detection
- `MINIMUM_REVIEW_TIME = 5,000` (5 seconds) - Minimum review time to clear debt
- `MAX_REVIEW_TIME_MS = 60,000` (60 seconds) - Cap per-suggestion review time
- `ENGAGEMENT_TIMEOUT_MS = 5,000` (5 seconds) - Idle timeout for review accumulation

### Score Ranges
- **Review Score**: 0-40 points (higher = better, converted to risk)
- **Blind Acceptance Risk**: 0-30 points (higher = worse)
- **Adaptation Score**: 0-30 points (higher = better, converted to risk)
- **Debt Score**: 0-30 points (higher = worse)
- **RiskScore (final)**: 0-100 points (higher = worse, weighted combination)

### UI Thresholds
- **🟢 Green**: 0-39 (good: careful review)
- **🟡 Yellow**: 40-59 (caution: moderate)
- **🟠 Orange**: 60-79 (warning: too trusting)
- **🔴 Red**: 80-100 (danger: blind acceptance)

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

## Overlap Analysis

### Conceptual Overlap Between Components

There is **functional and conceptual overlap** between the three behavioral scores:

#### 1. Review Score vs. Blind Acceptance Risk

**Overlap:**
- **Review Score** measures **process** (did you review? how long?)
- **Blind Acceptance Risk** measures **outcome** (did you accept or reject?)

**Expected Correlation:**
- High Review Score (careful review) → Should correlate with Low Blind Acceptance Risk (selective acceptance)
- Low Review Score (no review) → Should correlate with High Blind Acceptance Risk (blind acceptance)

**Current Implementation:**
- These are **calculated independently** - no cross-referencing
- A user could have:
  - High Review Score (reviewed everything) + High Blind Acceptance Risk (accepted everything anyway)
  - Low Review Score (no review) + Low Blind Acceptance Risk (rejected everything)

**Issue:** The scores don't validate each other. Review Score doesn't check if you actually made selective decisions after reviewing.

#### 2. Adaptation Score vs. Blind Acceptance Risk

**Overlap:**
- **Adaptation Score** measures **customization** (did you edit what you accepted?)
- **Blind Acceptance Risk** measures **acceptance rate** (did you accept or reject?)

**Expected Correlation:**
- High Adaptation Score (customized everything) → Should correlate with Low Blind Acceptance Risk (not blindly accepting)
- If you adapt/customize, you're by definition not blindly accepting

**Current Implementation:**
- These are **calculated independently**
- `status === 'adapted'` means you accepted AND edited
- Blind Acceptance Risk only counts `status === 'accepted'` (NOT adapted)
- So adapted suggestions contribute to Adaptation Score but NOT to Blind Acceptance Risk

**Issue:** This creates a conceptual gap: if you adapt everything (high Adaptation Score), you're not blindly accepting, but Blind Acceptance Risk only looks at pure "accepted" vs "rejected". The scores don't communicate that adaptation is a form of careful acceptance.

#### 3. Review Score vs. Adaptation Score

**Overlap:**
- **Review Score** measures **review engagement** (time spent, reviewed flag)
- **Adaptation Score** measures **customization** (edits made)

**Expected Correlation:**
- High Review Score (thorough review) → Could correlate with High Adaptation Score (more likely to customize after review)
- But these measure different things: one is process (review), one is outcome (editing)

**Current Implementation:**
- These are **independent** - you can review without adapting, or adapt without reviewing (though less likely)

### Improvements Implemented (2026-01-19)

1. **✅ Integrated Review with Blind Acceptance Risk:**
   - Blind Acceptance Risk now measures "accepted without review" vs "accepted after review"
   - Heavy penalty (30 points) for accepting without review
   - Mild penalty (10 points) for accepting after review
   - This makes Blind Acceptance Risk accurate: "blind" = accepted without review

2. **✅ Excluded Adapted from Blind Acceptance Risk:**
   - Adapted suggestions are NOT counted as "accepted" in Blind Acceptance Risk
   - Adaptation reduces risk (mitigation, -5 points per 10% adapted)
   - Adaptation shows engagement, not blind acceptance

3. **✅ Weighted Combination:**
   - Uses weighted combination with weights summing to 1.0
   - Review and Adaptation are converted to risk before summing
   - Prevents double-penalizing careful reviewers who accept after review
   - Direct 0-100 mapping (no 130→100 normalization needed)

### Current State (Updated 2026-01-19)

The scores are now **converted to risk and combined using weighted sum**:

```javascript
// Convert "good" scores to risk
reviewRisk = 40 - reviewScore;        // Higher review = lower risk
adaptationRisk = 30 - adaptationScore; // Higher adaptation = lower risk

// Weighted combination (weights sum to 1.0)
riskScore = 
    RISK_WEIGHTS.review * (reviewRisk / 30) +
    RISK_WEIGHTS.blindAcceptance * (blindAcceptanceRisk / 30) +
    RISK_WEIGHTS.adaptation * (adaptationRisk / 30) +
    RISK_WEIGHTS.debt * (debtRisk / 30);

finalScore = round(riskScore * 100); // Scale to 0-100
```

**Improvements:**
- ✅ Blind Acceptance Risk now measures "accepted without review" (not just acceptance rate)
- ✅ Adapted suggestions are excluded from blind acceptance count (treated as mitigation)
- ✅ Review and Adaptation are converted to risk before summing (unified direction)
- ✅ Weighted combination prevents double-penalizing careful reviewers
- ✅ All scores use consistent semantics: higher = worse (risk)

---

## Summary

The awareness score algorithm is a **multi-stage, multi-component** system that:

1. **Detects** AI-generated code changes via VS Code events
2. **Tracks** suggestions through their lifecycle (pending → accepted/rejected/adapted)
3. **Monitors** review engagement (cursor movement, scroll, dwell time)
4. **Accumulates** debt for unreviewed changes (file-level and suggestion-level)
5. **Calculates** four component scores (review, blind acceptance, adaptation, debt)
6. **Converts** "good" scores to risk and combines using weighted sum
7. **Smooths** the score using EMA to prevent UI thrashing
8. **Displays** the score in the status bar with visual indicators

### Key Improvements (2026-01-19)

The algorithm now uses a **unified RiskScore** (0-100, higher = worse) that:

- **Eliminates semantic confusion**: All scores use consistent direction (higher = worse)
- **Measures actual risk**: Blind acceptance now measures "accepted without review" instead of just acceptance rate
- **Prevents gaming**: Review depth is size-aware (time per 1000 chars) instead of time per suggestion
- **Direct mapping**: Weights sum to 1.0, no need for 130→100 normalization
- **Better accuracy**: Provenance multiplier only applies to confident AI classifications (>0.7)

The system is designed for **stability** (extended horizon, EMA smoothing) and **accuracy** (risk-based debt calculation, file criticality weighting) while remaining **responsive** to recent activity (10-second window for activity detection).

**See also:** `docs/SCORE-ALGORITHM-IMPROVEMENTS.md` for detailed change log.
