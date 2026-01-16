# App Directory Functional Organization Proposal

## Main Functional Areas Identified

Based on the codebase analysis, the awareness module has these main functional areas:

1. **Classification** - Change classification (AI/user/formatter detection) ✅ Already organized
2. **Suggestions** - Suggestion lifecycle management
3. **Debt** - Review debt tracking and management
4. **Sessions** - Review session tracking
5. **Scoring** - Awareness score calculation
6. **Persistence** - Change persistence and ledger
7. **Utilities** - Shared utility functions

## Proposed Structure

```
business_modules/awareness/app/
├── awarenessEngine.js          (Core orchestrator - stays at root)
│
├── classification/              (✅ Already organized)
│   ├── changeClassifier.js
│   ├── changeAggregator.js
│   ├── configManager.js
│   ├── classificationScorer.js
│   ├── reasonFilter.js
│   ├── versionDriftHandler.js
│   └── detectors/
│       └── ...
│
├── suggestions/                 (Suggestion lifecycle management)
│   ├── suggestionLifecycleService.js
│   └── suggestionStatusScheduler.js
│
├── debt/                        (Review debt management)
│   └── debtService.js
│
├── sessions/                    (Review session tracking)
│   └── sessionService.js
│
├── scoring/                     (Awareness score calculation)
│   ├── scoreCalculations.js
│   └── classificationConfig.js (if score-related)
│
├── persistence/                 (Change persistence and ledger)
│   └── changeLedgerService.js
│
└── utilities/                   (Shared utility functions)
    ├── rangeUtilities.js
    ├── uriPathUtilities.js
    ├── vscodeDocUtilities.js
    ├── diffBulletService.js
    └── timerRegistry.js
```

## Rationale

### 1. `classification/` ✅
**Purpose**: Change classification logic (AI/user/formatter detection)
**Status**: Already well-organized - keep as is

### 2. `suggestions/` 
**Purpose**: Suggestion lifecycle management
**Files:**
- `suggestionLifecycleService.js` - Main service for suggestion lifecycle
- `suggestionStatusScheduler.js` - Status check scheduling

**Why together:**
- Both deal with suggestion lifecycle
- Scheduler is specifically for suggestions
- Clear functional boundary

### 3. `debt/`
**Purpose**: Review debt tracking and management
**Files:**
- `debtService.js` - Debt management service

**Why separate:**
- Distinct functional area (debt vs suggestions)
- Could expand with debt policies, calculations, etc.

### 4. `sessions/`
**Purpose**: Review session tracking
**Files:**
- `sessionService.js` - Session management service

**Why separate:**
- Distinct functional area (sessions vs suggestions vs debt)
- Could expand with session policies, analytics, etc.

### 5. `scoring/`
**Purpose**: Awareness score calculation
**Files:**
- `scoreCalculations.js` - Pure score calculation functions
- `classificationConfig.js` - If score-related (or could stay in classification/)

**Why separate:**
- Distinct functional area (scoring vs classification)
- Could expand with score policies, weights, etc.

### 6. `persistence/`
**Purpose**: Change persistence and ledger
**Files:**
- `changeLedgerService.js` - Change persistence service

**Why separate:**
- Distinct functional area (persistence vs business logic)
- Could expand with persistence strategies, caching, etc.

### 7. `utilities/`
**Purpose**: Shared utility functions used across multiple areas
**Files:**
- `rangeUtilities.js` - Range operations
- `uriPathUtilities.js` - URI/path operations
- `vscodeDocUtilities.js` - VS Code document utilities
- `diffBulletService.js` - Diff bullet generation
- `timerRegistry.js` - Timer management (used by multiple services)

**Why together:**
- Shared across multiple functional areas
- Pure utility functions
- No business logic dependencies

## Alternative: Combine Related Areas

If you want fewer directories, you could combine:

```
app/
├── awarenessEngine.js
├── classification/     (Keep as is)
├── suggestions/         (Suggestion lifecycle)
├── review/              (Debt + Sessions - both about review)
│   ├── debtService.js
│   └── sessionService.js
├── scoring/             (Score calculation)
├── persistence/         (Change persistence)
└── utilities/           (Shared utilities)
```

## Recommendation

**Use the 7-subdirectory structure** because:
1. **Clear functional boundaries** - Each area is distinct
2. **Scalable** - Easy to add files to appropriate area
3. **Matches domain concepts** - Aligns with business language
4. **Parallel to classification/** - Consistent organization pattern

## Migration Impact

**Files to move:**
- `suggestionLifecycleService.js` → `suggestions/`
- `suggestionStatusScheduler.js` → `suggestions/`
- `debtService.js` → `debt/`
- `sessionService.js` → `sessions/`
- `scoreCalculations.js` → `scoring/`
- `changeLedgerService.js` → `persistence/`
- `rangeUtilities.js` → `utilities/`
- `uriPathUtilities.js` → `utilities/`
- `vscodeDocUtilities.js` → `utilities/`
- `diffBulletService.js` → `utilities/`
- `timerRegistry.js` → `utilities/`
- `classificationConfig.js` → `scoring/` or keep in `classification/`

**Import updates needed:**
- Update `awarenessEngine.js` imports
- Update all service imports
- Update test file imports
