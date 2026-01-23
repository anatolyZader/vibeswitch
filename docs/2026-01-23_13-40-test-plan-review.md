# Test Plan Review - Awareness Score Algorithm

**Date:** January 23, 2026  
**Reviewer:** AI Assistant  
**Source:** ChatGPT Proposal

---

## Overall Assessment

**Verdict: ✅ Excellent and Production-Ready**

This is a **comprehensive, engineering-grade test plan** that covers correctness, precision, stability, and non-gameability. The structure is logical, the priorities are clear, and it addresses real production concerns.

---

## Strengths

### 1. **Comprehensive Coverage**
- Unit → Integration → Scenario → Replay → Fuzz (complete pyramid)
- Covers all critical paths: empty inputs, edge cases, monotonicity, stability
- Addresses real concerns: gaming vectors, NaN/Infinity, lifecycle consistency

### 2. **Practical Prioritization**
- The "first 10 must-have tests" is spot-on for ROI
- Table-driven tests for golden cases (maintainable)
- Replay-based calibration (catches real-world issues)

### 3. **Addresses Known Issues**
- ✅ Monotonic expectations (catches regressions)
- ✅ Lifecycle consistency (the "blind acceptance observable" concern)
- ✅ Double-counting verification (fileDebt + pending)
- ✅ Stability tests (EMA smoothness, no hard discontinuities)

### 4. **Engineering Best Practices**
- Deterministic time injection (fake timers)
- Test fixtures for replay
- Property-based testing (fast-check)
- Performance/load tests

---

## Critical Gaps & Concerns

### 1. **Lifecycle Semantics Issue (Must Address First)**

**Problem:** The test plan assumes "blind acceptance" is observable, but current implementation has a gap:

```javascript
// Current: checkSuggestionStatus() only marks 'accepted' if reviewed=true
if (suggestion.reviewed) {
    this.suggestionAggregate.updateSuggestionStatus(suggestion, 'accepted');
}
// If not reviewed, stays 'pending' forever → never becomes 'accepted'
```

**Impact on Tests:**
- S1 (Blind accept scenario) **cannot be tested** without fixing lifecycle first
- Blind acceptance score will always be 0 if suggestions never become accepted without review
- Tests will fail or give false positives

**Recommendation:**
- **Fix lifecycle first** (add timeout or allow acceptance without review)
- **Then** implement S1 test
- Or document this as a known limitation and test "pending debt accumulation" instead

### 2. **Debt Double-Counting (Architectural Issue)**

**Problem:** Test plan mentions verifying "no double-counting between fileDebt and pending suggestion debt", but the current architecture may still have this issue:

- FileDebt is added when suggestions are created
- Pending suggestions also contribute to debt
- Same change counted twice

**Recommendation:**
- **Fix architecture first** (as noted in review: don't add fileDebt at creation, add when accepted/adapted)
- **Then** add test S7 to verify no double-counting
- Or test current behavior and document as technical debt

### 3. **Missing: Effective Review Consistency Test**

**Critical Gap:** The test plan doesn't explicitly verify that `isEffectivelyReviewed()` is used consistently across:
- Review score resolution bonus
- Blind acceptance "careful accept" check
- Adapted mitigation check

**Recommendation:** Add test:
```javascript
test('isEffectivelyReviewed used consistently across all components', () => {
  // Create suggestion with reviewed=true but reviewTime=0
  // Verify: resolution bonus doesn't count it, blind acceptance treats as "blind", adapted mitigation doesn't apply
});
```

### 4. **Missing: Constant Scoping Test**

**Gap:** Test plan mentions "freeze constants for testing" but doesn't verify they're actually accessible/imported correctly.

**Recommendation:** Add test:
```javascript
test('all constants are defined and accessible', () => {
  expect(TARGET_SEC_PER_KCHAR).toBeDefined();
  expect(MINIMUM_REVIEW_TIME_MS).toBeDefined();
  // etc.
});
```

### 5. **Replay Fixtures: Sanitization Strategy**

**Concern:** The plan mentions "sanitized trace" but doesn't specify:
- What data to sanitize (file paths? code content?)
- Privacy considerations
- How to handle sensitive information

**Recommendation:** Document sanitization strategy:
- Replace file paths with placeholders (`/file1.js`, `/file2.js`)
- Replace code content with size-only metadata
- Hash or anonymize any identifiers

---

## Implementation Priorities

### Phase 1: Foundation (Week 1)
1. ✅ Unit tests for pure calculators (1.1-1.4)
2. ✅ Test helpers (`mkSuggestion`, fake timers, stubs)
3. ✅ Invariant tests (ranges, NaN, empty input)
4. ⚠️ **Fix lifecycle first** (allow blind acceptance) OR document limitation

### Phase 2: Integration (Week 2)
5. ✅ ScoreService branch coverage (2.2)
6. ✅ Effective review consistency test (add to 2.3)
7. ✅ Constant scoping test (add to 2.3)
8. ⚠️ **Fix debt double-counting** OR document current behavior

### Phase 3: Scenarios (Week 3)
9. ✅ S2-S4 (careful accept, rejection, adaptation)
10. ✅ S5-S7 (pending debt, multi-range, criticality)
11. ⚠️ S1 (blind accept) - **only if lifecycle fixed**

### Phase 4: Replay & Fuzz (Week 4)
12. ✅ Replay infrastructure
13. ✅ 2-3 replay fixtures
14. ✅ Property-based tests (fast-check)
15. ✅ Performance tests

---

## Specific Test Recommendations

### Add to Unit Tests (1.1)

**Review Score:**
```javascript
test('review depth requires MIN_REVIEWED_SIZE (200 chars)', () => {
  // 5 chars reviewed for 5 seconds → depth = 0 (not gamed)
  const suggestions = [mkSuggestion({ reviewed: true, reviewTime: 5000, size: 5 })];
  const score = calculateReviewScore(suggestions);
  // depth should be 0, not positive
});
```

**Blind Acceptance:**
```javascript
test('effectiveReviewed required for adapted mitigation', () => {
  // adapted=true but reviewTime=0 → mitigation should NOT apply
  const suggestions = [
    mkSuggestion({ status: 'adapted', reviewed: true, reviewTime: 0 })
  ];
  const risk = calculateBlindAcceptanceScore(suggestions);
  // mitigation should not reduce risk (no effective review)
});
```

### Add to Integration Tests (3.2)

**Lifecycle Consistency:**
```javascript
test('suggestion can become accepted without review (if timeout implemented)', async () => {
  // Create suggestion, don't review, wait for timeout
  // Verify: status becomes 'accepted', blind acceptance score > 0
  // NOTE: This test will fail until lifecycle is fixed
});
```

**Debt Clearing:**
```javascript
test('fileDebt cleared when suggestion rejected', async () => {
  // Create suggestion → fileDebt added
  // Reject suggestion → fileDebt should be cleared/adjusted
  // Verify: debt score decreases
});
```

---

## Test Infrastructure Needs

### 1. Test Helpers (Priority: High)

**`test/helpers/mkSuggestion.js`:**
```javascript
function mkSuggestion(overrides = {}) {
  const now = Date.now();
  return {
    id: `test-${Math.random()}`,
    document: 'file:///test.js',
    range: { start: { line: 0, character: 0 }, end: { line: 1, character: 0 } },
    text: 'test',
    size: 100,
    status: 'pending',
    reviewed: false,
    reviewTime: 0,
    editCount: 0,
    timestamp: now,
    rangeCount: 1,
    provenanceScore: 0.8,
    ...overrides
  };
}
```

**`test/helpers/fakeTimerRegistry.js`:**
```javascript
class FakeTimerRegistry {
  constructor() {
    this.timers = new Map();
    this.now = Date.now();
  }
  
  schedule(callback, delay, id) {
    this.timers.set(id, { callback, fireAt: this.now + delay });
  }
  
  tick(ms) {
    this.now += ms;
    for (const [id, timer] of this.timers) {
      if (this.now >= timer.fireAt) {
        timer.callback();
        this.timers.delete(id);
      }
    }
  }
}
```

### 2. Test Configuration (Priority: High)

**`test/config/scoringTestConfig.js`:**
```javascript
module.exports = {
  MINIMUM_REVIEW_TIME_MS: 5000,
  TARGET_SEC_PER_KCHAR: 12,
  EMA_ALPHA: 0.3,
  SCORING_HORIZON_MS: 15 * 60 * 1000,
  SCORING_HORIZON_COUNT: 20,
  PENDING_SOFT_CAP: 5,
  MIN_REVIEWED_SIZE: 200
};
```

### 3. Mock Services (Priority: Medium)

- `FakeVscodeAdapter` (minimal VS Code API)
- `FakePersistencePort` (in-memory storage)
- `FakeLoggerPort` (captures logs for assertions)

---

## Known Limitations to Document

### 1. Lifecycle Gap
- **Current:** Suggestions never become "accepted" without review
- **Impact:** Blind acceptance score may always be 0
- **Workaround:** Test "pending debt accumulation" instead of "blind accept"

### 2. Debt Double-Counting
- **Current:** FileDebt + pending suggestions may count same change twice
- **Impact:** Debt score may be inflated
- **Workaround:** Test current behavior, document as known issue

### 3. Time-Dependent Tests
- **Challenge:** Some tests depend on real time (age multipliers, EMA)
- **Solution:** Use fake timers consistently

---

## Recommended Test File Structure

```
tests/
  business_modules/
    awareness/
      app/
        scoring/
          __tests__/
            scoreCalculations.review.test.js
            scoreCalculations.blind.test.js
            scoreCalculations.adaptation.test.js
            scoreCalculations.debtRisk.test.js
            scoreService.regimes.test.js
            scoreService.ema.test.js
        __tests__/
          lifecycle_to_score.integration.test.js
          debt_clearing.integration.test.js
  fixtures/
    session_blind_accept.jsonl
    session_careful_review.jsonl
    session_pending_debt.jsonl
  helpers/
    mkSuggestion.js
    fakeTimerRegistry.js
    fakeVscodeAdapter.js
    fakePersistencePort.js
    replayRunner.js
  config/
    scoringTestConfig.js
```

---

## Conclusion

**This test plan is excellent and should be implemented.** However:

1. **Fix lifecycle semantics first** (allow blind acceptance) OR document limitation
2. **Fix debt double-counting** OR document current behavior
3. **Add effective review consistency test** (critical gap)
4. **Add constant scoping test** (prevents ReferenceError)
5. **Document sanitization strategy** for replay fixtures

With these additions, this test plan will provide **production-grade confidence** in the awareness score algorithm.

**Estimated Implementation Time:**
- Phase 1 (Foundation): 2-3 days
- Phase 2 (Integration): 2-3 days
- Phase 3 (Scenarios): 3-4 days
- Phase 4 (Replay & Fuzz): 2-3 days
- **Total: ~2 weeks** for full implementation

**Minimum Viable Test Suite (Week 1):**
- Unit tests for all 4 calculators (invariants + golden cases)
- ScoreService branch coverage
- Effective review consistency test
- **Total: ~1 week** for MVP
