# Event → Signal → Weight Tables: Four Meter Candidates

Spec for plugging four new/refined meters into the existing architecture. All **editor/repo observable** (no prompt text).

**Integration:** Core scoring path = `scoreCalculations.js` / `scoreService.js` (only when signals are strong + stable). UI-only = `awarenessEngine.getAntipatternBreakdown()` (proxy-based). Implement UI-only first; promote to core when reliable.

**Related:** [ANTIPATTERN-METERS-REVIEW.md](ANTIPATTERN-METERS-REVIEW.md), [2026-02-03_17-41-ai-agent-antipatterns-research-taxonomy.md](2026-02-03_17-41-ai-agent-antipatterns-research-taxonomy.md).

---

## Conventions

- **Weight scale:** Core meters ±1..±6 per event then normalized; UI-only = count × factor, capped at 100.
- **Event types:** Existing = `CODE_APPLIED`, `CODE_VIEWED`, suggestion/batch lifecycle. New (emit when detectable): `TEST_RUN_DETECTED`, `CI_RESULT_DETECTED`, `TEST_FILE_TOUCHED`, `PROD_CODE_TOUCHED`, `ARCH_RULE_VIOLATION_DETECTED`, `NEW_DEPENDENCY_ADDED`, `OBS_INSTRUMENTATION_TOUCHED`, `API_SURFACE_CHANGED`.

---

## 1) Verification Debt Meter

**Definition:** AI-touched functional code without matching verification (tests run/added, debug, CI) within a time window.

**Canonical home:** Unreviewed Drift (sub-signal). Start UI-only; promote to core when test/run signals are reliable.

### Events → Signals → Weights

**Editor-only (safe now):**

| Event | Signal | Weight |
|-------|--------|--------|
| `PROD_CODE_TOUCHED` (AI batch) | Verification needed | 0 *(opens window)* |
| `TEST_FILE_TOUCHED` within W | Verification started | +4 |
| `TEST_FILE_TOUCHED` + assertions > threshold | Higher quality verification | +2 |
| `PROD_CODE_TOUCHED` again, no test touch since | Debt accumulating | −3 |
| `TIME_WINDOW_EXPIRED` (no verify) | Debt matured | −5 |

**Optional runtime:** `TEST_RUN_DETECTED` +5, `CI_RESULT_DETECTED:success` +5, `CI_RESULT_DETECTED:fail` −2.

**UI-only MVP formula:** `verificationDebtRisk = clamp01((aiProdBatchesWithoutTestTouch * 20) + (unverifiedAgeHours * 10))` → cap 100. *(Current implementation uses accepted-without-verification-signal share; ledger/window can be added when TEST_FILE_TOUCHED is available.)*

---

## 2) Diff Flooding Meter

**Definition:** Large AI-generated change bursts that exceed review bandwidth and encourage rubber-stamping.

**Canonical home:** Progress Quality (Interaction Quality).

### Events → Signals → Weights

| Event | Signal | Weight |
|-------|--------|--------|
| `AI_BATCH_CREATED` suggestionCount ≥ 10 | Large burst | −4 |
| `AI_BATCH_CREATED` filesTouched ≥ 4 | Multi-file spread | −3 |
| `AI_BATCH_CREATED` locDelta ≥ 300 | Review overload | −5 |
| `BATCH_RESOLVED_KEEP_ALL` and large | Rubber-stamp risk | −5 |
| `CODE_VIEWED` depth adequate before resolve | Mitigation | +4 |
| `BATCH_SPLIT` (resolve in parts) | Healthy slicing | +5 |
| `SESSION_RESET` after large batch | Containment | +2 |

**UI-only scoring (implemented):** Per batch in 10 min window: burst = 0; if suggestionCount ≥ 10 then burst += 35; if filesTouched ≥ 4 (window distinct files) then burst += 25; if locDelta ≥ 300 (batch totalSize) then burst += 40; if keepAll && modifiedCount === 0 then burst += 30. `risk = min(100, maxBurstInWindow + multiFileTerm)`.

---

## 3) Context Dilution / Boundary Violations Meter

**Definition:** AI introduces changes that violate architectural boundaries (cross-module imports, wrong-layer deps).

**Canonical home:** Unreviewed Drift (architectural drift) or Focus Discipline.

### Events → Signals → Weights

| Event | Signal | Weight |
|-------|--------|--------|
| `ARCH_RULE_VIOLATION_DETECTED` severity=low | Boundary warning | −2 |
| `ARCH_RULE_VIOLATION_DETECTED` severity=med | Layer breach | −4 |
| `ARCH_RULE_VIOLATION_DETECTED` severity=high | Forbidden dependency | −6 |
| `NEW_DEPENDENCY_ADDED` across contexts | Dilution | −4 |
| `VIOLATION_RESOLVED` | Drift repaired | +5 |
| `SCOPE_NARROWED` after violation | Containment | +2 |

**MVP:** Lightweight path/layer checks on save or batch finalize; attach violations to batch. *Placeholder in breakdown until rules are implemented.*

---

## 4) Observability Neglect Meter

**Definition:** Shipping behavior changes without minimum operational signals (logs/metrics/traces).

**Canonical home:** Unreviewed Drift (operability debt).

### Events → Signals → Weights

| Event | Signal | Weight |
|-------|--------|--------|
| `API_SURFACE_CHANGED` | Needs observability | 0 *(opens window)* |
| `PROD_CODE_TOUCHED` in core flows | Needs observability | −1 |
| `OBS_INSTRUMENTATION_TOUCHED` within W | Telemetry added | +5 |
| `LOG_CALL_ADDED` / `METRIC_ADDED` / `TRACE_ADDED` | Mitigation | +3 |
| `WINDOW_EXPIRED_NO_OBS` | Neglect confirmed | −5 |

**UI-only MVP:** `obsNeglectRisk = min(100, entryPointChangesWithoutObs*30 + coreFlowChangesWithoutObs*15)`. *Placeholder in breakdown until entry-point/obs detection exists.*

---

## 5) Test Theater Meter

**Definition:** Shallow tests (snapshot-heavy, trivial assertions) used as merge tokens rather than assurance; epistemic debt.

**Canonical home:** Unreviewed Drift (Verification Quality sub-signal). Primary: Verification Debt cluster; secondary: Change Ownership (Ownership & Engagement).

### Events → Signals → Weights

| Event | Signal | Weight |
|-------|--------|--------|
| `TEST_FILE_TOUCHED` + snapshot, prod changed | Cosmetic validation | −3 |
| Only trivial assertions | Shallow | −4 |
| Test added after prod | Ritual | −2 |
| Bugfix without test update | Failed coverage | −5 |
| Property/invariant added | Real assurance | +5 |
| `TEST_FAILURE_DETECTED` before fix | Healthy | +3 |

**Events (when detectable):** `TEST_FILE_TOUCHED`, `PROD_CODE_TOUCHED`, `ASSERTION_PARSED`, `SNAPSHOT_ADDED`, `BUGFIX_COMMIT`, `TEST_FAILURE_DETECTED` (optional).

**UI-only MVP formula:** `theaterScore = snapshotRatio*30 + trivialAssertRatio*30 + bugfixWithoutTest*25 + ritualTestAdds*15` → `risk = min(100, theaterScore)`.  
Note: `snapshotRatio` / `trivialAssertRatio` require parsing test files; `bugfixWithoutTest` / `ritualTestAdds` require bugfix/accept→edit signals (document as future if not yet available).

**False-positive risks:** Heavy use of snapshots in an approved testing style; TDD “test first” can look like “ritual” (test before prod). Mitigation: document as experimental; optional per-workspace disable.

---

## Where they live

- **UI-only (current):** `getAntipatternBreakdown()` — flooding, response drill, context spread, comprehension debt, verification debt, **diff flooding (burst)**, **test theater** (async when test-file parsing available). Placeholders: boundary violations, observability neglect (0 until signals exist).
- **Core (later):** Verification Debt and Boundary Violations when signals are stable; Diff Flooding, Test Theater, and Observability stay UI-only unless conventions are strict.

---

## Data model (SuggestionBatch / batch metadata)

- `locDelta` — use existing `totalSize` (chars).
- `filesTouched` — 1 per batch (single file); window-level distinct files for multi-file spread.
- `archViolations[]` — (severity, ruleId, file) when ARCH rules exist.
- `verificationSignals` — testTouched, testRunSeen, ciSeen (extend when events exist).
- `obsSignals` — entryPointsTouched, telemetryTouched (when detection exists).

---

## Exact scoring (future) — same style as scoreCalculations.js

When signals exist, these can be implemented as 0–30 raw (or 0–100 risk) with caps and saturation, mirroring blind/review/adaptation/debt.

### Verification Debt (core candidate)

- **Input:** Per-file or per-session verification ledger (window open on PROD_CODE_TOUCHED, credits from TEST_FILE_TOUCHED / TEST_RUN / CI).
- **Raw (0–30):** `debtScore = baseDebt - creditFromEvents`, clamped; normalize to risk 0–100.
- **Constants:** WINDOW_MS (e.g. 90 min), weights +4/+5 for verify events, −3/−5 for accumulate/expiry.

### Boundary Violations (core candidate)

- **Input:** `archViolations[]` per batch (severity: low/med/high).
- **Raw (0–30):** Sum severity weights (−2/−4/−6) over window; positive resolution +5. Normalize to risk 0–100.
- **Constants:** Same as event table; optional cap per file.

### Observability Neglect (UI-only unless strict conventions)

- **Input:** Entry-point changes and `obsSignals` (telemetry touched) in window.
- **Formula:** `obsNeglectRisk = min(100, entryPointChangesWithoutObs * 30 + coreFlowChangesWithoutObs * 15)`.
- **Promote to core:** Only if instrumentation rules are deterministic and detectable (e.g. required log/metric calls in entry paths).

### Diff Flooding (current: UI-only, keep UI-only)

- **Already implemented:** Per-batch burst (suggestionCount ≥ 10, totalSize ≥ 300, keep-all) + multi-file term; `risk = min(100, maxBurstInWindow + multiFileTerm)`.
- **No core promotion:** Remains “posture” / review-bandwidth signal, not part of main awareness score.

Created at 2026-02-03T17:59:45.326Z