# Difference Between `createLogger` and `createLogFunction`

## Quick Answer

- **`createLogger(outputChannel)`**: Creates/initializes the **singleton logger instance** (the actual logger object)
- **`createLogFunction()`**: Creates a **wrapper function** that calls the singleton logger (convenience interface)

## Detailed Comparison

### `createLogger(outputChannel)`

**Purpose**: Initialize the singleton `ThrottledLogger` instance

**Signature**:
```javascript
function createLogger(outputChannel) {
    loggerInstance = new ThrottledLogger(outputChannel);
    return loggerInstance;
}
```

**What it does**:
- Creates a new `ThrottledLogger` instance
- Stores it as a singleton (`loggerInstance`)
- Connects it to a VS Code output channel
- Returns the logger instance

**Returns**: `ThrottledLogger` instance (the actual logger object)

**When to use**: **Once** during extension activation to set up logging

**Example usage**:
```javascript
// In extension.js activation
const outputChannel = vscode.window.createOutputChannel('VibeSwitch');
createLogger(outputChannel);  // Initialize singleton logger
```

**What you get**:
```javascript
const logger = createLogger(outputChannel);
logger.log('Message', true, false);  // Direct access to ThrottledLogger
logger.error('Error');               // Can use all ThrottledLogger methods
```

---

### `createLogFunction()`

**Purpose**: Create a simple wrapper function for extension-level code

**Signature**:
```javascript
function createLogFunction() {
    const logger = getLogger();  // Gets the singleton logger
    return (message, force = false, show = false) => {
        if (logger) {
            logger.log(message, force, show);
        }
    };
}
```

**What it does**:
- Gets the singleton logger (created by `createLogger`)
- Returns a simple function that wraps `logger.log()`
- Provides a convenient interface for extension-level code

**Returns**: `Function` - A simple log function

**When to use**: When you need a simple `log()` function for extension-level code

**Example usage**:
```javascript
// In extension.js or initializeHelpers.js
const log = createLogFunction();
log('VibeSwitch: Started');           // Simple call
log('ERROR: Failed', true, true);     // Error that should be shown
```

**What you get**:
```javascript
const log = createLogFunction();
log('Message');              // Simple function call
log('Error', true, true);   // With parameters
// log.error() - NOT available (it's just a function, not an object)
```

---

## Key Differences

| Aspect | `createLogger()` | `createLogFunction()` |
|--------|------------------|----------------------|
| **Returns** | `ThrottledLogger` instance (object) | `Function` |
| **Purpose** | Initialize singleton logger | Create convenience wrapper |
| **When called** | Once during activation | Multiple times (creates new function each time) |
| **Access to** | All `ThrottledLogger` methods | Only `log()` method |
| **Usage** | `logger.log()`, `logger.error()`, etc. | `log()` function calls |
| **Dependencies** | Requires `outputChannel` | Requires logger to be initialized first |

---

## Relationship

```
┌─────────────────────────────────────────┐
│  Extension Activation                   │
└─────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  createLogger(outputChannel)           │
│  → Creates ThrottledLogger singleton   │
│  → Stores in loggerInstance            │
└─────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  createLogFunction()                   │
│  → Calls getLogger()                   │
│  → Returns wrapper function            │
└─────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  log('Message')                         │
│  → Calls logger.log() internally       │
└─────────────────────────────────────────┘
```

---

## Why Two Functions?

### `createLogger()` - Infrastructure Setup
- Sets up the logging infrastructure
- Connects to VS Code output channel
- Creates the singleton that everything uses
- **Called once** during extension activation

### `createLogFunction()` - Convenience Interface
- Provides a simple function interface
- Hides the complexity of the logger object
- Makes it easy to log from extension-level code
- **Can be called multiple times** (each call returns a new function)

---

## Real-World Usage

### In `extension.js`:

```javascript
// Step 1: Initialize logger infrastructure (once)
const outputChannel = vscode.window.createOutputChannel('VibeSwitch');
createLogger(outputChannel);  // Creates singleton logger

// Step 2: Create convenience function for extension code
const log = createLogFunction();  // Wraps the singleton logger

// Step 3: Use the simple function
log('VibeSwitch: Extension activated');
log('ERROR: Something failed', true, true);
```

### In `initializeHelpers.js`:

```javascript
// Also creates a log function (uses the same singleton logger)
const { createLogFunction } = require('../logger');
const log = createLogFunction();  // Same singleton, new function wrapper

log('Helper initialized');
```

---

## Summary

- **`createLogger()`**: "Set up the logger" (infrastructure)
- **`createLogFunction()`**: "Give me a simple log function" (convenience)

Both use the same underlying singleton logger, but provide different interfaces:
- `createLogger()` → Full `ThrottledLogger` object with all methods
- `createLogFunction()` → Simple `log()` function wrapper
