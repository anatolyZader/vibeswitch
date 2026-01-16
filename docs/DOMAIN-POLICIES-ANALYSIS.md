# Domain Policies Analysis

## What Are Domain Policies?

In Domain-Driven Design (DDD), **policies** are stateless objects that encapsulate business rules or strategies that don't naturally belong to a single entity or value object.

**Characteristics:**
- **Stateless** - No mutable state
- **Business rules** - Encapsulate domain logic/rules
- **Reusable** - Can be used by multiple entities/services
- **Testable** - Easy to test in isolation

**When to use policies:**
- Business rules that span multiple entities
- Rules that might change independently
- Complex conditional logic that represents business strategy
- Rules that need to be configurable or swappable

## Current State

The `domain/policies/` directory exists but is **empty**.

## Business Rules Found in Code

### 1. **Eviction Policy** (in `suggestionAggregate.js`)
**Current implementation:**
```javascript
// Eviction policy
this.MAX_TOTAL_SUGGESTIONS = 5000; // Global cap
this._evictionThreshold = 0.9; // Evict when 90% full (4500)
```

**Should be a policy?**
- ✅ **YES** - This is a business rule that could change
- ✅ **YES** - Could be configurable per mode ('vibe' vs 'dev')
- ✅ **YES** - Encapsulates "when to evict" logic

**Proposed:**
```javascript
// domain/policies/suggestionEvictionPolicy.js
class SuggestionEvictionPolicy {
    constructor(maxSuggestions = 5000, evictionThreshold = 0.9) {
        this.maxSuggestions = maxSuggestions;
        this.evictionThreshold = evictionThreshold;
    }
    
    shouldEvict(currentCount) {
        return currentCount >= this.maxSuggestions * this.evictionThreshold;
    }
    
    getEvictionTarget(currentCount) {
        return Math.floor(this.maxSuggestions * 0.8); // Evict to 80%
    }
}
```

### 2. **Review Session Engagement Policy** (in `reviewSession.js`)
**Current implementation:**
```javascript
hasSufficientEngagement() {
    // Business rule: sufficient engagement if:
    // - At least 3 changes reviewed, OR
    // - Review time > 5 seconds, OR
    // - At least 1 edit made
    return this.totalChanges >= 3 || 
           this.reviewTime > 5000 || 
           this.editCount > 0;
}
```

**Should be a policy?**
- ✅ **YES** - This is a clear business rule
- ✅ **YES** - Could be configurable
- ✅ **YES** - Represents "what counts as engagement"

**Proposed:**
```javascript
// domain/policies/reviewEngagementPolicy.js
class ReviewEngagementPolicy {
    constructor({
        minChanges = 3,
        minReviewTimeMs = 5000,
        minEdits = 1
    } = {}) {
        this.minChanges = minChanges;
        this.minReviewTimeMs = minReviewTimeMs;
        this.minEdits = minEdits;
    }
    
    hasSufficientEngagement(session) {
        return session.totalChanges >= this.minChanges ||
               session.reviewTime > this.minReviewTimeMs ||
               session.editCount >= this.minEdits;
    }
}
```

### 3. **Keep-All Detection Policy** (in `suggestionLifecycleService.js`)
**Current implementation:**
```javascript
// Keep-all detection: 3+ acceptances in 2 seconds
this.keepAllDetectionWindow = 2000; // 2 seconds
this.keepAllThreshold = 3; // 3+ acceptances
```

**Should be a policy?**
- ✅ **YES** - This is a business rule for pattern detection
- ✅ **YES** - Could be configurable
- ✅ **YES** - Represents "what counts as keep-all"

**Proposed:**
```javascript
// domain/policies/keepAllDetectionPolicy.js
class KeepAllDetectionPolicy {
    constructor({
        windowMs = 2000,
        threshold = 3
    } = {}) {
        this.windowMs = windowMs;
        this.threshold = threshold;
    }
    
    isKeepAllPattern(acceptances, timestamps) {
        // Check if threshold+ acceptances within window
        const now = Date.now();
        const recent = acceptances.filter((ts, i) => 
            now - ts < this.windowMs
        );
        return recent.length >= this.threshold;
    }
}
```

### 4. **Score Calculation Policy** (scattered in various places)
**Current implementation:**
- Score calculation logic is in `AwarenessEngine.getScore()`
- Various thresholds and weights are hardcoded

**Should be a policy?**
- ✅ **YES** - Score calculation is a business rule
- ✅ **YES** - Could be configurable per mode
- ✅ **YES** - Represents "how to calculate awareness"

**Proposed:**
```javascript
// domain/policies/awarenessScorePolicy.js
class AwarenessScorePolicy {
    constructor({
        suggestionWeight = 0.4,
        debtWeight = 0.6,
        maxScore = 100
    } = {}) {
        this.suggestionWeight = suggestionWeight;
        this.debtWeight = debtWeight;
        this.maxScore = maxScore;
    }
    
    calculateScore(suggestions, debt) {
        // Business rule for score calculation
        const suggestionScore = this._calculateSuggestionScore(suggestions);
        const debtScore = this._calculateDebtScore(debt);
        return Math.min(
            suggestionScore * this.suggestionWeight + debtScore * this.debtWeight,
            this.maxScore
        );
    }
}
```

## Recommendations

### Extract to Policies

1. ✅ **SuggestionEvictionPolicy** - Extract eviction logic from `SuggestionAggregate`
2. ✅ **ReviewEngagementPolicy** - Extract engagement rules from `ReviewSession`
3. ✅ **KeepAllDetectionPolicy** - Extract keep-all detection from `SuggestionLifecycleService`
4. ✅ **AwarenessScorePolicy** - Extract score calculation from `AwarenessEngine`

### Benefits

1. **Testability** - Policies can be tested in isolation
2. **Configurability** - Rules can be swapped or configured
3. **Clarity** - Business rules are explicit and documented
4. **Reusability** - Policies can be shared across entities/services

### Implementation Strategy

1. Create policy classes in `domain/policies/`
2. Inject policies into entities/services that need them
3. Move business rule logic from entities to policies
4. Make policies configurable (can be passed via constructor)

## Example: Refactoring Eviction Policy

**Before:**
```javascript
// In SuggestionAggregate
if (this.suggestionsById.size >= this.MAX_TOTAL_SUGGESTIONS * this._evictionThreshold) {
    this._evictSuggestions();
}
```

**After:**
```javascript
// In SuggestionAggregate constructor
this.evictionPolicy = evictionPolicy || new SuggestionEvictionPolicy();

// In addSuggestion
if (this.evictionPolicy.shouldEvict(this.suggestionsById.size)) {
    this._evictSuggestions(this.evictionPolicy.getEvictionTarget(this.suggestionsById.size));
}
```

## Conclusion

**Yes, you should use policies** for business rules that:
- Are configurable
- Don't belong to a single entity
- Represent business strategy
- Might change independently

The current codebase has several business rules that would benefit from being extracted into policies.
