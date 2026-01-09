# Architecture Comparison: Awareness Module vs Git Module Example

This document compares the awareness module structure with the `gitModuleExample.js` to identify where it follows DDD/Hexagonal/Layered architecture patterns and where it differs.

## Overview

Both modules follow a **Ports and Adapters (Hexagonal Architecture)** pattern with **Domain-Driven Design (DDD)** principles, but there are some structural differences.

---

## ✅ WHERE AWARENESS MODULE FOLLOWS THE PATTERN

### 1. **Layered Architecture Structure**

Both modules follow the same 4-layer structure:

```
┌─────────────────────────────────────┐
│   INPUT LAYER (Controllers)          │
├─────────────────────────────────────┤
│   APPLICATION LAYER (Services)       │
├─────────────────────────────────────┤
│   DOMAIN LAYER (Entities, Ports)    │
├─────────────────────────────────────┤
│   INFRASTRUCTURE LAYER (Adapters)   │
└─────────────────────────────────────┘
```

#### Git Module:
- **Input**: `gitController.js` (HTTP handlers)
- **Application**: `gitService.js`
- **Domain**: `Repository` entity, `UserId`/`RepoId` value objects, `IGitPort`/`IGitPersistPort` ports
- **Infrastructure**: `GitGithubAdapter`, `GitPostgresAdapter`, `GitPubsubAdapter`

#### Awareness Module:
- **Input**: `awarenessController.js` (VS Code command handlers)
- **Application**: `awarenessService.js`
- **Domain**: `DebtManager`, `ChangeLedger`, `ScoreCalculator`, etc. entities, `IVSCodePort`/`IPersistencePort` ports
- **Infrastructure**: `VSCodeAdapter`, `WorkspaceStateAdapter`, mock adapters

### 2. **Dependency Injection Pattern**

Both modules use DI containers for service resolution:

#### Git Module:
```javascript
// Controller resolves service from DI container
const gitService = await request.diScope.resolve('gitService');
const repository = await gitService.fetchRepo(userId, repo, correlationId);
```

#### Awareness Module:
```javascript
// Controller resolves service from DI container
const awarenessService = await this.diContainer.resolve('awarenessService');
await awarenessService.start(context, updateFileColorsInExplorer, mode);
```

✅ **Both follow the same pattern**: Controllers resolve services from DI container, services orchestrate domain logic.

### 3. **Ports and Adapters Pattern**

Both modules define ports (interfaces) in the domain layer and implement them in infrastructure:

#### Git Module:
- **Port**: `IGitPort` (domain/ports/)
- **Adapter**: `GitGithubAdapter extends IGitPort`

#### Awareness Module:
- **Port**: `IVSCodePort` (domain/ports/)
- **Adapter**: `VSCodeAdapter extends IVSCodePort`

✅ **Both follow the same pattern**: Ports define contracts, adapters implement them.

### 4. **Application Service Pattern**

Both services orchestrate domain entities and use adapters:

#### Git Module:
```javascript
class GitService {
  constructor({gitMessagingAdapter, gitAdapter, gitPersistAdapter}) {
    this.gitAdapter = gitAdapter;
    this.gitPersistAdapter = gitPersistAdapter;
  }
  
  async fetchRepo(userIdRaw, repoIdRaw, correlationId) {
    const repository = new Repository(userId);
    const repo = await repository.fetchRepo(repoId.value, this.gitAdapter);
    // ... orchestrate domain logic
  }
}
```

#### Awareness Module:
```javascript
class AwarenessService {
  constructor({ vscodeAdapter, persistenceAdapter }) {
    this.vscodeAdapter = vscodeAdapter;
    this.persistenceAdapter = persistenceAdapter;
  }
  
  async start(context, updateFileColorsInExplorer, mode) {
    this.debtManager = new DebtManager(context, ..., this.persistenceAdapter);
    // ... orchestrate domain logic
  }
}
```

✅ **Both follow the same pattern**: Services receive adapters via constructor injection, orchestrate domain entities.

### 5. **Domain Entities**

Both modules have rich domain entities that encapsulate business logic:

#### Git Module:
- `Repository` entity with methods like `fetchRepo()`, `fetchDocs()`

#### Awareness Module:
- `DebtManager`, `ChangeLedger`, `ScoreCalculator`, `AgentSuggestionHandler`, etc.

✅ **Both follow the same pattern**: Domain entities contain business logic, not just data.

---

## ❌ WHERE AWARENESS MODULE DIFFERS

### 1. **Domain Events**

#### Git Module:
- ✅ Has explicit domain events: `RepoFetchedEvent`, `RepoPersistedEvent`, `DocsFetchedEvent`
- ✅ Events are published via messaging adapter (`gitMessagingAdapter.publishRepoFetchedEvent()`)
- ✅ Events are defined in `domain/events/` directory

#### Awareness Module:
- ❌ **No explicit domain events** - uses callbacks instead (`onAISuggestion`, `onScoreUpdate`, etc.)
- ❌ **No `domain/events/` directory** - directory exists but is empty
- ⚠️ **Uses callback pattern** instead of event-driven architecture

**Impact**: The awareness module is less decoupled. Events would allow other modules to subscribe to awareness changes without tight coupling.

**Recommendation**: Consider migrating callbacks to domain events:
```javascript
// Instead of:
this.onAISuggestion(data);

// Use:
const event = new AISuggestionEvent(data);
await this.messagingAdapter.publishAISuggestionEvent(event);
```

### 2. **Value Objects**

#### Git Module:
- ✅ Has value objects: `UserId`, `RepoId` (in `domain/value_objects/`)
- ✅ Value objects encapsulate validation and business rules
- ✅ Used throughout the domain layer

#### Awareness Module:
- ❌ **No value objects** - uses primitive types (strings, numbers) directly
- ❌ **`domain/value_objects/` directory exists but is empty**

**Impact**: Less type safety and validation. Primitive obsession anti-pattern.

**Recommendation**:
```javascript
// Instead of:
handleExternallyCreatedFile(filePath: string)

// Use:
class FilePath {
  constructor(value: string) {
    if (!value || typeof value !== 'string') {
      throw new Error('Invalid FilePath');
    }
    this.value = value;
  }
}
```

### 3. **Service Interface/Base Class**

#### Git Module:
- ✅ `GitService extends IGitService` - implements an interface
- ✅ Interface defines contract for the service

#### Awareness Module:
- ❌ **No service interface** - `AwarenessService` is a concrete class
- ❌ **No `IAwarenessService` interface**

**Impact**: Less testable, harder to swap implementations.

**Recommendation**: Create `IAwarenessService` interface:
```javascript
class IAwarenessService {
  async start(context, updateFileColorsInExplorer, mode) {
    throw new Error('Method not implemented');
  }
  // ... other methods
}

class AwarenessService extends IAwarenessService {
  // ... implementation
}
```

### 4. **Input Layer Structure**

#### Git Module:
- ✅ Controllers are **Fastify plugins** that decorate the Fastify instance
- ✅ Controllers handle **HTTP requests** (request/reply pattern)
- ✅ Uses `request.diScope` for per-request DI scopes

#### Awareness Module:
- ⚠️ Controller is a **plain class** (not a plugin/decorator pattern)
- ⚠️ Controller handles **VS Code commands** (different input mechanism)
- ⚠️ Uses **global DI container** (not per-request scopes)

**Impact**: Different input mechanisms (HTTP vs VS Code commands), but same architectural pattern.

**Note**: This is acceptable - VS Code extensions don't use Fastify, so the pattern adapts to the platform.

### 5. **Domain Utilities Organization**

#### Git Module:
- ✅ Domain logic is primarily in **entities**
- ✅ Minimal utilities (mostly in entities themselves)

#### Awareness Module:
- ⚠️ Has extensive **`domain/utils/`** directory with:
  - `changeClassifier.js`
  - `changeAggregator.js`
  - `classificationScorer.js`
  - `detectors/` (8 detector classes)
  - `diffBulletBuilder.js`
  - etc.

**Impact**: More granular organization, but potentially more files to navigate.

**Note**: This is acceptable - the awareness domain is more complex and benefits from utility separation.

### 6. **Legacy Code in Infrastructure**

#### Git Module:
- ✅ Infrastructure layer contains **only adapters**
- ✅ Clean separation

#### Awareness Module:
- ⚠️ Infrastructure layer contains:
  - ✅ Adapters (`adapters/`)
  - ⚠️ **Legacy persistence utilities**: `persistInContext.js`, `persistInSystem.js`

**Impact**: Mixed concerns - adapters and legacy code in same layer.

**Recommendation**: Either:
1. Move legacy utilities to a `legacy/` subdirectory
2. Migrate them to proper adapters
3. Document them as deprecated

---

## 📊 Summary Table

| Aspect | Git Module | Awareness Module | Status |
|--------|-----------|------------------|--------|
| **Layered Structure** | ✅ 4 layers | ✅ 4 layers | ✅ Matches |
| **DI Container Usage** | ✅ Per-request scopes | ✅ Global container | ⚠️ Different (platform-specific) |
| **Ports & Adapters** | ✅ Ports + Adapters | ✅ Ports + Adapters | ✅ Matches |
| **Application Service** | ✅ Orchestrates entities | ✅ Orchestrates entities | ✅ Matches |
| **Domain Entities** | ✅ Rich entities | ✅ Rich entities | ✅ Matches |
| **Domain Events** | ✅ Explicit events | ❌ Callbacks only | ❌ Missing |
| **Value Objects** | ✅ UserId, RepoId | ❌ None | ❌ Missing |
| **Service Interface** | ✅ IGitService | ❌ No interface | ❌ Missing |
| **Input Layer** | ✅ Fastify plugins | ⚠️ Plain class | ⚠️ Different (platform-specific) |
| **Infrastructure** | ✅ Only adapters | ⚠️ Adapters + legacy | ⚠️ Mixed concerns |

---

## 🎯 Recommendations for Alignment

### High Priority:
1. **Add Domain Events**: Replace callbacks with explicit domain events
2. **Create Value Objects**: Add value objects for domain concepts (FilePath, Score, etc.)
3. **Create Service Interface**: Add `IAwarenessService` interface

### Medium Priority:
4. **Clean Infrastructure Layer**: Move or migrate legacy persistence utilities
5. **Document Differences**: Add comments explaining platform-specific adaptations

### Low Priority:
6. **Consider Event Sourcing**: If events are added, consider event sourcing for audit trail
7. **Add Domain Services**: If complex business logic emerges, extract to domain services

---

## ✅ Conclusion

The awareness module **follows the core architectural patterns** from `gitModuleExample.js`:
- ✅ Layered architecture (Input → Application → Domain → Infrastructure)
- ✅ Ports and Adapters pattern
- ✅ Dependency Injection
- ✅ Domain entities with business logic

The main differences are:
- ❌ Missing domain events (uses callbacks)
- ❌ Missing value objects (uses primitives)
- ❌ Missing service interface
- ⚠️ Platform-specific adaptations (VS Code vs HTTP)

These differences are **acceptable for a VS Code extension** but could be improved for better alignment with DDD principles.

 Create value objects for domain concepts: