# Proposal: Extensive Awareness Score & Meter Test Suite

**Goal:** Build a test suite that (1) clarifies the relationship between your behavior with the Cursor agent and the awareness meter, and (2) validates correctness of awareness-score logic and meter UI with hundreds of simulated operations.

---

## Implemented (High-ROI)

- **@vscode/test-electron integration tests** (`test/runTest.js`, `test/suite/`, `test/workspace/`): Extension host tests that activate the extension, run `vibeswitch._testGetScore` (when `VIBESWITCH_INTEGRATION_TEST=1`), and assert score shape; optional file create/edit then re-assert. Run: `npm run test:electron`.
- **30 golden behavior scenarios** (`tests/awareness/golden/goldenScenarios.js`, `golden.scenarios.test.js`): Curated traces with explicit expected subscores (review, blindAcceptance, adaptation, debt), totalScoreRange, and optional meterSegments/meterEmoji. Named scenarios (e.g. blind_accept_core_file, slow_careful_review_then_accept, five_pending) make failures meaningful.
- **Property-based test with shrinking** (`tests/awareness/property/lifecycle.property.test.js`): fast-check generates valid lifecycle traces (created → optional reviewed → optional status_changed); property: all replay snapshots have score in [0,100] and no NaN. Shrinking yields minimal failing trace on invariant violation.

### Strengthened (next round)

- **Debug snapshot + electron deltas**: `vibeswitch._testGetDebugSnapshot()` returns `{ score, breakdown, counters, meterViewModel }` when `VIBESWITCH_INTEGRATION_TEST=1`. Counters: suggestionsTotal, accepted, rejected, adapted, pending, debtFileCount. Electron tests assert: after file edit, counters or score reflect activity; meter view model (segments, emoji) matches score.
- **ScoreBreakdown**: `awarenessEngine.getScoreBreakdown()` and `ScoreService.getScoreBreakdown()` return `{ contributions, counts, topFactors }` for explainability. Used in debug snapshot and golden breakdown tests.
- **10 core golden breakdown snapshots**: For scenarios (empty_trace, blind_accept_core_file, slow_careful_review_then_accept, …), tests assert breakdown.counts and breakdown.topFactors structure; view model (mapDomainStateToViewModel) consistency.
- **Two metamorphic property tests**: (1) T + extra review block ⇒ review score (good) does not decrease. (2) T + blind accept ⇒ blindAcceptance risk does not decrease.
- **mapDomainStateToViewModel contract**: Pure function `mapDomainStateToViewModel(scoreData, currentMode)` returns `{ segments, emoji, label, tooltipLines, warning, confidence }`. Snapshot tests for null, no-activity, low-risk, high-risk, debt-only states.

---

## 1. How Agent Behavior Maps to the Awareness Meter

### 1.1 Data flow (high level)

```
Agent/User actions in Cursor
    ↓
VS Code events (onDidChangeTextDocument, etc.)
    ↓
AwarenessEventListener → ClassificationService (AI vs user vs formatter)
    ↓
SuggestionLifecycleService + SuggestionAggregate + DebtService
    ↓
ScoreService.calculateScore(suggestions, debtService)
    ↓
AwarenessEngine.getScore() / updateScore()
    ↓
updateAwarenessMeter(awarenessBarItem, awarenessEngine, mode)
    ↓
Status bar: emoji + meter bar + tooltip
```

So the meter is the **last step** of a long pipeline. If the meter feels disconnected from your behavior, possible causes are:

- **Classification:** Your edits are not labeled as "AI" (e.g. no `@ai` marker, or detector thresholds), so no suggestions are created.
- **Review tracking:** "Reviewed" is set by dwell time + engagement; if the engine never marks a suggestion as reviewed, it stays pending and blind-accept logic may not apply as expected.
- **Time windows:** Score uses a "recent" window (~10s) and a "horizon" (15 min / last 20 resolved). Old activity drops out; the meter reflects recent + debt only.
- **EMA smoothing:** The displayed score is smoothed (EMA), so it lags sharp changes.

The test suite will make this pipeline **observable and testable** by driving it with explicit events and asserting at each layer.

### 1.2 What the score actually uses (inputs)

| Input | Source | Effect on score |
|-------|--------|------------------|
| **Suggestions** (status, count, timestamps) | SuggestionAggregate | Pending → debt risk; accepted/rejected/adapted → review / blind-acceptance / adaptation components |
| **reviewed**, **reviewTime** | Review tracking / aggregate | Blind accept vs careful accept; review score (0–40) |
| **editCount**, **userEdited** (adapted) | SuggestionLifecycleService | Adaptation score (0–30) |
| **File debt** (per file) | DebtService | Debt score (0–30); unreviewed files |
| **Time** | Recent window (10s), horizon (15 min / 20 resolved) | Which suggestions count as "recent" or "horizon" |

Final score is **risk** 0–100 (higher = worse): weighted mix of review risk, blind-acceptance risk, adaptation risk, debt risk. The meter shows this number, a 7-segment bar, and an emoji (🟢/🟡/🟠/🔴).

---

## 2. Test Suite Architecture

### 2.1 Layers

1. **Event / scenario generators** – Produce large streams of deterministic events (no VS Code).
2. **Scoring unit tests** – ScoreService + DebtService + SuggestionAggregate; inputs = suggestion lists + debt; assert score and components.
3. **Meter display unit tests** – getScoreMeter, getScoreEmoji, and tooltip text from score data; assert for given score/scoreData.
4. **Replay integration tests** – ReplayRunner + fixtures: event stream → aggregate + debt + ScoreService → snapshots; assert score progression and monotonicity.
5. **Engine integration tests** – AwarenessEngine with mocks: feed high-level "AI batch / status change / debt" and assert getScore() and that updateScore() runs.
6. **UI integration tests** – Mock StatusBarItem and awarenessEngine.getScore(); call updateAwarenessMeter; assert .text, .tooltip, .backgroundColor.

No real VS Code or real Cursor agent; everything is driven by generated events and mocks so we can run hundreds of scenarios in CI.

### 2.2 Event and scenario generators

**Location:** `tests/awareness/generators/` (new).

- **suggestionEventGenerator.js**
  - `generateSuggestionCreated({ document, size, timestamp, provenanceScore })`
  - `generateStatusChange(suggestionId, status, { reviewTime, editCount })`
  - `generateBulkScenario({ count, mix: { accepted, rejected, adapted, pending }, timeSpreadMs })` → array of replay events
- **replayEventGenerator.js**
  - `generateRandomReplay({ eventCount, seed })` – deterministic from seed; event types and params from distributions.
  - `generateRegimeScenarios()` – fixed scenarios: "all blind accept", "all careful review", "all adapted", "all pending", "mixed", "debt only", "empty".
- **timeAdvanceGenerator.js**
  - Interleave `tick` events (advanceMs) so "recent" vs "horizon" vs "dropped" can be controlled.

**Target:** Generate fixtures with 50–500 events per scenario, multiple scenarios, so the suite runs hundreds of "requests" through the pipeline.

### 2.3 Scoring correctness tests (bulk)

**Location:** `tests/business_modules/awareness/app/scoring/__tests__/` (extend).

- **scoreCalculations.bulk.test.js**
  - For each regime (blind, careful, adapted, pending, debt-only, mixed), generate 100+ suggestions via ReplayRunner or direct aggregate + debt.
  - Assert: score in [0,100]; components in expected ranges; relative ordering (e.g. blind > careful for blindAcceptance).
- **scoreService.regimes.bulk.test.js**
  - Reuse existing regime tests; add more regimes and larger suggestion counts (e.g. 50 pending, 20 accepted, 10 adapted).
- **scoreService.monotonicity.test.js**
  - Given a baseline suggestion set, apply one more event (e.g. one more blind accept, one more pending, debt added). Assert score moves in the expected direction (or stays within tolerance if EMA smooths).
- **scoreService.bounds.test.js**
  - Empty state → 0 or "no activity" path; huge pending count → capped; all components max → 100.

### 2.4 Meter display tests

**Location:** `tests/ui/awarenessMeterDisplay.test.js` (new).

- **getScoreMeter(score)**
  - For score in [0, 14, 15, 50, 85, 100], assert exact segment string (e.g. 0 → "▱▱▱▱▱▱▱", 100 → "▰▰▰▰▰▰▰").
  - Property: filled segments = round((score/100)*7); no extra characters.
- **getScoreEmoji(score)**
  - 0–39 → 🟢, 40–59 → 🟡, 60–79 → 🟠, 80–100 → 🔴; test boundaries (39, 40, 59, 60, 79, 80).
- **updateAwarenessMeter (mocked)**
  - Mock awarenessBarItem (capture .text, .tooltip, .backgroundColor).
  - Mock awarenessEngine.getScore() returning fixed scoreData (currentScore, components, debt, etc.).
  - Call updateAwarenessMeter(barItem, engine, 'dev').
  - Assert: barItem.text contains correct emoji and meter; tooltip contains mode and score; for high score (e.g. 85) assert error background if that’s in the current logic.
- **Consistency**
  - For a given scoreData, the displayed score (parsed from tooltip or from bar text) should match awarenessEngine.getScore() (no double transform or sign flip).

### 2.5 Replay-based integration tests (hundreds of operations)

**Location:** `tests/awareness/integration/` (new).

- **replay_bulk.integration.test.js**
  - Load or generate fixtures with 200–500 events.
  - Replay via ReplayRunner; collect snapshots.
  - Assert: no NaN/Infinity; scores in [0,100]; at the end, component sum or weighted risk matches expectations for that scenario.
- **replay_regime_progression.test.js**
  - Fixtures: "start empty → 10 blind accepts → score goes up", "10 careful accepts → score stays low", "10 pending → then resolve half → score drops".
  - Assert: snapshots[i].score vs snapshots[i+1].score in expected direction (or stable within EMA).
- **replay_time_windows.test.js**
  - Events at t=0, t=5s, t=11s, t=16min; assert which events still affect "recent" vs "horizon" (may require injecting time into ScoreService or using fake timers).

### 2.6 Engine-level integration tests

**Location:** `tests/business_modules/awareness/app/` (extend).

- **awarenessEngine.score.integration.test.js**
  - Build AwarenessEngine with real ScoreService, DebtService, SuggestionAggregate, mock persistence/logger.
  - Do not use real event listener; instead call internal APIs that add suggestions and update status (or a small "test harness" that pushes events into the aggregate + debt).
  - After each batch of operations: engine.updateScore(); const scoreData = engine.getScore(); assert scoreData.currentScore, scoreData.components, scoreData.debt.
  - Run 50–100 such batches per test (e.g. 50 "add suggestion → accept" cycles).

### 2.7 End-to-end "behavior → meter" test (single place that ties it all together)

**Location:** `tests/awareness/e2e/behavior_to_meter.test.js` (new).

- **Setup:** Same as replay integration (ScoreService, DebtService, SuggestionAggregate, ReplayRunner) plus a **mock** for the meter UI (capture what would be shown).
- **Pipeline:**  
  1. Generate 200 events (mix of creates, status changes, time advances).  
  2. Replay events → after each event, run scoreService.calculateScore(...).  
  3. For the last 20 events, also compute "what the meter would show": getScoreMeter(score), getScoreEmoji(score), and a minimal tooltip string from scoreData.  
  4. Assert: (a) final score is in [0,100], (b) meter segments and emoji match the final score, (c) no "ERR" or "--" in the mock bar when suggestions exist.
- This test does not run VS Code; it runs the same math and the same display helpers that the real meter uses, so "behavior" (event stream) → "meter display" is fully deterministic and testable.

---

## 3. Fixtures and generators (concrete)

### 3.1 New fixtures (optional but useful)

- **fixtures/replay_200_mixed.json** – 200 events: 80 created, 40 accepted (20 blind, 20 careful), 20 rejected, 20 adapted, 40 pending, with time advances.
- **fixtures/replay_500_stress.json** – 500 events, high churn (many pending, many quick accepts), to stress EMA and bounds.
- **fixtures/replay_regime_*.json** – One per regime (blind_only, careful_only, adapted_only, pending_only, debt_heavy).

### 3.2 Generator API (pseudocode)

```javascript
// suggestionEventGenerator.js
function generateBulkScenario(opts) {
  const { count = 100, acceptedRatio = 0.3, rejectedRatio = 0.2, adaptedRatio = 0.1, pendingRatio = 0.4 } = opts;
  const events = [];
  let t = Date.now();
  for (let i = 0; i < count; i++) {
    events.push({ type: 'suggestion_created', document: `file:///f${i % 5}.js`, size: 100 + i * 10, timestamp: t });
    t += 1000;
    const r = Math.random();
    if (r < acceptedRatio) events.push({ type: 'suggestion_reviewed', suggestionId: `suggestion-${i+1}`, reviewTime: 6000 });
    if (r < acceptedRatio) events.push({ type: 'suggestion_status_changed', suggestionId: `suggestion-${i+1}`, status: 'accepted' });
    // ... rejected, adapted
  }
  return events;
}
```

Use a **seed** (e.g. `seedrandom`) so the same seed gives the same 200-event stream and the test is deterministic.

---

## 4. Implementation order

| Phase | Deliverable | Purpose |
|-------|-------------|--------|
| 1 | Event generators + 2–3 bulk fixtures (200+ events) | Reproducible, large event streams |
| 2 | scoreService.bulk.test.js + scoreService.monotonicity.test.js | Score correctness under load |
| 3 | awarenessMeterDisplay.test.js (getScoreMeter, getScoreEmoji, updateAwarenessMeter with mocks) | Meter UI matches score |
| 4 | replay_bulk.integration.test.js + regime progression tests | Replay 200+ events, assert progression |
| 5 | awarenessEngine.score.integration.test.js | Engine getScore() after many batches |
| 6 | behavior_to_meter.test.js | Single e2e: event stream → score → meter display |

---

## 5. Success criteria

- **Hundreds of operations:** At least 3 test files each run 100+ events or 100+ score calculations per run.
- **Correctness:** No NaN/Infinity; scores in [0,100]; components in expected ranges; blind accept > careful accept for blindAcceptance component; more pending → higher debt risk.
- **Meter consistency:** For any scoreData, getScoreMeter(getScore().currentScore) and getScoreEmoji(...) match what updateAwarenessMeter would show; tooltip contains the score and mode.
- **Documentation:** A short "Awareness score and meter" doc (or section in existing doc) that describes the pipeline and points to these tests as the specification of "correct" behavior.

---

## 6. References

- [AWARENESS-SCORE-ALGORITHM.md](AWARENESS-SCORE-ALGORITHM.md) – Data model and workflow
- [scoreService.js](../business_modules/awareness/app/scoring/scoreService.js) – calculateScore, regimes
- [scoreCalculations.js](../business_modules/awareness/app/scoring/scoreCalculations.js) – review, blind, adaptation, debt
- [awarenessMeterDisplay.js](../ui/awarenessMeterDisplay.js) – getScoreMeter, getScoreEmoji, updateAwarenessMeter
- [replayRunner.js](../tests/helpers/replayRunner.js) – Replay API
- [lifecycle_to_score.integration.test.js](../tests/business_modules/awareness/app/__tests__/lifecycle_to_score.integration.test.js) – Current integration pattern
