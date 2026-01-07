# Architecture Refactoring Plan: Align with Hexagonal Architecture Pattern

## Current State Analysis

### Problems with Current Architecture

1. **`extension.js` is doing too much**:
   - Contains business logic (initializing services, wiring callbacks)
   - Directly instantiates services
   - Mixed concerns (wiring + business logic)

2. **No clear separation of layers**:
   - Controllers, services, and domain logic are mixed
   - Services directly instantiated instead of resolved from DI
   - No clear module boundaries

3. **Adapters are passed but not through proper DI**:
   - Adapters are created in `extension.js` and passed manually
   - Should be resolved from DI container like in git module example

## Target Architecture (Based on gitModuleExample.js)

### Directory Structure

```
vibeswitch/ (Root)
├── extension.js (Root/Wiring Layer - creates adapters, registers modules, wires DI)
├── diContainer.js (Extension-wide DI container)
├── logger.js (Extension-wide utilities)
├── config.js (Extension-wide config)
└── business_modules/ (All business modules)
    ├── awareness/
    │   ├── input/ (Input adapters/controllers for VS Code commands)
    │   │   └── awarenessController.js (Thin controller - handles VS Code commands)
    │   ├── app/ (Application layer)
    │   │   ├── awarenessService.js (Business logic orchestration)
    │   │   └── ... (Other application services if needed)
    │   ├── domain/ (Domain layer)
    │   │   ├── entities/ (Domain entities)
    │   │   │   ├── DebtManager.js
    │   │   │   ├── ChangeLedger.js
    │   │   │   └── ...
    │   │   ├── ports/ (Port interfaces - MUST be in domain layer)
    │   │   │   ├── IVSCodePort.js
    │   │   │   └── IPersistencePort.js
    │   │   ├── value_objects/ (Value objects)
    │   │   │   └── ...
    │   │   └── events/ (Domain events)
    │   │       └── ...
    │   └── infrastructure/ (Module-specific infrastructure)
    │       └── adapters/ (Adapter implementations for this module)
    │           ├── vscodeAdapter.js (implements domain/ports/IVSCodePort)
    │           ├── workspaceStateAdapter.js (implements domain/ports/IPersistencePort)
    │           ├── mockVSCodeAdapter.js (test adapter)
    │           └── mockPersistenceAdapter.js (test adapter)
    ├── mode/
    │   ├── input/
    │   │   └── modeController.js
    │   ├── app/
    │   │   └── modeService.js
    │   ├── domain/
    │   │   ├── entities/
    │   │   ├── ports/
    │   │   ├── value_objects/
    │   │   └── events/
    │   └── infrastructure/
    │       └── adapters/
    └── usage-stats/
        ├── input/
        │   └── usageStatsController.js
        ├── app/
        │   └── usageStatsService.js
        ├── domain/
        │   ├── entities/
        │   ├── ports/
        │   ├── value_objects/
        │   └── events/
        └── infrastructure/
            └── adapters/
```

### Key Points

1. **Root directory**: Extension-wide files only (extension.js, diContainer.js, logger.js, etc.)
2. **business_modules/**: All business logic organized by module
3. **Each module has 4 layers**:
   - **input/**: Controllers that handle external input (VS Code commands, events)
   - **app/**: Application services (business logic orchestration)
   - **domain/**: Pure domain logic (entities, ports, value objects, events)
   - **infrastructure/**: Module-specific adapters (implement domain ports)

### Pattern from gitModuleExample.js

1. **Controller** (gitController.js):
   - Receives requests/commands
   - Resolves service from DI: `await request.diScope.resolve('gitService')`
   - Calls service methods
   - Handles errors

2. **Service** (gitService.js):
   - Constructor receives adapters: `constructor({gitMessagingAdapter, gitAdapter, gitPersistAdapter})`
   - Uses domain entities: `const repository = new Repository(userId)`
   - Calls port methods: `await repository.fetchRepo(repoId.value, this.gitAdapter)`
   - Publishes domain events

3. **Domain Entity** (repository.js):
   - Uses value objects: `const userId = new UserId(userIdRaw)`
   - Receives ports as parameters: `async fetchRepo(repoIdRaw, IGitPort)`
   - Calls port methods: `await IGitPort.fetchRepo(...)`

4. **Ports** (IGitPort, IGitPersistPort):
   - **MUST be in domain layer** (e.g., `domain/ports/` or `modules/awareness/domain/ports/`)
   - Interfaces/contracts that define what adapters must implement
   - Domain layer defines the contracts, not the implementations

5. **Adapters** (GitGithubAdapter, GitPostgresAdapter):
   - **MUST be in infrastructure layer** (e.g., `infrastructure/adapters/`)
   - Implement ports from domain layer
   - Concrete implementations of infrastructure concerns
   - Injected at runtime via DI

## Refactoring Steps

### Phase 1: Restructure extension.js (Root/Wiring Layer)

**Goal**: Make `extension.js` a pure wiring file

**Changes**:
1. Remove all business logic
2. Create adapters
3. Register services in DI container with adapters
4. Register controllers/command handlers
5. Wire event listeners

**New structure**:
```javascript
function activate(context) {
    // 1. Create DI container
    const diContainer = new DIContainer();
    diContainer.extensionContext = context;
    
    // 2. Create adapters for each module
    // Awareness module adapters
    const AwarenessVSCodeAdapter = require('./business_modules/awareness/infrastructure/adapters/vscodeAdapter');
    const AwarenessPersistenceAdapter = require('./business_modules/awareness/infrastructure/adapters/workspaceStateAdapter');
    const awarenessVscodeAdapter = new AwarenessVSCodeAdapter(vscode);
    const awarenessPersistenceAdapter = new AwarenessPersistenceAdapter(context);
    
    // Mode module adapters (if needed)
    const ModeVSCodeAdapter = require('./business_modules/mode/infrastructure/adapters/vscodeAdapter');
    const modeVscodeAdapter = new ModeVSCodeAdapter(vscode);
    
    // Usage-stats module adapters
    const UsageStatsPersistenceAdapter = require('./business_modules/usage-stats/infrastructure/adapters/workspaceStateAdapter');
    const usageStatsPersistenceAdapter = new UsageStatsPersistenceAdapter(context);
    
    // 3. Register adapters in DI
    diContainer.register('awareness.vscodeAdapter', awarenessVscodeAdapter);
    diContainer.register('awareness.persistenceAdapter', awarenessPersistenceAdapter);
    diContainer.register('mode.vscodeAdapter', modeVscodeAdapter);
    diContainer.register('usage-stats.persistenceAdapter', usageStatsPersistenceAdapter);
    
    // 4. Register services with adapters
    const AwarenessService = require('./business_modules/awareness/app/awarenessService');
    const awarenessService = new AwarenessService({
        vscodeAdapter: awarenessVscodeAdapter,
        persistenceAdapter: awarenessPersistenceAdapter
    });
    diContainer.register('awarenessService', awarenessService);
    
    const ModeService = require('./business_modules/mode/app/modeService');
    const modeService = new ModeService({
        vscodeAdapter: modeVscodeAdapter
    });
    diContainer.register('modeService', modeService);
    
    const UsageStatsService = require('./business_modules/usage-stats/app/usageStatsService');
    const usageStatsService = new UsageStatsService({
        persistenceAdapter: usageStatsPersistenceAdapter
    });
    diContainer.register('usageStatsService', usageStatsService);
    
    // 5. Register controllers
    const AwarenessController = require('./business_modules/awareness/input/awarenessController');
    const ModeController = require('./business_modules/mode/input/modeController');
    const UsageStatsController = require('./business_modules/usage-stats/input/usageStatsController');
    
    const awarenessController = new AwarenessController(diContainer);
    const modeController = new ModeController(diContainer);
    const usageStatsController = new UsageStatsController(diContainer);
    
    // 6. Register command handlers (controllers handle commands)
    registerCommands(context, {
        'vibeswitch.switchMode': (args) => modeController.switchMode(args),
        // ... other commands
    });
    
    // 7. Wire event listeners
    setupEventListeners(context, diContainer);
}
```

### Phase 2: Create Controllers

**For each module, create a thin controller in the input/ directory**:

**business_modules/awareness/input/awarenessController.js**:
```javascript
class AwarenessController {
    constructor(diContainer) {
        this.diContainer = diContainer;
    }
    
    async startMonitoring(context, mode) {
        const awarenessService = await this.diContainer.resolve('awarenessService');
        return await awarenessService.start(context, mode);
    }
    
    async stopMonitoring() {
        const awarenessService = await this.diContainer.resolve('awarenessService');
        return await awarenessService.stop();
    }
    
    getScore() {
        const awarenessService = this.diContainer.resolveSync('awarenessService');
        return awarenessService.getScore();
    }
}
```

**business_modules/mode/input/modeController.js**:
```javascript
class ModeController {
    constructor(diContainer) {
        this.diContainer = diContainer;
    }
    
    async switchMode(mode) {
        const modeService = await this.diContainer.resolve('modeService');
        return await modeService.switchToMode(mode);
    }
    
    detectCurrentMode() {
        const modeService = this.diContainer.resolveSync('modeService');
        return modeService.detectCurrentMode();
    }
}
```

### Phase 3: Create Services

**Extract business logic from current classes into services**:

**business_modules/awareness/app/awarenessService.js**:
```javascript
class AwarenessService {
    constructor({vscodeAdapter, persistenceAdapter}) {
        this.vscodeAdapter = vscodeAdapter;
        this.persistenceAdapter = persistenceAdapter;
        // Initialize internal components
        this.debtManager = new DebtManager(persistenceAdapter);
        this.scoreCalculator = new ScoreCalculator(vscodeAdapter);
        // ...
    }
    
    async start(context, mode) {
        // Business logic for starting monitoring
    }
    
    async stop() {
        // Business logic for stopping
    }
    
    getScore() {
        // Business logic for getting score
    }
}
```

**business_modules/mode/app/modeService.js**:
```javascript
class ModeService {
    constructor({vscodeAdapter}) {
        this.vscodeAdapter = vscodeAdapter;
    }
    
    async switchToMode(mode) {
        // Business logic for mode switching
        // Uses vscodeAdapter instead of direct vscode calls
    }
    
    detectCurrentMode() {
        // Business logic for mode detection
    }
}
```

### Phase 4: Move Ports to Domain Layer (MANDATORY)

**Current**: Ports are incorrectly in `infrastructure/ports/`
**Target**: Ports **MUST** be in each module's `domain/ports/` directory

**Why**: 
- Ports define contracts/interfaces that the domain needs
- Domain layer should not depend on infrastructure
- Ports are part of the domain's vocabulary and requirements

**New Structure**:
```
business_modules/
├── awareness/
│   ├── domain/
│   │   └── ports/
│   │       ├── IVSCodePort.js (move from infrastructure/ports/IVSCodePort.js)
│   │       └── IPersistencePort.js (move from infrastructure/ports/IPersistencePort.js)
│   └── infrastructure/
│       └── adapters/
│           ├── vscodeAdapter.js (implements domain/ports/IVSCodePort)
│           └── workspaceStateAdapter.js (implements domain/ports/IPersistencePort)
├── mode/
│   ├── domain/
│   │   └── ports/
│   │       └── ... (mode-specific ports if needed)
│   └── infrastructure/
│       └── adapters/
└── usage-stats/
    ├── domain/
    │   └── ports/
    │       └── ... (usage-stats-specific ports if needed)
    └── infrastructure/
        └── adapters/
```

**Migration Steps**:
1. Create `business_modules/awareness/domain/ports/` directory
2. Move port files from `infrastructure/ports/` to `business_modules/awareness/domain/ports/`
3. Move adapters from `infrastructure/adapters/` to `business_modules/awareness/infrastructure/adapters/`
4. Update all imports in adapters to reference domain ports: `require('../../domain/ports/IVSCodePort')`
5. Update all imports in services to reference domain ports: `require('../domain/ports/IVSCodePort')`
6. Remove old `infrastructure/ports/` and `infrastructure/adapters/` directories (or keep only shared/extension-wide infrastructure)

### Phase 5: Enhance DI Container

**Add service registration and resolution**:

```javascript
class DIContainer {
    constructor() {
        this.services = {};
        this.adapters = {};
    }
    
    register(name, instance) {
        this.services[name] = instance;
    }
    
    async resolve(name) {
        if (this.services[name]) {
            return this.services[name];
        }
        // Could add factory resolution here
        throw new Error(`Service ${name} not found`);
    }
    
    resolveSync(name) {
        if (this.services[name]) {
            return this.services[name];
        }
        throw new Error(`Service ${name} not found`);
    }
}
```

## Implementation Order

1. **Step 1**: Move ports to domain layer (foundational - must be done first)
2. **Step 2**: Enhance DI container with service registration
3. **Step 3**: Create service classes (extract from current classes)
4. **Step 4**: Create controller classes
5. **Step 5**: Refactor extension.js to be pure wiring
6. **Step 6**: Update command handlers to use controllers

**Note**: Moving ports first ensures all subsequent code uses the correct domain layer imports

## Benefits

1. **Clear separation**: Controllers → Services → Domain (with Ports) → Infrastructure (Adapters)
2. **Proper dependency direction**: Domain defines ports, infrastructure implements them
3. **Testability**: Each layer can be tested independently with mock adapters
4. **Flexibility**: Easy to swap adapters without changing domain logic
5. **Maintainability**: Clear boundaries and responsibilities
6. **Consistency**: Matches the pattern used in eventstorm.me app (git module)
7. **Hexagonal Architecture compliance**: Domain is independent of infrastructure

## Key Principles

### Ports (Domain Layer)
- **Location**: `domain/` or `modules/{module}/domain/ports/`
- **Purpose**: Define contracts/interfaces that domain needs
- **Dependencies**: None (pure interfaces)
- **Example**: `IVSCodePort`, `IPersistencePort`

### Adapters (Infrastructure Layer)
- **Location**: `infrastructure/adapters/`
- **Purpose**: Implement domain ports with concrete infrastructure
- **Dependencies**: Domain ports (imports from domain layer)
- **Example**: `VSCodeAdapter` implements `IVSCodePort`, `WorkspaceStateAdapter` implements `IPersistencePort`

## Migration Strategy

- Keep existing code working during refactoring
- Create new structure alongside old code
- Gradually migrate functionality
- Remove old code once migration is complete
- Test after each step

