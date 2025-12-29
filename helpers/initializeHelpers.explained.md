# How `initializeHelpers.js` Works

## Overview
This is a **factory function** that creates helper functions with closure access to the extension's state object (DIContainer). It uses dependency injection to provide state to all helpers.

## Current Flow

### 1. **Initialization Order** (Critical - order matters!)
```
1. Create `log` helper (needed by everything)
2. Declare `updateAwarenessMeter` and `updateStatusBar` (but don't initialize yet)
3. Define helper functions that use `log`:
   - `initFileDecorations()`
   - `startAwarenessMonitor()` (uses `updateAwarenessMeter` - but it's not ready yet!)
   - `stopAwarenessMonitor()`
   - `switchToMode()` (uses `updateStatusBar` - but it's not ready yet!)
4. NOW initialize `updateAwarenessMeter` and `updateStatusBar` (line 131-132)
5. Create command handlers (use all the helpers)
6. Return everything
```

### 2. **Problems with Current Structure**

#### Problem 1: Variable Hoisting Confusion
- `updateAwarenessMeter` and `updateStatusBar` are declared with `let` but used before initialization
- Functions like `startAwarenessMonitor()` reference them, but they're undefined until line 131-132
- This works because functions are called AFTER initialization, but it's confusing to read

#### Problem 2: Circular Dependencies
- `updateStatusBar` depends on `updateAwarenessMeter`
- `switchToMode` depends on `updateStatusBar`
- `startAwarenessMonitor` depends on `updateAwarenessMeter`
- All must be initialized in the right order

#### Problem 3: Mixed Concerns
- Initialization logic
- Helper function definitions
- Command handler definitions (260+ lines!)
- All in one 400+ line file

#### Problem 4: Global State
- `DISABLE_LOGGING` is a module-level variable
- Modified inside the function, which is confusing

#### Problem 5: Command Handlers Too Long
- 260+ lines of command handler code
- Should be extracted to separate file

## How It's Used

```javascript
// In extension.js:
const state = new DIContainer();
const helpers = initializeHelpers(state, DISABLE_LOGGING);
const { log, updateStatusBar, commandHandlers } = helpers;

// Later:
helpers.startAwarenessMonitor();
helpers.switchToMode('dev');
```

## Proposed Improvements

1. **Extract command handlers** to separate file
2. **Initialize helpers in clear order** with explicit sections
3. **Remove global variable** - pass as parameter
4. **Add clear documentation** about initialization order
5. **Group related helpers** together
6. **Use const instead of let** where possible

