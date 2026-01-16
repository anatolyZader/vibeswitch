# extension.js - Detailed Explanation

## Overview

`extension.js` is the **main entry point** for the VibeSwitch VS Code extension. It's the file that VS Code loads when the extension is activated (as specified in `package.json`: `"main": "./extension.js"`).

### Purpose
- **Activation**: Initialize all extension components when VS Code starts the extension
- **Composition**: Wire together all adapters, services, and controllers using Dependency Injection
- **Lifecycle Management**: Register commands, event listeners, and resources for automatic cleanup
- **Error Handling**: Provide graceful error handling and user feedback during activation

---

## File Structure

```javascript
extension.js
├── Imports (lines 3-10)
├── Helper Functions (lines 12-138)
│   ├── getDisableLogging()
│   ├── registerCommands()
│   ├── setupUsageStatsListeners()
│   └── createEventListenersDisposable()
├── Main Activation Function (lines 140-357)
│   └── activate(context)
└── Deactivation Function (lines 359-367)
    └── deactivate()
```

---

## Imports (Lines 3-10)

```javascript
const vscode = require('vscode');                    // VS Code API
const { createLogger, setDisableLogging, getLogger } = require('./logger');
const modeDetection = require('./business_modules/mode/app/modeDetection');
const AwarenessEngine = require('./business_modules/awareness/app/awarenessEngine');
const AwarenessController = require('./business_modules/awareness/input/awarenessController');
const DIContainer = require('./diContainer');
const initializeHelpers = require('./initializeHelpers');
const safe = require('./safe');
```

**What each import does:**
- **vscode**: VS Code extension API for UI, commands, events
- **logger**: Centralized logging system
- **modeDetection**: Detects current mode from `.cursor/rules.md`
- **AwarenessEngine**: Core orchestrator for awareness monitoring
- **AwarenessController**: Input layer controller (handles VS Code events)
- **DIContainer**: Dependency Injection container (holds all state)
- **initializeHelpers**: Factory function that creates helper functions with closures
- **safe**: Error boundary wrapper for system boundaries

---

## Helper Functions

### 1. `getDisableLogging(context)` (Lines 17-25)

**Purpose**: Determines if logging should be disabled based on VS Code settings and environment.

**How it works:**
1. Gets VS Code configuration for `vibeswitch` extension
2. Checks `NODE_ENV` environment variable (production = disable logging)
3. Falls back to VS Code setting `vibeswitch.disableLogging` (default: false)

**Returns**: `boolean` - `true` if logging should be disabled

**Example:**
```javascript
const disableLogging = getDisableLogging(context);
// If NODE_ENV=production → returns true
// If vibeswitch.disableLogging=true → returns true
// Otherwise → returns false
```

---

### 2. `registerCommands(context, commandHandlers, log)` (Lines 33-47)

**Purpose**: Registers all VS Code commands defined in `commandHandlers` object.

**Parameters:**
- `context`: VS Code extension context (for `context.subscriptions`)
- `commandHandlers`: Object mapping command IDs to handler functions
  ```javascript
  {
    'vibeswitch.switchMode': async () => { ... },
    'vibeswitch.toVibe': () => { ... },
    'vibeswitch.toDev': () => { ... },
    // ... etc
  }
  ```
- `log`: Optional logging function

**How it works:**
1. Validates that `context` and `commandHandlers` are provided
2. Iterates over each command/handler pair
3. Skips invalid entries (missing command ID or handler)
4. Registers each command using `vscode.commands.registerCommand()`
5. Pushes the returned `Disposable` to `context.subscriptions` for automatic cleanup

**Why `context.subscriptions`?**
- VS Code automatically calls `dispose()` on all subscriptions when extension deactivates
- Prevents memory leaks from orphaned command handlers
- No manual cleanup needed in `deactivate()`

**Example:**
```javascript
const commandHandlers = {
  'vibeswitch.switchMode': async () => { /* handler */ },
  'vibeswitch.toVibe': () => { /* handler */ }
};
registerCommands(context, commandHandlers, log);
// Commands are now available in VS Code command palette
```

---

### 3. `setupUsageStatsListeners(context, state)` (Lines 54-87)

**Purpose**: Sets up event listeners to track file operations (open, edit, save) for usage statistics.

**Parameters:**
- `context`: VS Code extension context
- `state`: Extension state (must have `usageStats` property)

**How it works:**
1. Validates parameters
2. Registers three VS Code workspace event listeners:
   - **`onDidOpenTextDocument`**: Fires when a file is opened
   - **`onDidChangeTextDocument`**: Fires when text in a document changes
   - **`onDidSaveTextDocument`**: Fires when a document is saved
3. Each listener is wrapped in `safe()` for error boundary protection
4. Each listener calls methods on `state.usageStats` to track the event
5. All listeners are pushed to `context.subscriptions` for automatic cleanup

**Event Flow:**
```
User opens file
  ↓
VS Code fires onDidOpenTextDocument
  ↓
safe() wrapper catches any errors
  ↓
state.usageStats.trackFileOpen(doc.fileName)
  ↓
UsageStatsService records the event
```

**Why `safe()` wrapper?**
- Prevents extension crashes if `usageStats` is null or method throws
- Logs errors without breaking extension functionality
- Critical for system boundary operations (VS Code event callbacks)

---

### 4. `createEventListenersDisposable(eventEmitter, state)` (Lines 95-138)

**Purpose**: Creates event listeners for domain events (AI suggestions, outcomes, etc.) and returns a disposable for cleanup.

**Parameters:**
- `eventEmitter`: EventEmitter instance from messaging adapter
- `state`: Extension state (must have `usageStats` property)

**How it works:**
1. Defines event handlers for 4 domain events:
   - **`aiSuggestion`**: When AI generates a suggestion
   - **`aiSuggestionOutcome`**: When user accepts/rejects a suggestion
   - **`keepAll`**: When user accepts all suggestions in a batch
   - **`debtCleared`**: When review debt is cleared
2. Registers all handlers with the event emitter using `eventEmitter.on()`
3. Returns a `vscode.Disposable` that removes all listeners when disposed

**Event Flow:**
```
AwarenessEngine publishes domain event
  ↓
EventEmitter emits event
  ↓
Handler receives payload
  ↓
safe() wrapper catches errors
  ↓
state.usageStats.trackXxx(payload.event)
```

**Why disposable pattern?**
- Ensures listeners are removed when extension deactivates
- Prevents memory leaks from orphaned event listeners
- VS Code automatically calls `dispose()` via `context.subscriptions`

**Example:**
```javascript
const eventEmitter = messagingAdapter.getEventEmitter();
const disposable = createEventListenersDisposable(eventEmitter, state);
context.subscriptions.push(disposable);
// When extension deactivates, VS Code calls disposable.dispose()
// which removes all event listeners
```

---

## Main Activation Function: `activate(context)` (Lines 141-357)

This is the **core function** that VS Code calls when the extension is activated. It's an `async` function because some initialization steps are asynchronous.

### Activation Flow Overview

```
VS Code calls activate(context)
  ↓
1. Validate context
  ↓
2. Create DIContainer (state)
  ↓
3. Initialize logger
  ↓
4. Create adapters (Ports and Adapters pattern)
  ↓
5. Create domain services
  ↓
6. Create AwarenessEngine
  ↓
7. Create AwarenessController
  ↓
8. Initialize helpers (command handlers, UI updates, etc.)
  ↓
9. Set up callbacks and event listeners
  ↓
10. Initialize UI (status bar, file decorations)
  ↓
11. Register commands
  ↓
12. Detect initial mode
  ↓
13. Set up usage stats listeners
  ↓
Extension is ready!
```

### Step-by-Step Breakdown

#### Step 1: Validation (Lines 142-146)

```javascript
if (!context) {
    console.error('VibeSwitch: ERROR - activate() called with null/undefined context');
    return;
}
```

**Purpose**: Prevents crashes if VS Code passes invalid context.

**Why early return?**
- Logger isn't initialized yet, so use `console.error`
- Prevents cascading errors from null context

---

#### Step 2: Create State Container (Lines 148-150)

```javascript
const state = new DIContainer();
state.extensionContext = context;
```

**Purpose**: Creates a centralized state container that holds all extension state.

**What DIContainer stores:**
- UI components (status bar items, output channel)
- Services (awarenessEngine, usageStats)
- Adapters (vscodeAdapter, persistenceAdapter, etc.)
- Current mode
- Extension context

**Why DIContainer?**
- Single source of truth for extension state
- Dependency Injection pattern
- Testable (can inject mock state)
- No global variables

---

#### Step 3: Initialize Logger (Lines 156-190)

```javascript
// Create output channel
state.outputChannel = vscode.window.createOutputChannel('VibeSwitch');
context.subscriptions.push(state.outputChannel);

// Get logging preference
const disableLogging = getDisableLogging(context);

// Initialize logger
createLogger(state.outputChannel);
setDisableLogging(disableLogging);

// Get logger instance
const rawLogger = getLogger();

// Create normalized logger interface
const normalizedLogger = {
    error: (message, error = null) => { ... },
    info: (message) => { ... }
};

// Create legacy log function
log = (message, showOutput = false, isError = false) => { ... };
```

**Purpose**: Sets up logging system early so errors can be logged throughout activation.

**Components:**
1. **Output Channel**: VS Code panel for extension logs
2. **Logger Singleton**: Centralized logger instance
3. **Normalized Logger**: Simple interface for controllers/services
4. **Legacy Log Function**: Wrapper for extension-level code

**Why two logger interfaces?**
- **Normalized Logger**: Simple `error()`/`info()` methods for controllers
- **Legacy Log**: More parameters (`showOutput`, `isError`) for extension code

---

#### Step 4: Create Adapters (Lines 196-221)

```javascript
// Import adapter classes
const AwarenessVSCodeAdapter = require('./...');
const AwarenessWorkspaceStateAdapter = require('./...');
// ... etc

// Create adapter instances
const vscodeAdapter = new AwarenessVSCodeAdapter(context);
const persistenceAdapter = new AwarenessWorkspaceStateAdapter(context);
// ... etc

// Store in DI container
state.setAdapter('awareness', 'vscodeAdapter', vscodeAdapter);
state.setAdapter('awareness', 'persistenceAdapter', persistenceAdapter);
// ... etc
```

**Purpose**: Creates adapters that implement ports (interfaces) for the Ports and Adapters pattern.

**What are adapters?**
- **VSCodeAdapter**: Wraps VS Code API calls (UI, commands, events)
- **PersistenceAdapter**: Handles data persistence (workspace state)
- **MessagingAdapter**: Publishes domain events (EventEmitter)
- **LoggerAdapter**: Wraps logger for domain layer
- **FileSystemAdapter**: File system operations
- **IdGeneratorAdapter**: Generates unique IDs
- **HashGeneratorAdapter**: Generates hashes

**Why adapters?**
- **Testability**: Can inject mock adapters for testing
- **Decoupling**: Domain layer doesn't depend on VS Code API
- **Portability**: Can swap implementations (e.g., different persistence)

**Ports and Adapters Pattern:**
```
Application Layer (AwarenessEngine)
    ↓ (depends on)
Ports (Interfaces: IAwarenessVSCodePort, etc.)
    ↓ (implemented by)
Adapters (AwarenessVSCodeAdapter, etc.)
    ↓ (wraps)
Infrastructure (VS Code API, file system, etc.)
```

---

#### Step 5: Create Domain Services (Lines 223-230)

```javascript
const RangeOperationServiceD = require('./...');
const UriPathOperationServiceD = require('./...');
const ChangeClassificationServiceD = require('./...');

const rangeOperationServiceD = new RangeOperationServiceD();
const uriPathOperationServiceD = new UriPathOperationServiceD();
const changeClassificationServiceD = new ChangeClassificationServiceD();
```

**Purpose**: Creates domain services that contain pure domain logic (no infrastructure dependencies).

**What are domain services?**
- **RangeOperationServiceD**: Range/position operations (domain logic)
- **UriPathOperationServiceD**: URI/path validation (domain logic)
- **ChangeClassificationServiceD**: Change classification logic

**Why domain services?**
- Encapsulate domain logic that doesn't belong to a single entity
- Pure business logic (no VS Code API, no file system)
- Testable without mocks

---

#### Step 6: Create Usage Stats Service (Lines 232-236)

```javascript
const UsageStatsService = require('./business_modules/usage-stats/app/usageStatsService');
const usageStatsService = new UsageStatsService(context);
state.usageStats = usageStatsService;
context.subscriptions.push(state.usageStats);
```

**Purpose**: Creates service for tracking usage statistics (file opens, edits, saves, AI suggestions, etc.).

**Why push to subscriptions?**
- `UsageStatsService` implements `dispose()` method
- VS Code will call `dispose()` when extension deactivates
- Ensures proper cleanup (saves data, closes connections, etc.)

---

#### Step 7: Create AwarenessEngine (Lines 238-250)

```javascript
const awarenessEngine = new AwarenessEngine({
    vscodeAdapter: vscodeAdapter,
    persistenceAdapter: persistenceAdapter,
    messagingAdapter: messagingAdapter,
    loggerAdapter: loggerAdapter,
    fileSystemAdapter: fileSystemAdapter,
    idGeneratorAdapter: idGeneratorAdapter,
    hashGeneratorAdapter: hashGeneratorAdapter,
    rangeOperationServiceD: rangeOperationServiceD,
    uriPathOperationServiceD: uriPathOperationServiceD,
    changeClassificationServiceD: changeClassificationServiceD
});

state.register('awarenessEngine', awarenessEngine);
```

**Purpose**: Creates the core orchestrator for awareness monitoring.

**What is AwarenessEngine?**
- Central orchestrator for tracking AI-generated code changes
- Coordinates domain entities, app services, and adapters
- Handles change classification, suggestion lifecycle, review debt, etc.

**Dependency Injection:**
- All dependencies are injected via constructor
- No hidden dependencies (no `require()` inside class)
- Testable (can inject mocks)

**Why register in DI container?**
- Other components can resolve it: `state.resolveSync('awarenessEngine')`
- Centralized service registry
- Enables service lookup without global variables

---

#### Step 8: Create AwarenessController (Lines 255-263)

```javascript
const awarenessController = new AwarenessController({
    awarenessService: awarenessEngine,
    logger: normalizedLogger
});

state.register('awarenessController', awarenessController);
state.awarenessMonitor = awarenessController; // Backward compatibility
```

**Purpose**: Creates the input layer controller that handles VS Code events.

**What is AwarenessController?**
- Input layer component (handles VS Code events)
- Translates VS Code events → calls to AwarenessEngine
- Thin layer (no business logic, just translation)

**Architecture Layers:**
```
VS Code Events
    ↓
AwarenessController (Input Layer)
    ↓
AwarenessEngine (Application Layer)
    ↓
Domain Entities/Services (Domain Layer)
```

**Why backward compatibility?**
- Old code might reference `state.awarenessMonitor`
- Provides alias for smooth migration
- Will be removed once all code uses DI container

---

#### Step 9: Initialize Helpers (Lines 265-276)

```javascript
const helpers = initializeHelpers(state, disableLogging);
const { 
    log: helperLog, 
    switchModeInStatusBar, 
    updateFileColorsForMode, 
    commandHandlers,
    updateAwarenessMeter
} = helpers;

log = helperLog || log;
```

**Purpose**: Creates helper functions that have access to state via closures.

**What is `initializeHelpers`?**
- Factory function that creates helper functions
- Uses closures to capture `state` parameter
- Returns object with all helper functions

**What helpers are created?**
- `log`: Logging function
- `switchModeInStatusBar`: Updates status bar for mode changes
- `updateFileColorsForMode`: Updates file decorations for mode
- `commandHandlers`: Object with all command handlers
- `updateAwarenessMeter`: Updates awareness meter UI
- `startAwarenessMonitor`: Starts monitoring
- `stopAwarenessMonitor`: Stops monitoring
- `switchToMode`: Mode switching logic

**How closures work:**
```javascript
// initializeHelpers creates functions that "close over" state
function initializeHelpers(state) {
    return {
        log: (msg) => {
            // This function has access to 'state' even after initializeHelpers returns
            state.outputChannel.appendLine(msg);
        }
    };
}

// Later, when we call log(), it still has access to state
const helpers = initializeHelpers(state);
helpers.log('Hello'); // Uses state.outputChannel
```

**Why closures?**
- Helper functions maintain access to shared state
- No global variables needed
- Testable (can inject mock state)

---

#### Step 10: Set Up Callbacks and Event Listeners (Lines 278-292)

```javascript
// Set callbacks for UI updates
awarenessEngine.setCallbacks({
    onScoreUpdate: () => {
        safe('onScoreUpdate', () => {
            if (updateAwarenessMeter) {
                updateAwarenessMeter();
            }
        });
    }
});

// Subscribe to domain events for UsageStats
const eventEmitter = messagingAdapter.getEventEmitter();
const eventListenersDisposable = createEventListenersDisposable(eventEmitter, state);
context.subscriptions.push(eventListenersDisposable);
```

**Purpose**: Connects AwarenessEngine events to UI updates and usage stats.

**Two types of callbacks:**
1. **Direct Callbacks** (`setCallbacks`): For UI updates (score changes → update meter)
2. **Domain Events** (EventEmitter): For usage stats (AI suggestions, outcomes, etc.)

**Why two mechanisms?**
- **Callbacks**: Synchronous, direct (for UI updates)
- **Events**: Asynchronous, decoupled (for usage stats, future integrations)

**Event Flow:**
```
AwarenessEngine calculates new score
  ↓
Calls onScoreUpdate callback
  ↓
safe() wrapper catches errors
  ↓
updateAwarenessMeter() updates UI
```

---

#### Step 11: Initialize UI (Lines 294-302)

```javascript
// Create status bar items
state.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
state.awarenessBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
state.statusBarItem.command = 'vibeswitch.switchMode';
state.statusBarItem.show();

// Register for cleanup
context.subscriptions.push(state.statusBarItem);
context.subscriptions.push(state.awarenessBarItem);
```

**Purpose**: Creates status bar items for mode indicator and awareness meter.

**What are status bar items?**
- **statusBarItem**: Shows current mode (VIBE/DEV) and allows switching
- **awarenessBarItem**: Shows awareness score (only in DEV mode)

**Priority:**
- `100`: Mode indicator (higher priority, always visible)
- `99`: Awareness meter (lower priority, shown below mode)

**Why register for cleanup?**
- Status bar items implement `dispose()` method
- VS Code will hide/remove them when extension deactivates
- Prevents UI artifacts after deactivation

---

#### Step 12: Register Commands (Line 305)

```javascript
registerCommands(context, commandHandlers, log);
```

**Purpose**: Registers all VS Code commands defined in `commandHandlers`.

**What commands are registered?**
- `vibeswitch.switchMode`: Show mode picker
- `vibeswitch.toVibe`: Switch to VIBE mode
- `vibeswitch.toDev`: Switch to DEV mode
- `vibeswitch.showStats`: Show usage statistics
- `vibeswitch.resetStats`: Reset statistics
- `vibeswitch.exportStats`: Export statistics
- `vibeswitch.showLogs`: Show extension logs
- `vibeswitch.showStatusBar`: Show status bar items
- `vibeswitch.diagnoseDecorations`: Diagnostic for file decorations
- `vibeswitch.detectTestingFiles`: Detect files in testing folder
- `vibeswitch.diagnoseMonitor`: Diagnostic for awareness monitor
- `vibeswitch.showUnreviewedFiles`: Show list of unreviewed files
- `vibeswitch.testAddAICode`: Test command for adding AI code

**After registration:**
- Commands appear in VS Code command palette (`Ctrl+Shift+P`)
- Can be bound to keyboard shortcuts
- Can be called programmatically

---

#### Step 13: Detect Initial Mode (Lines 307-314)

```javascript
let initialMode = null;
try {
    initialMode = modeDetection();
    log(`VibeSwitch: Detected initial mode from file: ${initialMode}`);
} catch (error) {
    log(`ERROR detecting initial mode: ${error.message}`, false, true);
}
```

**Purpose**: Detects the current mode from `.cursor/rules.md` file.

**How mode detection works:**
1. Reads `.cursor/rules.md` file
2. Parses mode from file content
3. Returns `'vibe'` or `'dev'` or `null`

**Why try/catch?**
- File might not exist
- File might be unreadable
- Graceful degradation: continue with `null` mode if detection fails

---

#### Step 14: Update UI for Initial Mode (Lines 316-320)

```javascript
switchModeInStatusBar(initialMode);
if (initialMode) {
    updateFileColorsForMode();
}
```

**Purpose**: Updates UI to reflect the detected initial mode.

**What happens:**
1. **Status Bar**: Shows mode indicator (VIBE/DEV) or neutral state
2. **File Colors**: Shows/hides file decorations based on mode

**Why conditional?**
- Only update file colors if mode was detected
- If `initialMode` is `null`, skip file color update (neutral state)

---

#### Step 15: Set Up Usage Stats Listeners (Line 325)

```javascript
setupUsageStatsListeners(context, state);
```

**Purpose**: Registers VS Code workspace event listeners for usage statistics.

**What listeners are registered:**
- File open events → `usageStats.trackFileOpen()`
- File edit events → `usageStats.trackEdit()`
- File save events → `usageStats.trackFileSave()`

**Why at the end?**
- All dependencies (`state.usageStats`) are initialized
- Safe to register listeners now

---

### Error Handling (Lines 327-356)

```javascript
catch (error) {
    const errorMessage = `VibeSwitch: Error during activation: ${error.message}`;
    const stackTrace = error.stack ? `Stack trace: ${error.stack}` : '';
    
    // Log error
    if (log) {
        log(errorMessage, true, true);
        log(stackTrace, false, true);
    } else {
        console.error(errorMessage);
        if (state.outputChannel) {
            state.outputChannel.appendLine(`ERROR: ${errorMessage}`);
            state.outputChannel.appendLine(stackTrace);
            state.outputChannel.show(true);
        }
    }
    
    // Show user-facing error
    try {
        const errorAdapter = state.getAdapter('awareness', 'vscodeAdapter');
        if (errorAdapter) {
            errorAdapter.showErrorMessage(`VibeSwitch activation failed: ${error.message}`);
        } else if (vscode && vscode.window) {
            vscode.window.showErrorMessage(`VibeSwitch activation failed: ${error.message}`);
        }
    } catch (adapterError) {
        if (vscode && vscode.window) {
            vscode.window.showErrorMessage(`VibeSwitch activation failed: ${error.message}`);
        }
    }
}
```

**Purpose**: Provides comprehensive error handling during activation.

**Error handling strategy:**
1. **Log Error**: Log to output channel (if logger available) or console
2. **Show Stack Trace**: Include stack trace for debugging
3. **User Feedback**: Show error message to user via VS Code notification
4. **Graceful Degradation**: Extension doesn't crash, user sees error message

**Why nested try/catch?**
- Outer catch: Catches activation errors
- Inner try/catch: Catches errors while showing error message (prevents double errors)

---

## Deactivation Function: `deactivate()` (Lines 359-367)

```javascript
function deactivate() {
    try {
        // Cleanup is handled by context.subscriptions
        // VS Code automatically disposes all subscriptions when extension deactivates
    } catch (error) {
        console.error('VibeSwitch: Error during deactivation:', error);
    }
}
```

**Purpose**: Called by VS Code when extension is deactivated.

**How cleanup works:**
1. VS Code automatically calls `dispose()` on all items in `context.subscriptions`
2. This includes:
   - Commands (unregistered)
   - Event listeners (removed)
   - Output channels (closed)
   - Status bar items (hidden)
   - Services with `dispose()` methods (cleanup called)

**Why minimal code?**
- VS Code handles cleanup automatically
- No manual cleanup needed
- Just log errors if deactivation fails

**What gets cleaned up automatically:**
- All commands registered via `registerCommands()`
- All event listeners registered via `setupUsageStatsListeners()`
- All domain event listeners via `createEventListenersDisposable()`
- Output channel
- Status bar items
- UsageStatsService (calls its `dispose()` method)

---

## Key Architectural Patterns

### 1. Dependency Injection (DI)

**Pattern**: All dependencies are injected via constructors, not created internally.

**Example:**
```javascript
// ✅ GOOD: Dependencies injected
const awarenessEngine = new AwarenessEngine({
    vscodeAdapter: vscodeAdapter,
    persistenceAdapter: persistenceAdapter,
    // ... etc
});

// ❌ BAD: Dependencies created inside
class AwarenessEngine {
    constructor() {
        this.vscodeAdapter = new AwarenessVSCodeAdapter(); // Hidden dependency!
    }
}
```

**Benefits:**
- Testable (can inject mocks)
- Flexible (can swap implementations)
- Clear dependencies (explicit in constructor)

---

### 2. Ports and Adapters (Hexagonal Architecture)

**Pattern**: Application layer depends on ports (interfaces), adapters implement ports.

**Structure:**
```
Application Layer (AwarenessEngine)
    ↓ depends on
Ports (IAwarenessVSCodePort, IAwarenessPersistencePort, etc.)
    ↓ implemented by
Adapters (AwarenessVSCodeAdapter, AwarenessWorkspaceStateAdapter, etc.)
    ↓ wraps
Infrastructure (VS Code API, workspace state, etc.)
```

**Benefits:**
- Domain layer doesn't depend on VS Code API
- Testable (can inject mock adapters)
- Portable (can swap infrastructure)

---

### 3. Factory Functions with Closures

**Pattern**: `initializeHelpers()` creates functions that capture `state` in closures.

**Example:**
```javascript
function initializeHelpers(state) {
    return {
        log: (msg) => {
            // Has access to 'state' even after initializeHelpers returns
            state.outputChannel.appendLine(msg);
        }
    };
}
```

**Benefits:**
- No global variables
- Functions share same state instance
- Testable (can inject mock state)

---

### 4. Disposable Pattern

**Pattern**: All resources implement `dispose()` method and are registered in `context.subscriptions`.

**Example:**
```javascript
const command = vscode.commands.registerCommand('cmd', handler);
context.subscriptions.push(command); // VS Code will call dispose() automatically
```

**Benefits:**
- Automatic cleanup
- No memory leaks
- No manual cleanup needed

---

### 5. Error Boundary Pattern

**Pattern**: Use `safe()` wrapper at system boundaries (VS Code callbacks, timers, I/O).

**Example:**
```javascript
vscode.workspace.onDidOpenTextDocument((doc) => {
    safe('trackFileOpen', () => {
        // If this throws, safe() catches it and logs error
        state.usageStats.trackFileOpen(doc.fileName);
    });
});
```

**Benefits:**
- Prevents extension crashes
- Errors are logged, not lost
- Graceful degradation

---

## Summary

`extension.js` is the **orchestration layer** that:

1. **Composes** all components (adapters, services, controllers)
2. **Wires** dependencies using Dependency Injection
3. **Registers** commands and event listeners
4. **Initializes** UI components
5. **Handles** errors gracefully
6. **Manages** extension lifecycle

**Key Principles:**
- ✅ Dependency Injection (no hidden dependencies)
- ✅ Ports and Adapters (decoupled from infrastructure)
- ✅ Error boundaries (safe() wrapper)
- ✅ Automatic cleanup (context.subscriptions)
- ✅ Factory functions (initializeHelpers with closures)

**Result:**
A well-structured, testable, maintainable extension that follows clean architecture principles.
