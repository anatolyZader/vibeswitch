# Test Implementation Plan - Awareness Score Algorithm

**Date:** January 23, 2026  
**Status:** In Progress

## Phase 1: Foundation Tests (Current)

### ✅ Completed
- Test helpers: `mkSuggestion.js`, `scoringTestConfig.js`
- Constants scoping tests
- Effective review consistency tests

### 🔄 In Progress
- Comprehensive unit tests for each calculator function

### 📋 Remaining
- Blind acceptance unit tests
- Adaptation unit tests  
- Debt risk unit tests
- ScoreService orchestration tests
- Integration tests
- Replay tests
- Property-based tests

## Test Structure

```
tests/
├── helpers/
│   ├── mkSuggestion.js ✅
│   └── fakeTimerRegistry.js (needed for lifecycle tests)
├── config/
│   └── scoringTestConfig.js ✅
└── business_modules/awareness/app/scoring/__tests__/
    ├── scoreCalculations.constants.test.js ✅
    ├── scoreCalculations.effectiveReview.test.js ✅
    ├── scoreCalculations.review.test.js (in progress)
    ├── scoreCalculations.blind.test.js
    ├── scoreCalculations.adaptation.test.js
    ├── scoreCalculations.debtRisk.test.js
    └── scoreService.regimes.test.js
```

## Priority Tests (First 10 Must-Have)

1. ✅ Review score empty input → 0; no NaN
2. ✅ Review score saturates (doubling time doesn't double score)
3. ⏳ Blind accept dominates: all blind accepts → ~30
4. ✅ Effective review vs boolean reviewed changes blind risk correctly
5. ⏳ Adaptation depth diminishing returns works (if exp)
6. ⏳ Debt age multiplier boundaries (0h/1h/6h)
7. ⏳ ScoreService "no recent activity + debt" glides via EMA (no jump)
8. ⏳ Lifecycle produces accepted without review (so blind acceptance can trigger)
9. ⏳ No double-counting between fileDebt and pending suggestion debt
10. ⏳ Replay fixture: score moves in expected direction at key events

## Next Steps

1. Complete unit tests for all calculator functions
2. Add ScoreService regime tests
3. Create integration test harness
4. Implement replay infrastructure
