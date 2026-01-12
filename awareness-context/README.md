# Awareness Module - Consolidated Context Files

This directory contains consolidated files of all code from the awareness module, organized by architectural layer. These files are designed to be used as context for ChatGPT or other AI assistants.

## Files

Files are automatically split into parts if they exceed 2000 lines:

- **`domain-consolidated-part1.js`** - Domain layer part 1 (entities, aggregates, value objects)
- **`domain-consolidated-part2.js`** - Domain layer part 2 (domain services)
- **`domain-consolidated-part3.js`** - Domain layer part 3 (domain services, ports)
- **`domain-consolidated-part4.js`** - Domain layer part 4 (events, utils)
- **`input-consolidated.js`** - All input layer code (event listeners, controllers)
- **`app-consolidated-part1.js`** - Application layer part 1 (core services)
- **`app-consolidated-part2.js`** - Application layer part 2 (utilities, additional services, review tracking)
- **`app-consolidated-part3.js`** - Application layer part 3 (timer registry, utilities)
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

## Size

- Domain layer: ~210 KB (54 files) - split into 4 parts (max 1944 lines per part)
- Input layer: ~27 KB (2 files, 764 lines) - reduced after refactoring
- App layer: ~154 KB (13 files) - split into 3 parts (max 1892 lines per part)
  - Includes: `timerRegistry.js`, `reviewTrackingService.js` (new)
- Infrastructure layer: ~20 KB (7 files, 562 lines)

**Total: ~411 KB across 76 files, split into 9 consolidated files (all ≤ 2000 lines)**
