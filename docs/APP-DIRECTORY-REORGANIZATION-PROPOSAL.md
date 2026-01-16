# App Directory Reorganization Proposal

## Current Structure

```
business_modules/awareness/app/
├── awarenessEngine.js          (Core orchestrator)
├── debtService.js              (Application service)
├── changeLedgerService.js      (Application service)
├── sessionService.js           (Application service)
├── suggestionLifecycleService.js (Application service)
├── classificationService.js    (Application service)
├── timerRegistry.js            (Supporting service)
├── suggestionStatusScheduler.js (Supporting service)
├── rangeUtilities.js           (Utility)
├── uriPathUtilities.js         (Utility)
├── vscodeDocUtilities.js       (Utility)
├── diffBulletService.js        (Utility)
├── scoreCalculations.js        (Pure functions)
├── classificationConfig.js     (Configuration)
└── classification/             (Already organized)
    ├── changeClassifier.js
    ├── changeAggregator.js
    ├── configManager.js
    ├── classificationScorer.js
    ├── reasonFilter.js
    ├── versionDriftHandler.js
    └── detectors/
        ├── changeAnalyzer.js
        ├── markerDetector.js
        ├── formatterDetector.js
        ├── rapidScatteredDetector.js
        ├── multiLineDetector.js
        ├── pureInsertionDetector.js
        ├── largeInsertionDetector.js
        ├── scatteredEditsDetector.js
        └── smallEditsDetector.js
```

## Proposed Structure

```
business_modules/awareness/app/
├── awarenessEngine.js          (Core orchestrator - stays at root)
│
├── services/                    (Application services)
│   ├── debtService.js
│   ├── changeLedgerService.js
│   ├── sessionService.js
│   ├── suggestionLifecycleService.js
│   └── classificationService.js
│
├── utilities/                   (Pure utility functions)
│   ├── rangeUtilities.js
│   ├── uriPathUtilities.js
│   ├── vscodeDocUtilities.js
│   └── diffBulletService.js
│
├── scoring/                     (Score calculation logic)
│   ├── scoreCalculations.js
│   └── classificationConfig.js (if score-related, otherwise move to config/)
│
├── scheduling/                  (Timer and scheduling logic)
│   ├── timerRegistry.js
│   └── suggestionStatusScheduler.js
│
└── classification/              (Already organized - keep as is)
    ├── changeClassifier.js
    ├── changeAggregator.js
    ├── configManager.js
    ├── classificationScorer.js
    ├── reasonFilter.js
    ├── versionDriftHandler.js
    └── detectors/
        └── ...
```

## Rationale

### 1. `services/` - Application Services
**Purpose**: Group all application services that orchestrate business logic

**Files:**
- `debtService.js` - Debt management service
- `changeLedgerService.js` - Change persistence service
- `sessionService.js` - Review session service
- `suggestionLifecycleService.js` - Suggestion lifecycle service
- `classificationService.js` - Classification orchestration service

**Benefits:**
- Clear separation of services from utilities
- Easy to find application services
- Matches common DDD/clean architecture patterns

### 2. `utilities/` - Pure Utility Functions
**Purpose**: Group pure utility functions that don't have state

**Files:**
- `rangeUtilities.js` - Range operations
- `uriPathUtilities.js` - URI/path operations
- `vscodeDocUtilities.js` - VS Code document utilities
- `diffBulletService.js` - Diff bullet generation

**Benefits:**
- Clear distinction between services (stateful) and utilities (stateless)
- Easy to find utility functions
- Can be easily tested in isolation

### 3. `scoring/` - Score Calculation Logic
**Purpose**: Group all score-related calculation logic

**Files:**
- `scoreCalculations.js` - Pure score calculation functions
- `classificationConfig.js` - Classification configuration (if score-related)

**Benefits:**
- Centralizes score calculation logic
- Makes it clear where scoring happens
- Could expand to include score policies if needed

### 4. `scheduling/` - Timer and Scheduling Logic
**Purpose**: Group timer and scheduling-related code

**Files:**
- `timerRegistry.js` - Timer lifecycle management
- `suggestionStatusScheduler.js` - Status check scheduling

**Benefits:**
- Groups related timer/scheduling concerns
- Makes it clear where timing logic lives
- Could expand to include other scheduling needs

### 5. `classification/` - Keep As Is
**Purpose**: Already well-organized classification logic

**Status:** ✅ Already organized - no changes needed

## Alternative: Simpler Structure

If you prefer fewer directories:

```
business_modules/awareness/app/
├── awarenessEngine.js
├── services/          (All services)
│   ├── debtService.js
│   ├── changeLedgerService.js
│   ├── sessionService.js
│   ├── suggestionLifecycleService.js
│   ├── classificationService.js
│   ├── timerRegistry.js
│   └── suggestionStatusScheduler.js
├── utilities/          (All utilities)
│   ├── rangeUtilities.js
│   ├── uriPathUtilities.js
│   ├── vscodeDocUtilities.js
│   ├── diffBulletService.js
│   └── scoreCalculations.js
├── config/             (Configuration)
│   └── classificationConfig.js
└── classification/     (Keep as is)
    └── ...
```

## Recommendation

**Use the first structure (4 subdirectories)** because:
1. **Clear separation** - Services vs utilities vs scoring vs scheduling
2. **Logical grouping** - Related files are together
3. **Scalable** - Easy to add new files to appropriate directories
4. **Not too granular** - Only 4 subdirectories (manageable)

## Migration Steps

1. Create subdirectories: `services/`, `utilities/`, `scoring/`, `scheduling/`
2. Move files to appropriate directories
3. Update all imports across the codebase
4. Run tests to verify everything works
5. Update documentation

## Import Path Changes

**Before:**
```javascript
const DebtService = require('./debtService');
const RangeUtilities = require('./rangeUtilities');
const { calculateReviewScore } = require('./scoreCalculations');
```

**After:**
```javascript
const DebtService = require('./services/debtService');
const RangeUtilities = require('./utilities/rangeUtilities');
const { calculateReviewScore } = require('./scoring/scoreCalculations');
```
