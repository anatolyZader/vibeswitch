# How AwarenessService Receives Adapters at Runtime

## Overview

`AwarenessService` uses **Dependency Injection (DI)** with the **Ports and Adapters (Hexagonal Architecture)** pattern. Adapters are created at the composition root (`extension.js`) and injected into the service constructor at runtime.

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    VS Code Extension Activation                  │
│                         (extension.js)                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 1: Create DI Container                                    │
│  const state = new DIContainer();                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 2: Require Adapter Classes                               │
│  const AwarenessVSCodeAdapter = require(...);                   │
│  const AwarenessWorkspaceStateAdapter = require(...);           │
│  const AwarenessEventEmitterMessagingAdapter = require(...);    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 3: Instantiate Adapters with Dependencies                 │
│  const awarenessVscodeAdapter =                                 │
│      new AwarenessVSCodeAdapter(vscode);                         │
│  const persistenceAdapter =                                     │
│      new AwarenessWorkspaceStateAdapter(context);               │
│  const messagingAdapter =                                        │
│      new AwarenessEventEmitterMessagingAdapter();               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 4: Store Adapters in DI Container                         │
│  state.setAdapter('awareness', 'vscodeAdapter', ...);           │
│  state.setAdapter('awareness', 'persistenceAdapter', ...);      │
│  state.setAdapter('awareness', 'messagingAdapter', ...);        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 5: Retrieve Adapters from DI Container                    │
│  const awarenessVscodeAdapterFromDI =                           │
│      state.getAdapter('awareness', 'vscodeAdapter');            │
│  const awarenessPersistenceAdapter =                            │
│      state.getAdapter('awareness', 'persistenceAdapter');       │
│  const awarenessMessagingAdapter =                              │
│      state.getAdapter('awareness', 'messagingAdapter');         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 6: Inject Adapters into AwarenessService                   │
│  const awarenessService = new AwarenessService({                │
│      vscodeAdapter: awarenessVscodeAdapterFromDI,               │
│      persistenceAdapter: awarenessPersistenceAdapter,           │
│      messagingAdapter: awarenessMessagingAdapter                 │
│  });                                                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 7: AwarenessService Stores Adapters                       │
│  this.vscodeAdapter = vscodeAdapter;                           │
│  this.persistenceAdapter = persistenceAdapter;                 │
│  this.messagingAdapter = messagingAdapter;                      │
└─────────────────────────────────────────────────────────────────┘
```

## Detailed Step-by-Step Explanation

### Step 1: Extension Activation (`extension.js:81`)

When VS Code activates the extension, it calls the `activate()` function:

```javascript
async function activate(context) {
    // Create extension state (DI container)
    const state = new DIContainer();
    state.extensionContext = context;
    // ...
}
```

**Purpose:** Creates a DI container that will hold all adapters and services.

---

### Step 2: Require Adapter Classes (`extension.js:98-101`)

The extension loads adapter class definitions:

```javascript
// Create module-specific adapters for Awareness module (Ports and Adapters pattern)
const AwarenessVSCodeAdapter = require('./business_modules/awareness/infrastructure/adapters/awarenessVSCodeAdapter');
const AwarenessWorkspaceStateAdapter = require('./business_modules/awareness/infrastructure/adapters/awarenessWorkspaceStateAdapter');
const AwarenessEventEmitterMessagingAdapter = require('./business_modules/awareness/infrastructure/adapters/awarenessEventEmitterMessagingAdapter');
```

**Purpose:** Loads the adapter class definitions (not instances yet).

**Key Point:** These are **class definitions**, not instances. They implement port interfaces:
- `AwarenessVSCodeAdapter` implements `IAwarenessVSCodePort`
- `AwarenessWorkspaceStateAdapter` implements `IAwarenessPersistencePort`
- `AwarenessEventEmitterMessagingAdapter` implements `IAwarenessMessagingPort`

---

### Step 3: Instantiate Adapters with Dependencies (`extension.js:104-106`)

Adapters are instantiated with their required dependencies:

```javascript
// Create awareness module-specific adapters
const awarenessVscodeAdapter = new AwarenessVSCodeAdapter(vscode);
const persistenceAdapter = new AwarenessWorkspaceStateAdapter(context);
const messagingAdapter = new AwarenessEventEmitterMessagingAdapter();
```

**Dependencies Injected:**
- `AwarenessVSCodeAdapter` receives the `vscode` module (VS Code API)
- `AwarenessWorkspaceStateAdapter` receives `context` (VS Code extension context)
- `AwarenessEventEmitterMessagingAdapter` has no dependencies (uses EventEmitter)

**Example Adapter Constructor:**

```javascript
// awarenessVSCodeAdapter.js
class AwarenessVSCodeAdapter extends IAwarenessVSCodePort {
    constructor(vscode) {
        super();
        this.vscode = vscode; // Store VS Code API
    }
    
    onDidChangeTextDocument(handler) {
        return this.vscode.workspace.onDidChangeTextDocument(handler);
    }
    // ... other methods delegate to this.vscode
}
```

---

### Step 4: Store Adapters in DI Container (`extension.js:110-112`)

Adapters are stored in the DI container for later retrieval:

```javascript
// Store adapters in DI container (single source of truth)
state.setAdapter('awareness', 'vscodeAdapter', awarenessVscodeAdapter);
state.setAdapter('awareness', 'persistenceAdapter', persistenceAdapter);
state.setAdapter('awareness', 'messagingAdapter', messagingAdapter);
```

**DI Container Implementation:**

```javascript
// diContainer.js
setAdapter(moduleName, adapterType, adapterInstance) {
    const key = `${moduleName}_${adapterType}`;
    this.adapters[key] = adapterInstance; // Store in cache
}
```

**Purpose:** Centralizes adapter storage for consistent access across the extension.

---

### Step 5: Retrieve Adapters from DI Container (`extension.js:161-163`)

Adapters are retrieved from the DI container:

```javascript
// Get adapters from DI container (single source of truth)
const awarenessVscodeAdapterFromDI = state.getAdapter('awareness', 'vscodeAdapter');
const awarenessPersistenceAdapter = state.getAdapter('awareness', 'persistenceAdapter');
const awarenessMessagingAdapter = state.getAdapter('awareness', 'messagingAdapter');
```

**DI Container Retrieval:**

```javascript
// diContainer.js
getAdapter(moduleName, adapterType) {
    const key = `${moduleName}_${adapterType}`;
    return this.adapters[key] || null; // Retrieve from cache
}
```

**Why Retrieve?**
- Ensures single source of truth (adapters stored once)
- Allows adapters to be shared across multiple services if needed
- Enables adapter swapping for testing

---

### Step 6: Inject Adapters into AwarenessService (`extension.js:166-170`)

Adapters are passed to the `AwarenessService` constructor:

```javascript
// Create AwarenessService with explicit dependencies (Ports and Adapters pattern)
const awarenessService = new AwarenessService({
    vscodeAdapter: awarenessVscodeAdapterFromDI,
    persistenceAdapter: awarenessPersistenceAdapter,
    messagingAdapter: awarenessMessagingAdapter
});
```

**Constructor Signature:**

```javascript
// awarenessService.js
constructor({ vscodeAdapter, persistenceAdapter, messagingAdapter = null }) {
    if (!vscodeAdapter) {
        throw new Error('AwarenessService requires vscodeAdapter');
    }
    if (!persistenceAdapter) {
        throw new Error('AwarenessService requires persistenceAdapter');
    }
    
    // Store injected adapters
    this.vscodeAdapter = vscodeAdapter;
    this.persistenceAdapter = persistenceAdapter;
    this.messagingAdapter = messagingAdapter; // Optional
    
    // Create infrastructure adapters (created internally, not injected)
    this.loggerAdapter = new AwarenessLoggerAdapter();
    this.fileSystemAdapter = new AwarenessFileSystemAdapter();
    this.idGeneratorAdapter = new AwarenessIdGeneratorAdapter();
    this.hashGeneratorAdapter = new AwarenessHashGeneratorAdapter();
}
```

**Key Points:**
- ✅ **Explicit Dependencies:** Adapters are passed explicitly (not via global state)
- ✅ **Validation:** Constructor validates required adapters
- ✅ **Optional Dependencies:** `messagingAdapter` is optional (can be `null`)
- ✅ **Internal Adapters:** Some adapters are created internally (logger, file system, ID generator, hash generator)

---

### Step 7: Service Uses Adapters

The service stores adapters and uses them throughout its lifecycle:

```javascript
// Service uses adapters in various methods
async start(context, updateFileColorsInExplorer = null, mode = 'dev', controller = null) {
    // Use vscodeAdapter to register event listeners
    this.disposables.push(
        this.vscodeAdapter.onDidChangeTextDocument((event) => {
            this.eventHandlers.onTextChange(event);
        })
    );
    
    // Use persistenceAdapter to load/save data
    this.debtService.loadDebt(); // Uses persistenceAdapter internally
    
    // Use messagingAdapter to publish domain events
    if (this.messagingAdapter) {
        this.messagingAdapter.publish(event);
    }
}
```

---

## Why This Architecture?

### 1. **Testability**
- Adapters can be mocked for unit tests
- Service doesn't depend on VS Code API directly
- Tests can run without VS Code extension host

### 2. **Flexibility**
- Adapters can be swapped (e.g., different persistence backends)
- Multiple services can share the same adapter instance
- Adapters can be replaced for different environments

### 3. **Separation of Concerns**
- Service doesn't know about VS Code API details
- Adapters encapsulate infrastructure concerns
- Domain logic is isolated from infrastructure

### 4. **Single Source of Truth**
- DI container manages all adapters
- No duplicate adapter instances
- Consistent adapter access across extension

---

## Adapter Types

**All adapters are created in `extension.js` and injected into the service.** There is no meaningful distinction between "internal" and "external" adapters - they're all treated the same architecturally.

### All Adapters (All Injected)

1. **`vscodeAdapter`** (`AwarenessVSCodeAdapter`)
   - Implements: `IAwarenessVSCodePort`
   - Purpose: VS Code API operations (events, documents, editors)
   - Dependencies: `vscode` module

2. **`persistenceAdapter`** (`AwarenessWorkspaceStateAdapter`)
   - Implements: `IAwarenessPersistencePort`
   - Purpose: Persist/load data from VS Code workspace state
   - Dependencies: `context` (VS Code extension context)

3. **`messagingAdapter`** (`AwarenessEventEmitterMessagingAdapter`)
   - Implements: `IAwarenessMessagingPort`
   - Purpose: Publish domain events
   - Dependencies: None (uses EventEmitter)

4. **`loggerAdapter`** (`AwarenessLoggerAdapter`)
   - Implements: `ILoggerPort`
   - Purpose: Logging operations
   - Dependencies: None (uses singleton `getLogger()`)

5. **`fileSystemAdapter`** (`AwarenessFileSystemAdapter`)
   - Implements: `IFileSystemPort`
   - Purpose: File system operations
   - Dependencies: None (uses Node.js `fs`)

6. **`idGeneratorAdapter`** (`AwarenessIdGeneratorAdapter`)
   - Implements: `IIdGeneratorPort`
   - Purpose: Generate unique IDs
   - Dependencies: None (uses Node.js `crypto`)

7. **`hashGeneratorAdapter`** (`AwarenessHashGeneratorAdapter`)
   - Implements: `IHashGeneratorPort`
   - Purpose: Generate hashes
   - Dependencies: None (uses Node.js `crypto`)

**Note:** The only difference is whether adapters need constructor parameters (like `vscode` or `context`), but this is just an implementation detail. All adapters are created in the composition root and injected the same way.

---

## Runtime Flow Summary

```
1. VS Code activates extension → activate(context)
2. Create DI container → new DIContainer()
3. Load adapter classes → require(...)
4. Instantiate adapters → new Adapter(dependencies)
5. Store in DI container → state.setAdapter(...)
6. Retrieve from DI container → state.getAdapter(...)
7. Inject into service → new AwarenessService({ adapters })
8. Service stores adapters → this.vscodeAdapter = ...
9. Service uses adapters → this.vscodeAdapter.onDidChangeTextDocument(...)
```

---

## Benefits of This Approach

1. **Explicit Dependencies:** Clear what the service needs
2. **Easy Testing:** Mock adapters in tests
3. **Flexible:** Swap adapters without changing service code
4. **Maintainable:** Single source of truth for adapters
5. **Type Safety:** Port interfaces ensure correct adapter implementation
6. **Isolation:** Service doesn't depend on VS Code API directly

---

## Example: Testing with Mock Adapters

```javascript
// In a test file
const mockVSCodeAdapter = {
    onDidChangeTextDocument: jest.fn(),
    // ... other methods
};

const mockPersistenceAdapter = {
    load: jest.fn(),
    save: jest.fn(),
    // ... other methods
};

const awarenessService = new AwarenessService({
    vscodeAdapter: mockVSCodeAdapter,
    persistenceAdapter: mockPersistenceAdapter,
    messagingAdapter: null
});

// Service works with mocks - no VS Code needed!
```

---

## Conclusion

`AwarenessService` receives adapters through **explicit dependency injection** at the composition root (`extension.js`). The flow is:

1. **Create** adapters with their dependencies
2. **Store** adapters in DI container
3. **Retrieve** adapters from DI container
4. **Inject** adapters into service constructor
5. **Use** adapters throughout service lifecycle

This follows the **Ports and Adapters (Hexagonal Architecture)** pattern, ensuring the service is testable, flexible, and maintainable.
