# Domain Layer Isolation Analysis

## Summary

**Status: ❌ Domain layer is NOT properly isolated**

Multiple domain entities directly import and use infrastructure dependencies instead of using ports (interfaces). This violates hexagonal architecture principles.

## Issues Found

### 🔴 Critical Violations (Direct Infrastructure Dependencies)

#### 1. **fileWatcher.js**
**Violations:**
- Directly imports `vscode` (line 8)
- Directly imports `fs` (line 9)
- Directly imports `path` (line 10)
- Directly imports `getLogger()` (line 11)
- Uses `fs.watch()`, `fs.stat()`, `fs.readdirSync()`, `fs.readFileSync()` directly
- Uses `vscode.workspace.workspaceFolders` directly (fallback)
- Uses `vscode.Uri` directly (fallback)

**Should use:**
- `IAwarenessVSCodePort` for VS Code operations
- `IFileSystemPort` (needs to be created) for filesystem operations
- `ILoggerPort` (needs to be created) for logging

#### 2. **debtManager.js**
**Violations:**
- Directly imports `getLogger()` (line 6)
- Directly imports `PersistInContext` from `../../infrastructure/legacy/persistInContext` (line 7)
- Creates `PersistInContext` instance directly (line 25)
- Uses `context` directly (line 18, 25)

**Should use:**
- `IAwarenessPersistencePort` (already accepts it, but has fallback)
- `ILoggerPort` (needs to be created) for logging
- Remove `context` parameter entirely

#### 3. **agentSuggestionHandler.js**
**Violations:**
- Directly imports `vscode` (line 8)
- Directly imports `path` (line 9)
- Directly imports `crypto` (line 10)
- Directly imports `getLogger()` (line 11)
- Uses `vscode.Range`, `vscode.Position`, `vscode.Uri` directly
- Uses `crypto.randomUUID()` directly

**Should use:**
- `IAwarenessVSCodePort` for VS Code types/operations
- `IIdGeneratorPort` (needs to be created) for ID generation
- `ILoggerPort` (needs to be created) for logging

#### 4. **eventHandlers.js**
**Violations:**
- Directly imports `getLogger()` (line 15)
- Directly imports `vscode` (line 21)
- Has `require('vscode')` inside a method (line 158)
- Uses `vscode.Range`, `vscode.Position` directly

**Should use:**
- `IAwarenessVSCodePort` for VS Code types/operations
- `ILoggerPort` (needs to be created) for logging

#### 5. **scoreCalculator.js**
**Violations:**
- Directly imports `vscode` (line 8)
- Directly imports `getLogger()` (line 9)
- Uses `vscode` types directly
- Uses `getLogger().debug()` directly (line 49)

**Should use:**
- `IAwarenessVSCodePort` for VS Code types (if needed)
- `ILoggerPort` (needs to be created) for logging

#### 6. **changeLedger.js**
**Violations:**
- Directly imports `crypto` (line 13)
- Uses `context` directly (line 23, 51, 53, 91)
- Uses `crypto.createHash()` directly (likely)

**Should use:**
- `IAwarenessPersistencePort` (already accepts it, but has fallback)
- `IHashGeneratorPort` (needs to be created) for hashing
- Remove `context` parameter entirely

### 🟡 Moderate Issues (Acceptable but Could Be Better)

#### 7. **sessionTracker.js**
**Status: ✅ Mostly Clean**
- Uses `messagingAdapter` (port) correctly
- Uses domain entities correctly
- No direct infrastructure imports found

#### 8. **keepAllDetector.js**
**Violations:**
- Directly imports `getLogger()` (line 6)
- Uses `getLogger().log()` directly (line 64)

**Should use:**
- `ILoggerPort` (needs to be created) for logging

#### 9. **reviewSession.js**
**Status: ✅ Clean**
- Pure domain entity
- No infrastructure dependencies

#### 10. **suggestionBatch.js**
**Status: ✅ Clean**
- Pure domain entity
- No infrastructure dependencies

## Required Ports (Missing)

The following ports need to be created:

1. **ILoggerPort** - For logging operations
   ```javascript
   class ILoggerPort {
       log(message, force = false, show = false, sourceKey = null) { throw new Error('...'); }
       debug(message, sourceKey = null) { throw new Error('...'); }
       error(message, error = null) { throw new Error('...'); }
   }
   ```

2. **IFileSystemPort** - For filesystem operations
   ```javascript
   class IFileSystemPort {
       watch(path, options, callback) { throw new Error('...'); }
       stat(path, callback) { throw new Error('...'); }
       readdirSync(path, options) { throw new Error('...'); }
       readFileSync(path, encoding) { throw new Error('...'); }
   }
   ```

3. **IIdGeneratorPort** - For ID generation
   ```javascript
   class IIdGeneratorPort {
       generateUUID() { throw new Error('...'); }
       generateId() { throw new Error('...'); }
   }
   ```

4. **IHashGeneratorPort** - For hashing operations
   ```javascript
   class IHashGeneratorPort {
       createHash(algorithm, data) { throw new Error('...'); }
   }
   ```

## Refactoring Plan

### Phase 1: Create Missing Ports
1. Create `ILoggerPort` in `domain/ports/`
2. Create `IFileSystemPort` in `domain/ports/`
3. Create `IIdGeneratorPort` in `domain/ports/`
4. Create `IHashGeneratorPort` in `domain/ports/`

### Phase 2: Create Adapters
1. Create `loggerAdapter.js` implementing `ILoggerPort`
2. Create `fileSystemAdapter.js` implementing `IFileSystemPort`
3. Create `idGeneratorAdapter.js` implementing `IIdGeneratorPort`
4. Create `hashGeneratorAdapter.js` implementing `IHashGeneratorPort`

### Phase 3: Refactor Entities
1. **fileWatcher.js**: Inject `IFileSystemPort` and `ILoggerPort`, remove direct imports
2. **debtManager.js**: Remove `PersistInContext` import, require `IAwarenessPersistencePort`, inject `ILoggerPort`
3. **agentSuggestionHandler.js**: Inject `IIdGeneratorPort` and `ILoggerPort`, use `IAwarenessVSCodePort` for types
4. **eventHandlers.js**: Inject `ILoggerPort`, use `IAwarenessVSCodePort` for types
5. **scoreCalculator.js**: Inject `ILoggerPort`, remove direct `vscode` import
6. **changeLedger.js**: Inject `IHashGeneratorPort`, remove `context` parameter, require `IAwarenessPersistencePort`

### Phase 4: Update Service Layer
Update `awarenessService.js` to inject all required ports into domain entities.

## Current State Summary

| Entity | Status | Issues |
|--------|--------|--------|
| fileWatcher.js | ❌ | Direct `vscode`, `fs`, `path`, `logger` imports |
| debtManager.js | ❌ | Direct `logger`, `PersistInContext` imports |
| agentSuggestionHandler.js | ❌ | Direct `vscode`, `path`, `crypto`, `logger` imports |
| eventHandlers.js | ❌ | Direct `vscode`, `logger` imports |
| scoreCalculator.js | ❌ | Direct `vscode`, `logger` imports |
| changeLedger.js | ❌ | Direct `crypto` import, uses `context` directly |
| sessionTracker.js | ✅ | Clean (uses ports correctly) |
| keepAllDetector.js | ❌ | Direct `logger` import |
| reviewSession.js | ✅ | Clean (pure domain) |
| suggestionBatch.js | ✅ | Clean (pure domain) |

## Conclusion

**7 out of 10 entities violate domain layer isolation.** The domain layer should be completely isolated from infrastructure concerns. All external dependencies should be injected as ports (interfaces) that are implemented by adapters in the infrastructure layer.

### Clean Entities (3/10)
- ✅ sessionTracker.js - Uses ports correctly
- ✅ reviewSession.js - Pure domain entity
- ✅ suggestionBatch.js - Pure domain entity
