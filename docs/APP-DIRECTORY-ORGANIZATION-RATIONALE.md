# App Directory Organization - Detailed Rationale

## Overview

This document explains the detailed reasoning behind organizing the `business_modules/awareness/app/` directory into functional subdirectories. Each subdirectory represents a distinct functional area of the awareness module, following the same organizational pattern as the existing `classification/` directory.

## Organizational Principles

### 1. **Functional Cohesion**
Files are grouped by their primary business function, not by technical type (service vs utility). This makes it easier to understand what each part of the system does.

### 2. **Consistency with Existing Structure**
The `classification/` directory was already well-organized with a clear functional boundary. The reorganization extends this pattern to other functional areas.

### 3. **Scalability**
Each subdirectory can grow independently as new features are added to that functional area.

### 4. **Discoverability**
Developers can quickly find related files by understanding the functional area they're working in.

## Subdirectory Breakdown

---

## 1. `suggestions/` - Suggestion Lifecycle Management

### Purpose
Manages the complete lifecycle of AI-generated code suggestions, from detection to final status determination.

### Files Placed Here

#### `suggestionLifecycleService.js`
**Why here:**
- **Primary responsibility**: Orchestrates the entire suggestion lifecycle (detection, tracking, status determination)
- **Core business function**: Manages how suggestions are created, tracked, and resolved
- **Dependencies**: Works closely with `SuggestionAggregate` (domain) and `DebtService`
- **Not a utility**: This is a stateful service with complex business logic, not a pure function

**Key responsibilities:**
- Detecting AI suggestions from classified changes
- Tracking user interactions (edits, adaptations)
- Determining suggestion status (accepted/rejected/adapted)
- Detecting "keep all" patterns
- Managing suggestion review tracking

#### `suggestionStatusScheduler.js`
**Why here:**
- **Primary responsibility**: Schedules status checks for suggestions
- **Tight coupling**: Specifically designed for suggestion lifecycle management
- **Not a general utility**: This scheduler is suggestion-specific, not a general-purpose scheduler
- **Co-location benefit**: Placing it with `suggestionLifecycleService.js` makes it clear they work together

**Key responsibilities:**
- Coalescing status check timers per suggestion ID
- Preventing duplicate status checks
- Managing suggestion-specific scheduling logic

### Why Not Elsewhere?

- **Not in `utilities/`**: These are stateful services with business logic, not pure utility functions
- **Not in root**: They represent a specific functional area, not the core orchestrator
- **Not in `classification/`**: Classification detects what changes are, but suggestions manage the lifecycle of AI-generated code

---

## 2. `debt/` - Review Debt Management

### Purpose
Manages review debt - tracking which files have unreviewed AI suggestions and calculating debt metrics.

### Files Placed Here

#### `debtService.js`
**Why here:**
- **Primary responsibility**: Manages review debt tracking and persistence
- **Distinct functional area**: Debt is a separate concept from suggestions (a suggestion can exist without debt, debt aggregates suggestions)
- **Future scalability**: Could expand to include debt policies, debt calculation strategies, debt visualization, etc.
- **Clear boundary**: Debt management is a well-defined business function

**Key responsibilities:**
- Tracking file-level review debt
- Persisting debt state
- Calculating debt metrics
- Triggering debt-cleared callbacks
- Updating file colors based on debt status

### Why Not Elsewhere?

- **Not in `suggestions/`**: Debt is an aggregate concept that spans multiple suggestions; it's a separate concern
- **Not in `sessions/`**: Sessions track user engagement, debt tracks unreviewed code
- **Not in `utilities/`**: This is a stateful service with persistence and business logic
- **Not in root**: It's a specific functional area, not the orchestrator

---

## 3. `sessions/` - Review Session Tracking

### Purpose
Tracks user review sessions - monitoring how users engage with files containing AI suggestions.

### Files Placed Here

#### `sessionService.js`
**Why here:**
- **Primary responsibility**: Manages review session lifecycle and engagement tracking
- **Distinct functional area**: Sessions are about user behavior, not suggestion lifecycle
- **Clear boundary**: Session tracking is a well-defined business function separate from suggestions and debt
- **Future scalability**: Could expand to include session analytics, engagement policies, session visualization, etc.

**Key responsibilities:**
- Creating and managing review sessions per file
- Tracking session metrics (duration, cursor movements, scrolls)
- Determining if sessions have sufficient engagement
- Coordinating with debt service for debt clearing
- Publishing session completion events

### Why Not Elsewhere?

- **Not in `suggestions/`**: Sessions track user behavior, not suggestion status
- **Not in `debt/`**: Sessions are about engagement, debt is about unreviewed code
- **Not in `utilities/`**: This is a stateful service with complex business logic
- **Not in root**: It's a specific functional area, not the orchestrator

---

## 4. `scoring/` - Awareness Score Calculation

### Purpose
Calculates the awareness score - the overall metric that represents how well the user is reviewing AI-generated code.

### Files Placed Here

#### `scoreCalculations.js`
**Why here:**
- **Primary responsibility**: Pure functions for calculating score components
- **Functional grouping**: All score-related calculations belong together
- **Pure functions**: These are stateless calculation functions, but they're grouped by function (scoring) not by type (utilities)
- **Future scalability**: Could expand to include score policies, score weights, score history, etc.

**Key responsibilities:**
- `calculateReviewScore()` - Calculates review component (0-40 points)
- `calculateCriticalScore()` - Calculates critical review component (0-30 points)
- `calculateAdaptationScore()` - Calculates adaptation component (0-30 points)
- `calculateDebtScore()` - Calculates debt component (0-30 points)

#### `classificationConfig.js`
**Why here:**
- **Primary responsibility**: Provides configuration for classification, which affects scoring
- **Score relationship**: Classification configuration influences how changes are classified, which affects scoring
- **Co-location benefit**: Placing it with scoring makes it clear that classification config affects scores
- **Alternative consideration**: Could go in `classification/`, but it's more about scoring thresholds than classification logic

**Key responsibilities:**
- Providing classifier configuration based on mode ('vibe' vs 'dev')
- Defining thresholds that affect scoring calculations
- Mode-specific configuration values

### Why Not Elsewhere?

- **Not in `utilities/`**: While `scoreCalculations.js` contains pure functions, they're grouped by business function (scoring), not by technical type
- **Not in root**: Scoring is a specific functional area, not the orchestrator
- **Not in `classification/`**: Classification detects what changes are; scoring calculates awareness metrics
- **`classificationConfig.js` alternative**: Could go in `classification/`, but it's more closely related to scoring thresholds

---

## 5. `persistence/` - Change Persistence and Ledger

### Purpose
Manages persistence of change data - buffering, flushing, and storing change ledger entries.

### Files Placed Here

#### `changeLedgerService.js`
**Why here:**
- **Primary responsibility**: Manages change persistence infrastructure
- **Infrastructure concern**: This is about how data is persisted, not what the data represents
- **Clear boundary**: Persistence is a distinct infrastructure concern separate from business logic
- **Future scalability**: Could expand to include persistence strategies, caching, batch optimization, etc.

**Key responsibilities:**
- Buffering change entries before persistence
- Flushing changes at intervals
- Managing change ledger persistence
- Generating hashes for change entries
- Coordinating with persistence adapter

### Why Not Elsewhere?

- **Not in `utilities/`**: This is a stateful service with infrastructure concerns, not a pure utility
- **Not in root**: It's a specific infrastructure concern, not the orchestrator
- **Not in `suggestions/` or other business areas**: Persistence is infrastructure, not business logic
- **Clear separation**: Persistence is about "how" data is stored, not "what" the data represents

---

## 6. `utilities/` - Shared Utility Functions

### Purpose
Provides pure utility functions used across multiple functional areas - technical operations without business logic.

### Files Placed Here

#### `rangeUtilities.js`
**Why here:**
- **Pure utility**: Stateless functions for range operations
- **Cross-cutting**: Used by multiple services (suggestions, sessions, classification)
- **Technical operation**: No business logic, just technical range manipulation
- **Shared resource**: Not specific to any one functional area

**Key responsibilities:**
- Range intersection calculations
- Range merging operations
- Position-in-range checks

#### `uriPathUtilities.js`
**Why here:**
- **Pure utility**: Stateless functions for URI/path operations
- **Cross-cutting**: Used by multiple services for path manipulation
- **Technical operation**: No business logic, just path/URI manipulation
- **Shared resource**: Not specific to any one functional area

**Key responsibilities:**
- URI normalization
- Path extraction
- URI validation

#### `vscodeDocUtilities.js`
**Why here:**
- **Pure utility**: Stateless functions for VS Code document operations
- **Cross-cutting**: Used by multiple services (debt, sessions, classification)
- **Technical operation**: No business logic, just VS Code API wrappers
- **Shared resource**: Not specific to any one functional area

**Key responsibilities:**
- Document type checking (code vs non-code)
- URI skippability checks
- Document validation

#### `diffBulletService.js`
**Why here:**
- **Pure utility**: Stateless functions for generating diff bullets
- **Cross-cutting**: Used by classification service and potentially others
- **Technical operation**: No business logic, just string formatting
- **Shared resource**: Not specific to any one functional area

**Key responsibilities:**
- Generating diff bullet strings
- Formatting change descriptions
- Relative path extraction

#### `timerRegistry.js`
**Why here:**
- **Infrastructure utility**: Manages timer lifecycle across the application
- **Cross-cutting**: Used by multiple services (suggestions, sessions, etc.)
- **Technical operation**: No business logic, just timer management
- **Shared resource**: Not specific to any one functional area
- **Important distinction**: While it's used by `suggestionStatusScheduler`, the registry itself is general-purpose

**Key responsibilities:**
- Creating and tracking timeouts/intervals
- Cleaning up timers on service stop
- Preventing zombie timers
- Generation-based timer cancellation

### Why Not Elsewhere?

- **Pure functions**: These are stateless utilities, not services
- **Cross-cutting**: Used by multiple functional areas
- **Technical operations**: No business logic, just technical helpers
- **Shared resources**: Not specific to any one functional area

---

## 7. `classification/` - Change Classification (Already Organized)

### Purpose
Detects and classifies code changes - determining whether changes are AI-generated, user edits, or formatter changes.

### Why Keep As-Is?

- **Already well-organized**: This directory was already structured with clear subdirectories (`detectors/`)
- **Mature structure**: The classification logic is complex enough to warrant its own directory structure
- **Clear boundary**: Classification is a distinct functional area with its own lifecycle
- **Consistency**: Other functional areas now follow this same pattern

---

## Files That Stay at Root

### `awarenessEngine.js`
**Why at root:**
- **Core orchestrator**: This is the main entry point that coordinates all functional areas
- **Composition root**: It composes all services and adapters
- **Not a functional area**: It's the orchestrator that uses all functional areas
- **Convention**: Main orchestrators typically stay at the root level

### `classificationService.js`
**Why at root:**
- **Orchestration service**: Orchestrates the classification functional area
- **Entry point**: Main entry point for classification operations
- **Coordination**: Coordinates between classification logic and other services
- **Alternative consideration**: Could go in `classification/`, but it's more of an orchestrator than classification logic itself

---

## Decision-Making Process

### Step 1: Identify Functional Areas
Analyzed the codebase to identify distinct business functions:
- Suggestion lifecycle management
- Debt tracking
- Session tracking
- Score calculation
- Change persistence
- Classification (already organized)

### Step 2: Group by Function, Not Type
Decided to group by business function rather than technical type:
- **Not**: `services/`, `utilities/`, `calculations/`
- **Instead**: `suggestions/`, `debt/`, `sessions/`, `scoring/`, `persistence/`, `utilities/`

### Step 3: Apply Consistency Principle
Followed the existing `classification/` pattern:
- Each functional area gets its own subdirectory
- Related files are co-located
- Clear boundaries between areas

### Step 4: Handle Edge Cases

#### `classificationConfig.js` - Scoring vs Classification?
**Decision**: Placed in `scoring/`
**Reasoning**: While it configures classification, it's more about scoring thresholds than classification logic. The configuration affects how scores are calculated.

#### `timerRegistry.js` - Utility vs Infrastructure?
**Decision**: Placed in `utilities/`
**Reasoning**: While it's infrastructure, it's a pure utility function (timer management) used across multiple areas. It's not business logic.

#### `suggestionStatusScheduler.js` - Suggestions vs Utilities?
**Decision**: Placed in `suggestions/`
**Reasoning**: It's specifically designed for suggestion lifecycle management, not a general-purpose scheduler. Co-locating with `suggestionLifecycleService.js` makes the relationship clear.

---

## Benefits of This Organization

### 1. **Clear Functional Boundaries**
Each subdirectory represents a distinct business function, making it easy to understand what each part does.

### 2. **Scalability**
New files can be added to the appropriate functional area without cluttering the root directory.

### 3. **Discoverability**
Developers working on a specific feature can quickly find related files by understanding the functional area.

### 4. **Maintainability**
Related code is co-located, making it easier to maintain and refactor.

### 5. **Consistency**
All functional areas follow the same organizational pattern, making the codebase predictable.

### 6. **Separation of Concerns**
Business logic (suggestions, debt, sessions, scoring) is separated from infrastructure (persistence, utilities).

---

## Alternative Organizations Considered

### Alternative 1: Type-Based Organization
```
app/
├── services/
│   ├── debtService.js
│   ├── sessionService.js
│   └── ...
├── utilities/
│   ├── rangeUtilities.js
│   └── ...
└── calculations/
    └── scoreCalculations.js
```
**Rejected because**: Doesn't reflect business functions, harder to find related files.

### Alternative 2: Flat Structure
```
app/
├── debtService.js
├── sessionService.js
├── suggestionLifecycleService.js
└── ...
```
**Rejected because**: Becomes unmanageable as the codebase grows, no clear organization.

### Alternative 3: Fewer Subdirectories
```
app/
├── business/ (suggestions, debt, sessions)
├── infrastructure/ (persistence, utilities)
└── scoring/
```
**Rejected because**: Too coarse-grained, doesn't provide enough organization.

---

## Conclusion

The functional subdirectory organization provides clear boundaries, improves discoverability, and scales well as the codebase grows. Each subdirectory represents a distinct business function, making it easy for developers to understand and navigate the codebase. The organization follows the existing `classification/` pattern, ensuring consistency across the codebase.
