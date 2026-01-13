# Architecture Simplification Analysis

## The Core Question: "If a layer/service doesn't protect an invariant, it's overhead"

### What is an Invariant?

An **invariant** is a rule that must **always be true** for your system to be correct, regardless of:
- Event ordering
- Multiple event firings
- Extension restarts
- Concurrent operations

### The Litmus Test

A service/layer protects an invariant when it:
- ✅ Is the **single writer** for some state
- ✅ Validates inputs and **rejects/normalizes** invalid transitions
- ✅ Enforces **ordering, idempotency, and concurrency** rules
- ✅ Makes rules **explicit** (state machine), not "best effort"

If it only:
- ❌ Forwards calls
- ❌ Formats objects
- ❌ Wraps APIs without adding safety rules

Then it's **overhead**.

---

## Current Architecture Inventory

### App Layer Services (11 total)

| Service | Protects Invariant? | What Invariant? | Verdict |
|---------|-------------------|-----------------|---------|
| **AwarenessService** | ✅ Yes | Lifecycle (start/stop), timer cancellation | **Keep** - Main orchestrator |
| **SuggestionService** | ✅ Yes | Single authority for suggestion state mutations | **Keep** - We just fixed this |
| **SuggestionAggregate** | ✅ Yes | Suggestion state machine (pending→accepted/rejected/adapted) | **Keep** - Core domain |
| **TimerRegistry** | ✅ Yes | Timers can't mutate after stop() | **Keep** - Critical for zombie timers |
| **DebtService** | ⚠️ Partial | File-level debt state, but not fully consistent with suggestions | **Merge** - Should be projection of suggestions |
| **SessionService** | ✅ Yes | At most one active review session per file URI | **Keep** - Enforces exclusivity |
| **ReviewTrackingService** | ❌ No | Only emits signals, doesn't own state | **Merge** - Into SuggestionService |
| **ScoreService** | ❌ No | Orchestration only, no state protection | **Merge** - Into AwarenessService |
| **KeepAllDetectorService** | ❌ No | Pattern detection, no state protection | **Merge** - Into SuggestionService |
| **ClassificationService** | ⚠️ Partial | Debouncing, but no invariant protection | **Keep** - Needed for performance |
| **ChangeLedgerService** | ✅ Yes | Change persistence with buffering/flushing | **Keep** - Persistence boundary |
| **FileWatcherService** | ❌ No | Mostly NO-OP now | **Delete** - Already removed fs.watch |

### Domain Layer Services (8 total)

| Service | Protects Invariant? | What Invariant? | Verdict |
|---------|-------------------|-----------------|---------|
| **SuggestionLifecycleServiceD** | ✅ Yes | Legal state transitions | **Keep** - Core domain logic |
| **ChangeClassificationServiceD** | ✅ Yes | Classification rules | **Keep** - Core domain logic |
| **DebtCalculationServiceD** | ❌ No | Pure calculation | **Convert** - To pure function |
| **ScoreCalculationServiceD** | ❌ No | Pure calculation | **Convert** - To pure function |
| **SuggestionBatchServiceD** | ⚠️ Partial | Batch operations, but aggregate owns state | **Keep** - Batch logic is domain |
| **ReviewSessionServiceD** | ❌ No | Pure calculation | **Convert** - To pure function |
| **RangeOperationServiceD** | ❌ No | Pure utility (rangesOverlap, isPositionInRange) | **Convert** - To module functions |
| **UriPathOperationServiceD** | ⚠️ Partial | Validation (isCodeDocument, isSkippableUri) | **Keep** - Domain validation |

### Utilities (3 total)

| Utility | Protects Invariant? | Verdict |
|---------|-------------------|---------|
| **VSCodeUtilities** | ❌ No | Thin wrappers | **Delete** - Use VS Code API directly |
| **RangeUtilities** | ❌ No | Pure functions | **Keep** - But as module functions, not class |
| **UriPathUtilities** | ❌ No | Pure functions | **Keep** - But as module functions, not class |

---

## Real Invariants in This Extension

### 1. Suggestion Lifecycle State Machine
**Invariant**: A suggestion can't be both `pending` and `accepted`; transitions must be legal:
- `pending` → `accepted` | `rejected` | `adapted` (and never back)

**Where to enforce**: `SuggestionAggregate` (single place that updates status)

**Current smell**: ✅ Fixed - `SuggestionService` is now single authority

### 2. Debt Ties to Unresolved Work
**Invariant**: Debt exists iff there is unreviewed AI content for that file

**Where to enforce**: One owner (either `DebtService` as projection of suggestions, or `SuggestionAggregate`)

**Current smell**: ⚠️ `DebtService` and `SuggestionService` both independently "add/clear debt" - needs consolidation

### 3. Review Sessions are Exclusive Per File
**Invariant**: At most one active review session per file URI

**Where to enforce**: `SessionService` (single map owner)

**Current smell**: ✅ Good - `SessionService` owns this

### 4. Timers Can't Act After Stop/Dispose
**Invariant**: After `stop()`, no scheduled callback mutates state

**Where to enforce**: `TimerRegistry` + instance ID + centralized scheduling

**Current smell**: ✅ Fixed - Generation-based cancellation implemented

### 5. Events are Idempotent / De-duped
**Invariant**: The same underlying change shouldn't create multiple "new suggestion" records

**Where to enforce**: The ingest point (`ClassificationService`/`SuggestionAggregate`) with fingerprint/idempotency key

**Current smell**: ⚠️ De-dupe scattered across watcher + suggestion service

---

## Pros and Cons Table

| Aspect | Pros (DDD-ish Layered Architecture) | Cons (for VS Code / Cursor Extensions) |
|--------|-------------------------------------|----------------------------------------|
| **Correctness under messy events** | Helps enforce invariants (idempotency, legal state transitions, "timers don't mutate after stop", single-writer state) | If not strictly single-writer, layers can create **more inconsistency** (state split across services) |
| **Testability** | Domain/app services can be unit-tested without extension host; ports make mocking easy | You may end up testing mocks + wiring more than behavior; higher test maintenance cost |
| **Change tolerance** | Easier to swap persistence/messaging/FS mechanisms behind ports | Many extensions never swap these; abstraction becomes **speculative complexity** |
| **Team scale** | Useful when multiple contributors touch same module; clear boundaries reduce accidental coupling | Solo/small project: overhead of patterns can slow iteration noticeably |
| **Debuggability** | If well-designed, logs and events are structured; easier to trace flows through a pipeline | More indirection makes "where did this state change happen?" harder in practice without excellent tracing |
| **Separation of concerns** | Keeps VS Code API usage at edges; domain stays stable | Real extension logic often is VS Code/event driven; too much separation can feel artificial |
| **Reliability across restarts** | Encourages explicit persistence boundaries and rehydration logic | More moving parts: rehydration bugs, versioning of stored data, adapter edge cases |
| **Extensibility** | New features can plug into events/ports cleanly (e.g., telemetry, dashboards, team mode) | You might ship slower; "nice architecture" doesn't automatically mean better UX |
| **Performance** | Can centralize throttling/debouncing/rate limits; avoids repeated work | Extra allocations, maps, wrappers, and frequent serialization can add overhead (usually minor, but can matter in large workspaces) |
| **Cognitive load** | Clear mental model if invariants and ownership are documented | High learning curve; future-you may forget why a layer exists and bypass it |
| **Code volume** | Forces explicit dependencies and contracts (less "mystery globals") | More files/boilerplate; PRs get bigger; refactors take longer |

---

## Simplification Recommendations

### Rule of Thumb
**Keep the complexity only around places with real invariants:**
1. Suggestion lifecycle/state machine
2. Debt consistency
3. Timer cancellation after stop
4. Deduping/out-of-order events

Everything else (utility wrappers, extra "app services" that only forward calls) is usually better collapsed into fewer modules.

### Proposed Simplifications

#### 1. Merge Services (Reduce from 11 to ~6)

**Merge into `AwarenessService`:**
- `ScoreService` → Just orchestration, no state protection
- `FileWatcherService` → Already mostly NO-OP, delete entirely

**Merge into `SuggestionService`:**
- `ReviewTrackingService` → Only emits signals, should own review state
- `KeepAllDetectorService` → Pattern detection, no separate state needed

**Keep separate:**
- `SuggestionAggregate` (domain)
- `SuggestionService` (app - single authority)
- `DebtService` (but make it projection of suggestions)
- `SessionService` (enforces exclusivity)
- `ClassificationService` (debouncing needed)
- `ChangeLedgerService` (persistence boundary)
- `TimerRegistry` (critical invariant)

#### 2. Convert Domain Services to Pure Functions

**Convert to module functions:**
- `DebtCalculationServiceD` → `calculateDebtScore(fileDebts, suggestions)`
- `ScoreCalculationServiceD` → `calculateScore(components)`
- `ReviewSessionServiceD` → `createReviewSession(data)`
- `RangeOperationServiceD` → Already mostly functions, just export directly

**Keep as services:**
- `SuggestionLifecycleServiceD` → State transition rules
- `ChangeClassificationServiceD` → Classification rules
- `SuggestionBatchServiceD` → Batch aggregation logic
- `UriPathOperationServiceD` → Domain validation

#### 3. Delete Utility Classes

**Delete:**
- `VSCodeUtilities` → Use VS Code API directly in adapters

**Convert to module functions:**
- `RangeUtilities` → `rangeUtils.js` (export functions)
- `UriPathUtilities` → `uriPathUtils.js` (export functions)

#### 4. Consolidate Debt Management

**Make `DebtService` a projection:**
- `DebtService` should derive file-level debt from `SuggestionAggregate` state
- No independent debt state - it's always computed from suggestions
- This eliminates the "two sources of truth" problem

---

## Target Architecture (Simplified)

### Domain Layer
- **Aggregates**: `SuggestionAggregate` (single writer for suggestions)
- **Entities**: `Suggestion`, `FileDebt`, `ReviewSession`, `SuggestionBatch`
- **Services** (only invariant-protecting):
  - `SuggestionLifecycleServiceD` (state transitions)
  - `ChangeClassificationServiceD` (classification rules)
  - `SuggestionBatchServiceD` (batch logic)
  - `UriPathOperationServiceD` (validation)
- **Functions** (pure calculations):
  - `calculateDebtScore(fileDebts, suggestions)`
  - `calculateScore(components)`
  - `rangesOverlap(range1, range2)`
  - `isPositionInRange(position, range)`

### Application Layer
- **AwarenessService** (main orchestrator):
  - Lifecycle management
  - Score orchestration (inline)
  - Event coordination
- **SuggestionService** (single authority):
  - Review tracking (merged from ReviewTrackingService)
  - Keep-all detection (merged from KeepAllDetectorService)
  - Status checks
  - All suggestion state mutations
- **DebtService** (projection):
  - Computes file-level debt from suggestions
  - No independent state
- **SessionService** (exclusivity):
  - One active session per file
- **ClassificationService** (debouncing):
  - Change classification with debouncing
- **ChangeLedgerService** (persistence):
  - Change persistence with buffering
- **TimerRegistry** (invariant):
  - Timer lifecycle management

### Infrastructure Layer
- Adapters (ports): VS Code, Persistence, Messaging, Logger, FileSystem, ID Generator, Hash Generator

### Input Layer
- `AwarenessEventListener` (thin - delegates to controller)
- `AwarenessController` (thin - delegates to service)

---

## Expected Impact

### Before (Current)
- **20 services** (11 app + 8 domain + 1 aggregate)
- **3 utility classes**
- **~15,000 lines** of code
- **Multiple state owners** (race conditions possible)

### After (Simplified)
- **~10 services** (6 app + 4 domain + 1 aggregate)
- **Module functions** instead of utility classes
- **~10,000 lines** of code (estimated 30% reduction)
- **Single state owners** (invariants enforced)

### Benefits
- ✅ Fewer race conditions (single writers)
- ✅ Easier to understand (fewer moving parts)
- ✅ Faster iteration (less boilerplate)
- ✅ Same correctness (invariants still protected)

### Risks
- ⚠️ Larger files (but still manageable)
- ⚠️ More coupling (but within same layer)
- ⚠️ Refactoring effort (but one-time cost)

---

## Conclusion

**Your architecture is NOT overkill** for this extension because you have:
- Long-lived state (sessions/debt/suggestions)
- Multiple asynchronous inputs (text changes, file saves, cursor moves)
- Analytics/telemetry requirements
- Testability needs

**But you CAN simplify** by:
- Merging services that don't protect invariants
- Converting pure calculations to functions
- Making debt a projection of suggestions
- Removing utility classes

**The key insight**: Keep layers/services only where they make it **structurally harder** to create bugs (invariant protection), not just for organization.
