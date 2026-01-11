# Domain Services vs Domain Entities: When to Use Each

## Question

Should `EventSubscriptionService` and `VSCodeWorkspaceService` be moved to domain entities as methods?

## Current Structure

### Domain Services (Stateless Utilities)
- `EventSubscriptionService` - VS Code event subscription
- `VSCodeWorkspaceService` - VS Code workspace operations

### Domain Entities (Business Concepts with Identity)
- `Change` - Text document change
- `Suggestion` - AI-generated suggestion
- `Debt` - Review debt for a file
- `ReviewSession` - User review session
- `SuggestionBatch` - Batch of related suggestions

## DDD Principles

### Domain Entities
- **Have identity** (unique identifier)
- **Have state** (mutable properties)
- **Represent business concepts** (Suggestion, Debt, Change)
- **Encapsulate business logic** related to that concept
- **Methods operate on entity state**

### Domain Services
- **Stateless** (no identity, no mutable state)
- **Operations that don't belong to a single entity**
- **Operations that represent domain concepts but aren't entities**
- **Operations that coordinate multiple entities**

## Analysis

### EventSubscriptionService

**Current:** Stateless service for VS Code event subscription

**Should it be an entity method?**
- ❌ **No identity** - Not a business concept
- ❌ **No state** - Pure utility operations
- ❌ **Infrastructure concern** - Adapting VS Code API to domain
- ❌ **Doesn't belong to any entity** - Not related to Change, Suggestion, Debt, etc.

**Verdict:** Should remain a **domain service** (or could be a utility/helper)

### VSCodeWorkspaceService

**Current:** Stateless service for VS Code workspace operations

**Should it be an entity method?**
- ❌ **No identity** - Not a business concept
- ❌ **No state** - Pure utility operations
- ❌ **Infrastructure concern** - Adapting VS Code API to domain
- ❌ **Doesn't belong to any entity** - Workspace operations are infrastructure

**Verdict:** Should remain a **domain service** (or could be a utility/helper)

## Comparison with Git Module

### Git Module Pattern
```javascript
// Repository is a DOMAIN ENTITY (represents a business concept)
class Repository {
    constructor(userIdRaw) {
        this.userId = userIdRaw; // Has identity (userId)
    }
    
    // Entity method that uses port
    async fetchRepo(repoIdRaw, IGitPort) {
        // Uses port to fetch repository data
        return await IGitPort.fetchRepo(this.userId.value, repoId.value);
    }
}
```

**Key Point:** `Repository` is a **domain entity** because:
- ✅ Has identity (`userId`)
- ✅ Represents a business concept (a repository owned by a user)
- ✅ Methods operate on entity state

### Awareness Module Services

**EventSubscriptionService** and **VSCodeWorkspaceService** are **NOT entities** because:
- ❌ No identity
- ❌ No state
- ❌ Don't represent business concepts
- ❌ Infrastructure utilities

## Alternative: Utility Functions

Since these services are **stateless utilities**, they could be:

### Option 1: Keep as Domain Services (Current)
```javascript
class EventSubscriptionService {
    subscribeToTextDocumentChanges(handler, vscodePort) {
        return vscodePort.onDidChangeTextDocument(handler);
    }
}
```

**Pros:**
- Clear separation
- Can be extended with more methods
- Follows service pattern

**Cons:**
- Extra class for simple delegation

### Option 2: Convert to Utility Functions
```javascript
// domain/utils/vscodeEventUtils.js
function subscribeToTextDocumentChanges(handler, vscodePort) {
    return vscodePort.onDidChangeTextDocument(handler);
}
```

**Pros:**
- Simpler (no class needed)
- Stateless utilities don't need classes
- Matches functional style

**Cons:**
- Less organized
- Harder to extend

### Option 3: Static Methods on Utility Class
```javascript
// domain/utils/vscodeEventUtils.js
class VSCodeEventUtils {
    static subscribeToTextDocumentChanges(handler, vscodePort) {
        return vscodePort.onDidChangeTextDocument(handler);
    }
}
```

**Pros:**
- Organized in a class
- No instance needed
- Clear namespace

**Cons:**
- Still a class (though static)

## Recommendation

### Keep as Domain Services (Current Approach) ✅

**Reasoning:**
1. **They're infrastructure adapters** - Adapting VS Code API to domain ports
2. **They don't represent business entities** - No identity, no state
3. **They're stateless utilities** - Perfect use case for domain services
4. **They follow the pattern** - Service creates instance, passes adapters to methods

### When to Move to Entities

Move operations to entities **only if**:
- ✅ The operation belongs to a specific entity
- ✅ The operation operates on entity state
- ✅ The entity has identity and represents a business concept

**Example (if we had a Workspace entity):**
```javascript
// If Workspace was a domain entity
class Workspace {
    constructor(workspaceId) {
        this.workspaceId = workspaceId; // Has identity
    }
    
    // Entity method
    asRelativePath(uri, vscodePort) {
        return vscodePort.asRelativePath(uri);
    }
}
```

But `Workspace` isn't a business concept in the awareness domain - it's infrastructure.

## Conclusion

**Keep `EventSubscriptionService` and `VSCodeWorkspaceService` as domain services.**

They are:
- ✅ Stateless utilities
- ✅ Infrastructure adapters
- ✅ Not business entities
- ✅ Don't belong to any specific entity

**Alternative:** If you want to simplify, they could be converted to **utility functions** or **static utility methods**, but keeping them as domain services is also valid and follows the established pattern.

The key principle: **Only move to entities if they represent business concepts with identity and state.**
