# Legacy Log Function Analysis

## Current State

### Two Different Log Interfaces

1. **`createLegacyLogFunction()`** in `logger.js`:
   ```javascript
   log(message, showOutput, isError)
   // Maps to: logger.log(message, isError, showOutput)
   ```

2. **`initializeHelpers.js`** creates its own:
   ```javascript
   log(msg, show, force)
   // Maps to: logger.log(msg, force, show)
   ```

### Underlying Logger Signature

`ThrottledLogger.log(message, force, show)` where:
- `force` = force log even if throttled (for errors/important messages)
- `show` = show output channel to user

## Usage Patterns

### Pattern 1: Simple messages (most common)
```javascript
log('VibeSwitch: Detected initial mode from file: ${initialMode}');
log('VibeSwitch: File watcher disabled...');
```
**Current behavior**: Uses defaults `(false, false)` = not forced, not shown

### Pattern 2: Errors that should be shown
```javascript
log(errorMessage, true, true);  // showOutput=true, isError=true
log('ERROR detecting initial mode...', false, true);  // showOutput=false, isError=true
```
**Current mapping**: 
- `log(msg, true, true)` → `logger.log(msg, true, true)` = forced, shown ✅
- `log(msg, false, true)` → `logger.log(msg, true, false)` = forced, not shown ✅

### Pattern 3: Warnings
```javascript
log('WARNING: Skipping invalid command handler...', false, false);
```
**Current mapping**: `logger.log(msg, false, false)` = not forced, not shown

## The Problem

1. **Confusing parameter names**: `showOutput` and `isError` don't match `force` and `show`
2. **Inconsistent interfaces**: Two different `log` functions with different parameter orders
3. **Parameter order mismatch**: `log(message, showOutput, isError)` vs `logger.log(message, force, show)`

## Recommendation

### Option 1: Simplify to Direct Logger Access (Recommended)
Replace `createLegacyLogFunction()` with direct `getLogger().log()` calls:

```javascript
const { getLogger } = require('./logger');
const logger = getLogger();

// Instead of:
log('Error occurred', true, true);

// Use:
logger.log('Error occurred', true, true);  // force=true, show=true
```

**Pros**: 
- No wrapper confusion
- Direct access to correct parameters
- Consistent with other code

**Cons**:
- Requires updating all call sites
- More verbose

### Option 2: Create Simple Wrapper with Correct Parameters
Create a wrapper that matches `ThrottledLogger.log()` signature:

```javascript
function createLogFunction() {
    const logger = getLogger();
    return (message, force = false, show = false) => {
        if (logger) {
            logger.log(message, force, show);
        }
    };
}
```

**Pros**:
- Matches underlying signature
- No parameter mapping confusion
- Simple and clear

**Cons**:
- Still requires updating call sites (but easier migration)

### Option 3: Keep Legacy but Fix Parameter Order
Update `createLegacyLogFunction()` to use correct parameter order:

```javascript
function createLegacyLogFunction() {
    const logger = getLogger();
    return (message, force = false, show = false) => {
        if (logger) {
            logger.log(message, force, show);
        }
    };
}
```

Then update call sites:
- `log(msg, true, true)` → `log(msg, true, true)` (force, show) ✅
- `log(msg, false, true)` → `log(msg, true, false)` (force, show) ✅

**Pros**:
- Minimal changes
- Correct parameter order

**Cons**:
- Still a wrapper layer
- "Legacy" name is misleading

## Decision

**Recommended: Option 2** - Create simple wrapper with correct parameters and rename to `createLogFunction()` (remove "legacy" stigma).

This provides:
- Clear, correct parameter order
- Simple wrapper for convenience
- Easy migration path
