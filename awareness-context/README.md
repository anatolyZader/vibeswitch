# Awareness Module - Consolidated Context Files

This directory contains consolidated files of all code from the awareness module, organized by architectural layer. These files are designed to be used as context for ChatGPT or other AI assistants.

## Files

Files are automatically split into parts if they exceed 2000 lines:

- **`domain-consolidated-part1.js`** - Domain layer part 1 (entities, aggregates, value objects)
- **`domain-consolidated-part2.js`** - Domain layer part 2 (domain services)
- **`domain-consolidated-part3.js`** - Domain layer part 3 (ports, events, utils)
- **`input-consolidated.js`** - All input layer code (event listeners, controllers)
- **`app-consolidated-part1.js`** - Application layer part 1 (core services: AwarenessService, SuggestionService)
- **`app-consolidated-part2.js`** - Application layer part 2 (scoreCalculations, DebtService, ClassificationService, etc.)
- **`app-consolidated-part3.js`** - Application layer part 3 (SuggestionService, SuggestionStatusScheduler, TimerRegistry, utilities)
- **`infrastructure-consolidated.js`** - All infrastructure layer code (adapters)

## Usage

These files can be provided to ChatGPT or other AI assistants as context when:
- Asking questions about the awareness module architecture
- Requesting code reviews or refactoring suggestions
- Understanding how different layers interact
- Debugging issues across layers

## Regeneration

To regenerate these files after code changes, run:

```bash
node awareness-context/consolidate.js
```

## File Structure

Each consolidated file contains:
1. Header with metadata (file count, generation date)
2. All source files separated by clear markers
3. Original file paths preserved in comments

## Exclusions

The consolidation script automatically excludes:
- Test files (`*.test.js`, `test/` directories)
- Mock files (`*mock*`)
- Legacy files (`legacy/` directories)

## Size (After Architecture Simplification & Bug Fixes)

- Domain layer: ~144 KB (43 files) - split into 3 parts (max 1926 lines per part)
  - Reduced from 54 files after moving calculation services to app layer
- Input layer: ~28 KB (2 files, 781 lines) - updated with bug fixes
- App layer: ~175 KB (14 files) - split into 3 parts (max 1890 lines per part)
  - Includes: `scoreCalculations.js` (new - pure functions moved from domain)
  - Includes: `suggestionStatusScheduler.js` (new - coalescing timer scheduler)
  - Includes: `suggestionService.js` (merged review tracking and keep-all detection)
  - Removed: `reviewTrackingService.js`, `keepAllDetectorService.js` (merged into suggestionService)
- Infrastructure layer: ~21 KB (7 files, 584 lines)

**Total: ~368 KB across 66 files, split into 8 consolidated files (all ≤ 2000 lines)**

## Recent Changes (Architecture Simplification & Critical Bug Fixes)

### Architecture Simplification
- **Moved to app layer**: Score and debt calculation functions (now in `scoreCalculations.js`)
- **Consolidated services**: `ReviewTrackingService` and `KeepAllDetectorService` merged into `SuggestionService`
- **Removed domain services**: `DebtCalculationServiceD`, `ScoreCalculationServiceD`, `ReviewSessionServiceD`, `SuggestionBatchServiceD`, `SuggestionLifecycleServiceD` (now pure functions or merged)
- **Simplified domain layer**: Only keeps services that protect invariants or contain domain logic

### Critical Bug Fixes
- **Timer unification**: All timers now go through `TimerRegistry` with coalescing scheduler (`SuggestionStatusScheduler`)
- **KeepAll event bug**: Fixed `result.count` → `result.acceptanceCount`
- **Input layer bugs**: 
  - Removed missing `handleDocumentClose()` call (was causing TypeError)
  - Fixed unhandled promise rejections in `onFilesCreated()` (was causing crashes)
  - Improved save cache strategy (uri + contentHash instead of version)
  - Unified input validation (controller is single authority)
