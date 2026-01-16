# extension.js Logging Code - Detailed Analysis

## Overview

This document analyzes all logging-related code in `extension.js` and evaluates whether it should be extracted to `logger.js`.

---

## Current Logging Code in extension.js

### 1. `getDisableLogging(context)` Function (Lines 17-25)

```javascript
function getDisableLogging(context) {
    const config = vscode.workspace.getConfiguration('vibeswitch');
    // Default to false (enable logging) unless explicitly disabled
    // Can be overridden by NODE_ENV=production
    if (process.env.NODE_ENV === 'production') {
        return true;
    }
    return config.get('disableLogging', false);
}
```

**Purpose**: Reads logging preference from VS Code settings and environment variables.

**What it does:**
1. Gets VS Code configuration for `vibeswitch` extension
2. Checks `NODE_ENV` environment variable (production = disable)
3. Falls back to VS Code setting `vibeswitch.disableLogging` (default: false)

**Dependencies:**
- `vscode.workspace.getConfiguration()` - VS Code API
- `process.env.NODE_ENV` - Node.js environment variable

**Should be extracted?** ✅ **YES**
- **Reason**: This is pure logging configuration logic
- **Location**: Should be in `logger.js` as `getDisableLoggingFromConfig(context)`
- **Benefit**: Centralizes all logging configuration in one place

---

### 2. Logger Initialization (Lines 156-190)

```javascript
// Initialize output channel using direct VS Code API
state.outputChannel = vscode.window.createOutputChannel('VibeSwitch');
context.subscriptions.push(state.outputChannel);

// Get logging preference from settings
const disableLogging = getDisableLogging(context);

// Initialize logger with output channel and set logging preference centrally
createLogger(state.outputChannel);
setDisableLogging(disableLogging);

// Get logger function for error reporting
const rawLogger = getLogger();

// Normalize logger interface for controllers/services (simple error/info methods)
const normalizedLogger = {
    error: (message, error = null) => {
        if (rawLogger) {
            const errorMessage = error ? `${message}: ${error.message || error}` : message;
            rawLogger.log(errorMessage, true, false);
        }
    },
    info: (message) => {
        if (rawLogger) {
            rawLogger.log(message, false, false);
        }
    }
};

// Legacy log function for extension-level code
log = (message, showOutput = false, isError = false) => {
    if (rawLogger) {
        rawLogger.log(message, isError, showOutput);
    }
};
```

**Purpose**: Initializes the logging system and creates logger interfaces.

**What it does:**
1. Creates VS Code output channel
2. Gets logging preference
3. Initializes logger singleton
4. Creates `normalizedLogger` object (for controllers/services)
5. Creates `log` function (for extension-level code)

---

### 3. `normalizedLogger` Object (Lines 171-183)

```javascript
const normalizedLogger = {
    error: (message, error = null) => {
        if (rawLogger) {
            const errorMessage = error ? `${message}: ${error.message || error}` : message;
            rawLogger.log(errorMessage, true, false);
        }
    },
    info: (message) => {
        if (rawLogger) {
            rawLogger.log(message, false, false);
        }
    }
};
```

**Purpose**: Provides a simple logger interface for controllers/services.

**Interface:**
- `error(message, error?)` - Logs error message (with optional error object)
- `info(message)` - Logs info message

**Where it's used:**
- Passed to `AwarenessController` constructor (line 258)
- Only used in one place

**Issues:**
1. **Duplication**: `normalizedLogger.error()` does the same thing as `ThrottledLogger.error()`
2. **Inline creation**: Created inline in `extension.js` instead of being a factory function
3. **Inconsistent**: `ThrottledLogger` already has `error()` method, but we're creating a wrapper

**Should be extracted?** ✅ **YES**
- **Reason**: This is logger interface creation logic
- **Location**: Should be in `logger.js` as `createNormalizedLogger()`
- **Benefit**: Reusable, testable, consistent with logger.js API

---

### 4. `log` Function (Lines 186-190)

```javascript
log = (message, showOutput = false, isError = false) => {
    if (rawLogger) {
        rawLogger.log(message, isError, showOutput);
    }
};
```

**Purpose**: Legacy log function for extension-level code.

**Interface:**
- `log(message, showOutput?, isError?)` - Logs message with optional flags

**Where it's used:**
- Throughout `extension.js` for logging
- Passed to `registerCommands()` and other functions
- Used in `initializeHelpers()` (via closure)

**Issues:**
1. **Parameter order**: `log(message, showOutput, isError)` but `rawLogger.log(message, force, show)` - different order!
2. **Inline creation**: Created inline instead of being a factory function
3. **Inconsistent naming**: `showOutput` vs `show`, `isError` vs `force`

**Should be extracted?** ✅ **YES**
- **Reason**: This is logger interface creation logic
- **Location**: Should be in `logger.js` as `createLegacyLogFunction()`
- **Benefit**: Reusable, consistent parameter naming

---

## What's Already in logger.js

### Current API:

```javascript
// Factory functions
createLogger(outputChannel)  // Creates singleton logger
getLogger()                  // Gets singleton logger
setDisableLogging(disabled)  // Sets global disable flag

// ThrottledLogger class methods
logger.log(message, force, show, sourceKey)
logger.error(message, show)
logger.warn(message, show)
logger.debug(message, show, sourceKey)
```

### What's Missing:

1. ❌ `getDisableLogging(context)` - Configuration reading
2. ❌ `createNormalizedLogger()` - Simple interface factory
3. ❌ `createLegacyLogFunction()` - Legacy interface factory

---

## Analysis: Should We Extract?

### ✅ **YES - Extract All Logging Code**

**Reasons:**

1. **Separation of Concerns**
   - Logging logic belongs in `logger.js`, not `extension.js`
   - `extension.js` should orchestrate, not implement logging details

2. **Reusability**
   - `normalizedLogger` could be used by other controllers
   - `log` function could be used by other extension-level code
   - `getDisableLogging()` could be used during testing

3. **Testability**
   - Factory functions in `logger.js` can be unit tested
   - Inline code in `extension.js` is harder to test

4. **Consistency**
   - All logger-related code in one place
   - Consistent API and naming conventions

5. **Maintainability**
   - Changes to logger interfaces only require updating `logger.js`
   - No need to modify `extension.js` for logger changes

---

## Proposed Refactoring

### Step 1: Extract `getDisableLogging()` to logger.js

```javascript
// logger.js

/**
 * Get logging preference from VS Code settings
 * @param {vscode.ExtensionContext} context - Extension context
 * @returns {boolean} True if logging should be disabled
 */
function getDisableLoggingFromConfig(context) {
    const vscode = require('vscode');
    const config = vscode.workspace.getConfiguration('vibeswitch');
    // Default to false (enable logging) unless explicitly disabled
    // Can be overridden by NODE_ENV=production
    if (process.env.NODE_ENV === 'production') {
        return true;
    }
    return config.get('disableLogging', false);
}
```

### Step 2: Extract `createNormalizedLogger()` to logger.js

```javascript
// logger.js

/**
 * Create a normalized logger interface for controllers/services
 * Provides simple error/info methods
 * @returns {Object} Logger interface with error() and info() methods
 */
function createNormalizedLogger() {
    const logger = getLogger();
    return {
        error: (message, error = null) => {
            if (logger) {
                const errorMessage = error ? `${message}: ${error.message || error}` : message;
                logger.log(errorMessage, true, false); // force=true, show=false
            }
        },
        info: (message) => {
            if (logger) {
                logger.log(message, false, false);
            }
        }
    };
}
```

**Note**: This duplicates `ThrottledLogger.error()` functionality. We could:
- **Option A**: Use `ThrottledLogger.error()` directly (simpler)
- **Option B**: Keep `createNormalizedLogger()` for backward compatibility

### Step 3: Extract `createLegacyLogFunction()` to logger.js

```javascript
// logger.js

/**
 * Create legacy log function for extension-level code
 * @returns {Function} Log function with signature: log(message, showOutput, isError)
 */
function createLegacyLogFunction() {
    const logger = getLogger();
    return (message, showOutput = false, isError = false) => {
        if (logger) {
            // Map parameters: log(message, showOutput, isError) -> logger.log(message, force, show)
            logger.log(message, isError, showOutput);
        }
    };
}
```

**Note**: Parameter order is different:
- Legacy: `log(message, showOutput, isError)`
- Logger: `logger.log(message, force, show)`

This mapping is intentional for backward compatibility.

### Step 4: Update extension.js

```javascript
// extension.js

const { 
    createLogger, 
    setDisableLogging, 
    getLogger,
    getDisableLoggingFromConfig,  // NEW
    createNormalizedLogger,        // NEW
    createLegacyLogFunction        // NEW
} = require('./logger');

// In activate() function:
// Initialize output channel
state.outputChannel = vscode.window.createOutputChannel('VibeSwitch');
context.subscriptions.push(state.outputChannel);

// Get logging preference and initialize logger
const disableLogging = getDisableLoggingFromConfig(context);
createLogger(state.outputChannel);
setDisableLogging(disableLogging);

// Create logger interfaces
const normalizedLogger = createNormalizedLogger();
const log = createLegacyLogFunction();
```

---

## Benefits of Extraction

### 1. **Cleaner extension.js**
- Removes ~40 lines of logging setup code
- Focuses on orchestration, not implementation

### 2. **Reusable Logger Interfaces**
- `createNormalizedLogger()` can be used by any controller
- `createLegacyLogFunction()` can be used by any extension-level code

### 3. **Testable**
- Factory functions can be unit tested independently
- Can test logger interfaces without activating extension

### 4. **Consistent API**
- All logger-related code in one module
- Consistent naming and behavior

### 5. **Easier Maintenance**
- Changes to logger interfaces only require updating `logger.js`
- No need to modify `extension.js` for logger changes

---

## Potential Issues

### Issue 1: `getDisableLogging()` requires `vscode` module

**Problem**: `logger.js` would need to `require('vscode')` which creates a dependency.

**Solution**: 
- Accept `vscode` as parameter: `getDisableLoggingFromConfig(vscode, context)`
- OR: Require `vscode` inside the function (acceptable since it's only called during activation)

**Recommendation**: Require `vscode` inside the function (simpler, only called once).

### Issue 2: `normalizedLogger` duplicates `ThrottledLogger.error()`

**Problem**: `ThrottledLogger` already has `error()` method, but we're creating a wrapper.

**Options:**
- **Option A**: Remove `normalizedLogger`, use `ThrottledLogger` directly
  - **Pros**: Simpler, no duplication
  - **Cons**: Controllers need to know about `ThrottledLogger` API
- **Option B**: Keep `normalizedLogger` for backward compatibility
  - **Pros**: Controllers have simple interface
  - **Cons**: Duplication, but minimal

**Recommendation**: **Option B** - Keep `normalizedLogger` for now, but document that it's a compatibility layer.

### Issue 3: Parameter order inconsistency

**Problem**: `log(message, showOutput, isError)` vs `logger.log(message, force, show)` - different parameter order.

**Solution**: The mapping in `createLegacyLogFunction()` handles this correctly.

---

## Recommended Refactoring Plan

### Phase 1: Extract to logger.js (Low Risk)

1. ✅ Extract `getDisableLoggingFromConfig()` to `logger.js`
2. ✅ Extract `createNormalizedLogger()` to `logger.js`
3. ✅ Extract `createLegacyLogFunction()` to `logger.js`
4. ✅ Update `extension.js` to use new functions
5. ✅ Test that extension still activates correctly

### Phase 2: Simplify (Optional, Future)

1. Consider removing `normalizedLogger` if controllers can use `ThrottledLogger` directly
2. Consider standardizing parameter order across all logger interfaces
3. Consider creating a single `createLoggerInterface(type)` factory

---

## Summary

**Current State:**
- ~40 lines of logging setup code in `extension.js`
- Inline creation of logger interfaces
- Configuration reading mixed with activation logic

**Proposed State:**
- All logging code in `logger.js`
- Factory functions for logger interfaces
- Cleaner `extension.js` focused on orchestration

**Recommendation:** ✅ **Extract all logging code to logger.js**

**Benefits:**
- Better separation of concerns
- Reusable logger interfaces
- Testable factory functions
- Easier maintenance
- Cleaner extension.js
