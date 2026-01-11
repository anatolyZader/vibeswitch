# Constructor Injection Flow: DI Container → Service → Controller

## Overview

This document explains how **constructor injection** works in the awareness module and how adapters flow from the DI container through the service to the controller.

## Key Point: Controller Doesn't Read from DI Container

**Important:** The controller does **NOT** directly read adapter instances from the DI container. Instead:

1. **DI Container** stores adapters
2. **Extension.js** (composition root) retrieves adapters from DI container
3. **Extension.js** injects adapters into `AwarenessService` constructor
4. **Extension.js** injects `AwarenessService` into `AwarenessController` constructor
5. **Controller** accesses adapters **through the service**, not directly

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    DI Container (state)                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  adapters = {                                            │   │
│  │    'awareness_vscodeAdapter': <instance>,              │   │
│  │    'awareness_persistenceAdapter': <instance>,          │   │
│  │    'awareness_loggerAdapter': <instance>,               │   │
│  │    ...                                                   │   │
│  │  }                                                       │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ getAdapter()
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              Extension.js (Composition Root)                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  // Step 1: Retrieve adapters from DI container          │   │
│  │  const vscodeAdapter = state.getAdapter(...);            │   │
│  │  const persistenceAdapter = state.getAdapter(...);       │   │
│  │  const loggerAdapter = state.getAdapter(...);            │   │
│  │  // ... all adapters                                      │   │
│  │                                                            │   │
│  │  // Step 2: Inject adapters into service constructor     │   │
│  │  const awarenessService = new AwarenessService({          │   │
│  │      vscodeAdapter: vscodeAdapter,                       │   │
│  │      persistenceAdapter: persistenceAdapter,             │   │
│  │      loggerAdapter: loggerAdapter,                        │   │
│  │      // ... all adapters                                  │   │
│  │  });                                                      │   │
│  │                                                            │   │
│  │  // Step 3: Inject service into controller constructor    │   │
│  │  const awarenessController = new AwarenessController({    │   │
│  │      awarenessService: awarenessService,                 │   │
│  │      logger: normalizedLogger                             │   │
│  │  });                                                      │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ constructor injection
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              AwarenessService                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  constructor({ vscodeAdapter, persistenceAdapter, ... })│   │
│  │  {                                                        │   │
│  │      // Store injected adapters                          │   │
│  │      this.vscodeAdapter = vscodeAdapter;                 │   │
│  │      this.persistenceAdapter = persistenceAdapter;       │   │
│  │      this.loggerAdapter = loggerAdapter;                  │   │
│  │      // ... all adapters stored as instance properties    │   │
│  │  }                                                        │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ constructor injection
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              AwarenessController                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  constructor({ awarenessService, logger })              │   │
│  │  {                                                        │   │
│  │      // Store injected service (NOT adapters directly)    │   │
│  │      this.awarenessService = awarenessService;            │   │
│  │      this.logger = logger;                                │   │
│  │  }                                                        │   │
│  │                                                            │   │
│  │  // Controller accesses adapters THROUGH service          │   │
│  │  classifyTextChange(event) {                              │   │
│  │      // Uses service, which uses adapters internally      │   │
│  │      this.awarenessService.classifyTextChange(...);       │   │
│  │  }                                                        │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Step-by-Step Flow

### Step 1: DI Container Stores Adapters

```javascript
// extension.js
const state = new DIContainer();

// Create adapters
const awarenessVscodeAdapter = new AwarenessVSCodeAdapter(vscode);
const persistenceAdapter = new AwarenessWorkspaceStateAdapter(context);
const loggerAdapter = new AwarenessLoggerAdapter();
// ... create all adapters

// Store in DI container
state.setAdapter('awareness', 'vscodeAdapter', awarenessVscodeAdapter);
state.setAdapter('awareness', 'persistenceAdapter', persistenceAdapter);
state.setAdapter('awareness', 'loggerAdapter', loggerAdapter);
// ... store all adapters
```

**DI Container Implementation:**
```javascript
// diContainer.js
setAdapter(moduleName, adapterType, adapterInstance) {
    const key = `${moduleName}_${adapterType}`;
    this.adapters[key] = adapterInstance; // Store in cache
}

getAdapter(moduleName, adapterType) {
    const key = `${moduleName}_${adapterType}`;
    return this.adapters[key] || null; // Retrieve from cache
}
```

---

### Step 2: Extension.js Retrieves Adapters from DI Container

```javascript
// extension.js
// Get adapters from DI container (single source of truth)
const awarenessVscodeAdapterFromDI = state.getAdapter('awareness', 'vscodeAdapter');
const awarenessPersistenceAdapter = state.getAdapter('awareness', 'persistenceAdapter');
const awarenessLoggerAdapter = state.getAdapter('awareness', 'loggerAdapter');
// ... retrieve all adapters
```

**Why retrieve?**
- Ensures single source of truth (adapters stored once)
- Allows adapters to be shared across multiple services if needed
- Enables adapter swapping for testing

---

### Step 3: Extension.js Injects Adapters into AwarenessService Constructor

```javascript
// extension.js
// Create AwarenessService with explicit dependencies (constructor injection)
const awarenessService = new AwarenessService({
    vscodeAdapter: awarenessVscodeAdapterFromDI,
    persistenceAdapter: awarenessPersistenceAdapter,
    messagingAdapter: awarenessMessagingAdapter,
    loggerAdapter: awarenessLoggerAdapter,
    fileSystemAdapter: awarenessFileSystemAdapter,
    idGeneratorAdapter: awarenessIdGeneratorAdapter,
    hashGeneratorAdapter: awarenessHashGeneratorAdapter
});
```

**AwarenessService Constructor:**
```javascript
// awarenessService.js
constructor({ 
    vscodeAdapter, 
    persistenceAdapter, 
    messagingAdapter = null,
    loggerAdapter,
    fileSystemAdapter,
    idGeneratorAdapter,
    hashGeneratorAdapter
}) {
    // Validate required adapters
    if (!vscodeAdapter) {
        throw new Error('AwarenessService requires vscodeAdapter');
    }
    // ... validate all adapters
    
    // Store all injected adapters as instance properties
    this.vscodeAdapter = vscodeAdapter;
    this.persistenceAdapter = persistenceAdapter;
    this.messagingAdapter = messagingAdapter;
    this.loggerAdapter = loggerAdapter;
    this.fileSystemAdapter = fileSystemAdapter;
    this.idGeneratorAdapter = idGeneratorAdapter;
    this.hashGeneratorAdapter = hashGeneratorAdapter;
}
```

**Key Points:**
- ✅ **Explicit Dependencies:** All adapters are passed explicitly
- ✅ **Validation:** Constructor validates required adapters
- ✅ **Storage:** Adapters stored as instance properties
- ✅ **No DI Container Access:** Service doesn't know about DI container

---

### Step 4: Extension.js Injects AwarenessService into AwarenessController Constructor

```javascript
// extension.js
// Create controller with explicit dependencies (NOT whole state container)
const awarenessController = new AwarenessController({
    awarenessService: awarenessService,  // Service already has adapters injected
    logger: normalizedLogger
});
```

**AwarenessController Constructor:**
```javascript
// awarenessController.js
constructor({ awarenessService, logger = null }) {
    if (!awarenessService) {
        throw new Error('AwarenessController requires awarenessService');
    }
    // Store injected service (NOT adapters directly)
    this.awarenessService = awarenessService;
    this.logger = logger;
}
```

**Key Points:**
- ✅ **Service Injection:** Controller receives service, not adapters
- ✅ **No Direct Adapter Access:** Controller doesn't know about adapters
- ✅ **Delegation:** Controller delegates to service methods
- ✅ **No DI Container Access:** Controller doesn't know about DI container

---

### Step 5: Controller Accesses Adapters Through Service

**Controller doesn't directly access adapters.** Instead, it calls service methods, which use adapters internally:

```javascript
// awarenessController.js
classifyTextChange(event) {
    // Controller calls service method
    this.awarenessService.classifyTextChange(event, (document, classification, changes) => {
        // Service uses adapters internally
        this.awarenessService.handleClassifiedChanges(document, classification, changes);
    });
}
```

**Service uses adapters internally:**
```javascript
// awarenessService.js
classifyTextChange(event, onClassified) {
    // Service uses its injected adapters
    this.classificationService.classifyEvent(event, (document, classification, changes) => {
        // classificationService uses this.loggerAdapter internally
        // classificationService uses this.vscodeAdapter internally
        // ...
    });
}
```

---

## Why This Architecture?

### 1. **Separation of Concerns**

**Controller (Input Layer):**
- Handles VS Code commands/events
- Validates input
- Logs events
- Delegates to service

**Service (Application Layer):**
- Orchestrates business logic
- Uses adapters for infrastructure operations
- Coordinates domain entities

**Adapters (Infrastructure Layer):**
- Adapt external systems to port interfaces
- Encapsulate infrastructure details

### 2. **Dependency Inversion**

```
Controller → Service → Adapters
   (depends on)  (depends on)  (implements)
```

- Controller depends on service (abstraction)
- Service depends on adapters (abstraction via ports)
- Adapters implement ports (concrete implementation)

### 3. **Testability**

**Controller Tests:**
```javascript
// Mock service, not adapters
const mockService = {
    classifyTextChange: jest.fn(),
    // ... other methods
};

const controller = new AwarenessController({
    awarenessService: mockService,
    logger: null
});
```

**Service Tests:**
```javascript
// Mock adapters
const mockVSCodeAdapter = { /* ... */ };
const mockPersistenceAdapter = { /* ... */ };

const service = new AwarenessService({
    vscodeAdapter: mockVSCodeAdapter,
    persistenceAdapter: mockPersistenceAdapter,
    // ... other adapters
});
```

### 4. **Single Responsibility**

- **DI Container:** Manages object creation and storage
- **Extension.js:** Composition root (wires everything together)
- **Service:** Business logic orchestration
- **Controller:** Input handling and validation
- **Adapters:** Infrastructure adaptation

---

## Constructor Injection Pattern

### What is Constructor Injection?

**Constructor injection** is a dependency injection pattern where dependencies are passed to a class through its constructor.

**Benefits:**
1. **Explicit Dependencies:** Clear what a class needs
2. **Required Dependencies:** Constructor can validate dependencies
3. **Immutable Dependencies:** Dependencies set once at construction
4. **Testability:** Easy to mock dependencies in tests

### Example

```javascript
// ❌ BAD: Service locator pattern (hidden dependencies)
class BadService {
    constructor() {
        // Hidden dependency - where does this come from?
        this.adapter = DI.get('adapter');
    }
}

// ✅ GOOD: Constructor injection (explicit dependencies)
class GoodService {
    constructor({ adapter }) {
        // Explicit dependency - clear what's needed
        if (!adapter) {
            throw new Error('Service requires adapter');
        }
        this.adapter = adapter;
    }
}
```

---

## Controller Access Pattern

### Controller Does NOT Access DI Container

```javascript
// ❌ WRONG: Controller accessing DI container
class BadController {
    constructor(diContainer) {
        this.service = diContainer.get('awarenessService');
        this.adapter = diContainer.getAdapter('awareness', 'vscodeAdapter'); // ❌
    }
}

// ✅ CORRECT: Controller receives service via constructor
class GoodController {
    constructor({ awarenessService, logger }) {
        this.awarenessService = awarenessService; // ✅
        // Adapters accessed through service, not directly
    }
}
```

### Controller Accesses Adapters Through Service

```javascript
// awarenessController.js
classifyTextChange(event) {
    // Controller calls service
    this.awarenessService.classifyTextChange(event, (document, classification, changes) => {
        // Service uses adapters internally
        this.awarenessService.handleClassifiedChanges(document, classification, changes);
    });
}

// awarenessService.js
classifyTextChange(event, onClassified) {
    // Service uses its injected adapters
    this.classificationService.classifyEvent(event, (document, classification, changes) => {
        // classificationService uses this.loggerAdapter internally
        // classificationService uses this.vscodeAdapter internally
    });
}
```

---

## Summary

### Flow Summary

1. **DI Container** stores adapters
2. **Extension.js** retrieves adapters from DI container
3. **Extension.js** injects adapters into `AwarenessService` constructor
4. **AwarenessService** stores adapters as instance properties
5. **Extension.js** injects `AwarenessService` into `AwarenessController` constructor
6. **AwarenessController** stores service as instance property
7. **Controller** accesses adapters **through service methods**, not directly

### Key Principles

- ✅ **Explicit Dependencies:** All dependencies passed via constructor
- ✅ **No Service Locator:** No hidden dependencies via DI container
- ✅ **Dependency Inversion:** Depend on abstractions (service, ports), not concretions
- ✅ **Single Responsibility:** Each layer has one clear responsibility
- ✅ **Testability:** Easy to mock dependencies at each layer

### Controller's Role

The controller **does NOT** read adapters from the DI container. Instead:

- Controller receives **service** via constructor injection
- Controller delegates to **service methods**
- Service uses **adapters** internally (already injected)
- Controller never directly accesses adapters or DI container

This maintains proper separation of concerns and follows the **Ports and Adapters (Hexagonal Architecture)** pattern.
