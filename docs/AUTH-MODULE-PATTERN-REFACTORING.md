# Auth Module Pattern Refactoring

## Overview

Refactored `AwarenessService` to follow the exact pattern from the auth module: **Domain entities/services receive ports as method parameters, and the service passes adapters when calling those methods.**

## Pattern from Auth Module

### Domain Entity (User)
```javascript
// user.js
class User {
    constructor() {
        // No constructor dependencies
    }
    
    async getUserInfo(email, IAuthPersistPort) {
        // Port received as method parameter
        const userDTO = await IAuthPersistPort.getUserInfo(email);
        return userDTO;
    }
}
```

### Service (UserService)
```javascript
// userService.js
class UserService {
    constructor({ authPersistAdapter }) {
        this.authPersistAdapter = authPersistAdapter;
        this.User = User;
    }
    
    async getUserInfo(email) {
        // Create entity instance
        const userInstance = new this.User();
        
        // Pass adapter as port to entity method
        const userData = await userInstance.getUserInfo(email, this.authPersistAdapter);
        return userData;
    }
}
```

## Changes Made

### 1. Refactored EventSubscriptionService

**Before (❌ Constructor Injection):**
```javascript
class EventSubscriptionService {
    constructor(vscodePort) {
        this.vscodePort = vscodePort;
    }
    
    subscribeToTextDocumentChanges(handler) {
        return this.vscodePort.onDidChangeTextDocument(handler);
    }
}
```

**After (✅ Method Parameter):**
```javascript
class EventSubscriptionService {
    constructor() {
        // No constructor dependencies - ports passed as method parameters
    }
    
    subscribeToTextDocumentChanges(handler, vscodePort) {
        // Port received as method parameter
        return vscodePort.onDidChangeTextDocument(handler);
    }
}
```

### 2. Refactored VSCodeWorkspaceService

**Before (❌ Constructor Injection):**
```javascript
class VSCodeWorkspaceService {
    constructor(vscodePort) {
        this.vscodePort = vscodePort;
    }
    
    asRelativePath(uri) {
        return this.vscodePort.asRelativePath(uri);
    }
}
```

**After (✅ Method Parameter):**
```javascript
class VSCodeWorkspaceService {
    constructor() {
        // No constructor dependencies - ports passed as method parameters
    }
    
    asRelativePath(uri, vscodePort) {
        // Port received as method parameter
        return vscodePort.asRelativePath(uri);
    }
}
```

### 3. Updated AwarenessService

**Before (❌ Direct Adapter Calls):**
```javascript
// Service calling adapter directly
this.vscodeAdapter.onDidChangeTextDocument((event) => {
    this.eventHandlers.onTextChange(event);
});

asRelativePath(uri) {
    return this.vscodeAdapter.asRelativePath(uri);
}
```

**After (✅ Domain Service with Ports as Parameters):**
```javascript
// Create domain service instance (no dependencies)
this.eventSubscriptionService = new EventSubscriptionService();
this.vscodeWorkspaceService = new VSCodeWorkspaceService();

// Pass adapter as port to domain service method
this.disposables.push(
    this.eventSubscriptionService.subscribeToTextDocumentChanges(
        (event) => {
            this.eventHandlers.onTextChange(event);
        },
        this.vscodeAdapter // Pass adapter as port
    )
);

asRelativePath(uri) {
    // Pass adapter as port to domain service method
    return this.vscodeWorkspaceService.asRelativePath(uri, this.vscodeAdapter);
}
```

## Pattern Comparison

### Auth Module Pattern
```
UserService
    ↓ (creates entity)
new User()
    ↓ (calls method, passes adapter as port)
userInstance.getUserInfo(email, this.authPersistAdapter)
    ↓ (entity uses port)
IAuthPersistPort.getUserInfo(email)
```

### Awareness Module Pattern (After Refactoring)
```
AwarenessService
    ↓ (creates domain service)
new EventSubscriptionService()
    ↓ (calls method, passes adapter as port)
eventSubscriptionService.subscribeToTextDocumentChanges(handler, this.vscodeAdapter)
    ↓ (domain service uses port)
vscodePort.onDidChangeTextDocument(handler)
```

## Key Principles

1. **Domain entities/services have no constructor dependencies**
   - Ports are passed as method parameters
   - Entities/services are stateless (or state is managed internally)

2. **Service creates entity/service instances**
   - Service instantiates domain entities/services
   - No dependency injection into domain layer

3. **Service passes adapters to entity/service methods**
   - Adapters passed as method parameters
   - Entity/service methods receive ports (interfaces)

4. **Entity/service methods use ports**
   - Methods receive ports as parameters
   - Use ports to perform operations
   - No direct dependency on adapters

## Benefits

1. **Consistent Pattern**
   - Matches auth module pattern exactly
   - Same approach across all modules

2. **Stateless Domain Services**
   - No constructor dependencies
   - Ports passed when needed
   - Easier to test and reason about

3. **Clear Dependencies**
   - Service knows what adapters it needs
   - Domain services don't store adapters
   - Dependencies flow through method calls

4. **Better Testability**
   - Domain services can be tested without adapters
   - Mock ports passed to methods
   - No need to inject adapters in tests

## Verification

✅ **Domain services have no constructor dependencies**
✅ **Ports passed as method parameters**
✅ **Service creates domain service instances**
✅ **Service passes adapters to domain service methods**
✅ **Matches auth module pattern exactly**

## Summary

The refactoring is complete and now follows the exact pattern from the auth module:

- ✅ Domain services receive ports as **method parameters** (not constructor)
- ✅ Service creates domain service instances (no dependencies)
- ✅ Service passes adapters to domain service methods
- ✅ Domain services use ports (interfaces), not adapters directly

This ensures consistency across the entire codebase and follows the established pattern from the modular monolith.
