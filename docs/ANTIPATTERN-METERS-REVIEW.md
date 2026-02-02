# VibeSwitch Antipattern Meters: Conceptual and Empirical Review

This document describes the **6 canonical meters** that VibeSwitch exposes: what each means conceptually, which Cursor (implementation) sub-signals feed it, how it is measured, and the conceptual vs empirical basis. The goal is a **stable mental model** (6 canonical meters) with **honest implementation** (7–8 empirical sub-signals); the UI shows canonical dials with breakdown on hover/expand.

---

## Reconciled map (summary)

| Canonical Meter | Cursor Meters Feeding It | Status |
| ----------------- | ------------------------ | ------ |
| Ownership & Engagement | Blind Acceptance, Review Engagement, Over-delegation | ✅ Core |
| Silent Drift (Debt) | Silent Drift | ✅ Core |
| Interaction Quality | Flooding (approx), Response Drill (approx) | ⚠️ Approx |
| Context & Resource Discipline | Context Spread (approx) | ⚠️ Approx |
| Architecture & Responsibility Distribution | — | 🕒 Future |
| AI Mental Model Alignment | — | 🕒 Future |

**UI pattern:** Dashboard shows 4–6 canonical meters; hover/expand shows contributing sub-metrics. Docs explain conceptual vs empirical split.

---

## 1. Ownership & Engagement (canonical)

**Question:** *Is the developer actually owning the change?*

### Feeds from Cursor meters

- **Blind Acceptance** ✅ (core)
- **Review Engagement** ✅ (core)
- **Over-delegation** ✅ (core)

These three are **facets of ownership**, not separate dimensions. They differ by *temporal focus*: decision moment (blind acceptance), review process quality (review engagement), post-accept ownership (adaptation).

### Sub-signals (tooltip / breakdown)

- **Blind acceptance** — Accepting AI suggestions without effective review.
- **Review depth** — Rate and depth of review (time/size) before resolution.
- **Adaptation rate** — Share of accepted output that was adapted; depth of edits.

### Measurement in the extension

- **Aggregate:** One canonical dial risk 0–100 = weighted blend of the three risks (blind 30, review 40, adaptation 30, same as main score).
- **Blind Acceptance:** [scoreCalculations.js](business_modules/awareness/app/scoring/scoreCalculations.js) — `calculateBlindAcceptanceScore(suggestions)`. Effective review = `reviewed === true` and `reviewTime >= MINIMUM_REVIEW_TIME_MS` (5000 ms). Risk 0–30: `0.85*blindRate + 0.15*carefulAcceptRate` minus adaptation mitigation.
- **Review Engagement:** `calculateReviewScore(suggestions)` — good score 0–40 (review rate, review depth with `TARGET_SEC_PER_KCHAR` 12, resolution bonus). Displayed as **risk** (inverted).
- **Over-delegation:** `calculateAdaptationScore(suggestions)` — good score 0–30 (adaptation rate, adaptation depth). Displayed as **risk** (inverted).

### Conceptual vs empirical basis

- **Conceptual:** “Accepted without review” vs “accepted after review”; review depth; adaptation as ownership.
- **Empirical:** 5 s minimum review time, 85/15 weighting, saturation constants are heuristics; no prompt or reading signal.

---

## 2. Silent Drift (Debt) (canonical)

**Question:** *Is unreviewed change accumulating invisibly?*

### Feeds from Cursor meters

- **Silent Drift (Debt)** ✅ (core)

Already aligned: footprint (files), backlog (pending suggestions), staleness (age).

### Measurement in the extension

- **Source:** [scoreCalculations.js](business_modules/awareness/app/scoring/scoreCalculations.js) — `calculateDebtScore(fileDebts, pendingSuggestions)`; [debtService.js](business_modules/awareness/app/debt/debtService.js) maintains file-level debt.
- **Logic:** Up to 10 pts from unreviewed files, 10 from pending suggestions, 10 from age of oldest debt; total 0–30.
- **Display:** Normalized to 0–100% risk (Silent Drift meter).

### Conceptual vs empirical basis

- **Conceptual:** Debt = unreviewed footprint + staleness.
- **Empirical:** Caps (2 pts per file/suggestion, age term) are heuristics; no VCS metadata.

---

## 3. Interaction Quality (canonical)

**Question:** *Is the interaction progressing, or looping?*

### Feeds from Cursor meters

- **Response Drill (approx)** ⚠️ — mechanical resolution.
- **Flooding (approx)** ⚠️ — excessive initiation.

Both are **loop mechanics**; one canonical dial with two approx sub-signals.

### Sub-signals (tooltip / breakdown)

- **Flooding tendency** — Batch count in last 5 min (proxy for prompt volume).
- **Response drill tendency** — Keep-all batches in last 5 min (all accepted, ≥3 suggestions, zero modifications).

### Measurement in the extension

- **Aggregate:** Canonical risk 0–100 = max(floodingRisk, responseDrillRisk). UI-only (not in main score).
- **Flooding:** [awarenessEngine.js](business_modules/awareness/app/awarenessEngine.js) — `getAntipatternBreakdown()`. Batches from [suggestionAggregate.getBatches()](business_modules/awareness/domain/aggregates/suggestionAggregate.js). `floodingRisk = min(100, count * 33)` in 5 min window.
- **Response drill:** Same; [suggestionBatch.js](business_modules/awareness/domain/entities/suggestionBatch.js) — `isKeepAllPattern()`: `status === 'fully_accepted'`, `suggestionIds.length >= 3`, `modifiedCount === 0`. `responseDrillRisk = min(100, count * 50)`.

### Conceptual vs empirical basis

- **Conceptual:** Loop risk = excessive initiation + mechanical resolution.
- **Empirical:** No prompt text; batch count and keep-all pattern are proxies; windows and factors are heuristic.

---

## 4. Context & Resource Discipline (canonical)

**Question:** *Is context being used deliberately or wastefully?*

### Feeds from Cursor meters

- **Context Spread (approx)** ⚠️

### Measurement in the extension

- **Source:** [awarenessEngine.js](business_modules/awareness/app/awarenessEngine.js) — `getAntipatternBreakdown()`.
- **Proxy:** Last 10 min: max batch size (suggestion count), distinct file count. Risk = size term (maxBatchSize/10 * 50, capped) + files term (distinctFiles * 15 * 0.5), capped at 100.
- **Display:** Context & Resource Discipline meter (approx, UI-only).

### Conceptual vs empirical basis

- **Conceptual:** Token-heavy or broad exploration (many files / large batches).
- **Empirical:** No token counts; batch size and file count are proxies; future: add mitigation when followed by review.

---

## 5. Architecture & Responsibility Distribution (canonical, future)

**Question:** *Is responsibility well-distributed or collapsing?*

### Feeds from Cursor meters

- None directly yet.

### Reconciliation

Conceptually valid but **not yet instrumented**. Parts leak into over-delegation and response drill, but there is no explicit signal for role separation, task decomposition, or agent specialization.

### Recommendation

- Keep as **conceptual but inactive**; mark as “future / experimental” in UI.
- Do **not** fake it with weak proxies.

---

## 6. AI Mental Model Alignment (canonical, future)

**Question:** *Is the developer treating AI as a collaborator or a compiler?*

### Feeds from Cursor meters

- Indirectly: response drill, flooding, over-delegation (no direct implementation).

### Reconciliation

Cursor **correctly did not implement this yet**: no prompt text, no dialogic intent signals; high risk of over-interpretation. Right now this meter would be speculative and not defensible.

### Recommendation

- Keep as **conceptual-only**; document clearly.
- Add later if/when dialogic signals become available.

---

## Summary: Core vs approximate

| Canonical Meter | Part of main score? | Data source |
| ----------------- | -------------------- | ----------- |
| Ownership & Engagement | Yes (Blind + Review + Adaptation) | Suggestions, review flags, review time, adaptation |
| Silent Drift | Yes | File debt + pending suggestions |
| Interaction Quality | No (UI only) | Flooding + Response drill (batch count, keep-all) |
| Context & Resource Discipline | No (UI only) | Batch size + file count |
| Architecture & Responsibility | — | Future |
| AI Mental Model | — | Future |

The four **core** sub-signals (blind acceptance, review, adaptation, debt) feed the main awareness score in [scoreService.js](business_modules/awareness/app/scoring/scoreService.js) and [scoreCalculations.js](business_modules/awareness/app/scoring/scoreCalculations.js). The **approximate** sub-signals (flooding, response drill, context spread) are computed only in [getAntipatternBreakdown()](business_modules/awareness/app/awarenessEngine.js) for dashboard and tooltip.

---

## Research-backed future antipatterns

Additional antipatterns identified from research on AI-assisted coding failure modes (churn, duplication, supply-chain, prompt-injection, insecure defaults, test skipping) are documented in **[ANTIPATTERN-RESEARCH-FUTURE.md](ANTIPATTERN-RESEARCH-FUTURE.md)**. They are scoped to what we can measure without prompt/chat access: editor + repo signals, lockfile/dependency metadata, ingestion-surface edits, and optional lightweight static checks.

**Mapping to canonical dials:** Ownership & Engagement ← Comprehension Debt, Verification Gap; Silent Drift / Progress ← Churn Spike, Duplication Drift; Context & Resource ← Duplication (multi-file), Dependency Integrity; future dials ← God-agent, Mental Model.

**Best next 3 to implement (highest ROI):** (1) **Churn Spike Risk** (editor + git/diff history), (2) **Dependency Integrity Risk** (lockfile + allowlist/registry), (3) **Context Hijack Risk** (ingestion surfaces + tool allowlisting). See the research doc for measurable signals and sources.

**External research corroboration:** GitClear AI Code Quality Research v2025.2.5 (211M lines, 2020–2024) reports copy/paste exceeding “moved” (refactoring) in 2024, an 8× rise in commits with duplicate blocks (5+ lines), and increased churn (code revised within 2 weeks). Google DORA 2024 links higher AI adoption to lower delivery stability (~7.2% per 25% AI increase). These support our Churn Spike and Duplication Drift antipatterns and the “comprehension debt” / defect-rate framing. See [ANTIPATTERN-RESEARCH-FUTURE.md](ANTIPATTERN-RESEARCH-FUTURE.md#gitclear-ai-code-quality-research-202525) for the full GitClear integration.

---

## Reconciliation: Dashboard vs research antipatterns

How the **current VibeSwitch dashboard** (4 canonical dials + 2 future placeholders) lines up with **research-backed antipatterns** and what the extension can measure today.

### Current extension capability (no prompt/chat access)

| Capability | Available today? | Used by |
| ----------- | ----------------- | ------- |
| Resolved suggestions (accept/reject/adapt, review flags, review time, edit count) | ✅ Yes | ScoreService, scoreCalculations (core) |
| Pending suggestions + file-level debt (unreviewed files, age) | ✅ Yes | DebtService, debt score |
| AI batch list (timestamp, size, file, keep-all, suggestion ids) | ✅ Yes | getAntipatternBreakdown (approx) |
| Git/diff history (line lifetime, revert, churn) | ❌ No | — |
| Lockfile / package.json diff (new deps after AI batch) | ❌ No | — |
| File-open/edit on ingestion paths (README, AGENTS.MD, docs) | ❌ No | — |
| Duplicate/clone detection on changed files | ❌ No | — |
| Lightweight security rules (e.g. Semgrep) on AI-touched regions | ❌ No | — |
| Test file / test-run events | ❌ No | — |

### Research antipattern → dashboard mapping

| Research antipattern | Canonical dial (UI) | Current status | What would enable it |
| -------------------- | ------------------- | -------------- | --------------------- |
| Blind acceptance | Ownership & Engagement | ✅ **Implemented** (sub-signal) | — |
| Review engagement | Ownership & Engagement | ✅ **Implemented** (sub-signal) | — |
| Over-delegation | Ownership & Engagement | ✅ **Implemented** (sub-signal) | — |
| Silent drift (debt) | Silent Drift | ✅ **Implemented** | — |
| Flooding | Interaction Quality | ✅ **Implemented** (approx sub-signal) | — |
| Response drill | Interaction Quality | ✅ **Implemented** (approx sub-signal) | — |
| Context spread | Context & Resource Discipline | ✅ **Implemented** (approx) | — |
| **Comprehension debt** | Ownership & Engagement | ⚠️ **Partial** | Composite of review + keep-all + (future) churn/duplication |
| **Verification gap (test skipping)** | Ownership & Engagement | 🕒 **Planned** | Test-file edits + test-run events after AI batch |
| **Churn spike** | Silent Drift / Interaction Quality | 🕒 **Planned** | Git/diff history; AI-attributed line lifetime, accept→delete |
| **Duplication drift** | Silent Drift / Context & Resource | 🕒 **Planned** | Clone/near-duplicate detection on AI-touched files |
| **Dependency integrity** | Context & Resource Discipline | 🕒 **Planned** | Lockfile/package.json diff + new deps after AI batch |
| **Context hijack** | Context & Resource Discipline | 🕒 **Planned** | Ingestion-surface file open/edit before AI batch; MCP allowlist |
| **Security hygiene** | (new or Ownership/Context) | 🕒 **Planned** | Lightweight rules on AI-attributed changes |
| **Boilerplate vulnerability drift** | (composite) | 🕒 **Future** | Template/signature detection across repo |
| Architecture & Responsibility | (future dial) | 🕒 **Conceptual** | Role/task routing signals |
| AI Mental Model | (future dial) | 🕒 **Conceptual** | Dialogic/prompt signals |

### Dashboard behavior (reconciled)

- **Shown today:** 4 canonical meters (Ownership & Engagement, Silent Drift, Interaction Quality, Context & Resource Discipline) built from the 7 existing sub-signals; 2 placeholders (Architecture & Responsibility, AI Mental Model). Total risk and file lists unchanged.
- **Breakdown:** Tooltip and dashboard “Breakdown” line expose sub-signals (blind acceptance, review depth, adaptation; flooding, response drill) so the research concepts (e.g. comprehension debt as “low review + keep-all”) are interpretable from current data.
- **Next steps:** Adding Churn Spike, Dependency Integrity, or Context Hijack would extend the **same** canonical dials (Silent Drift, Context & Resource) with new sub-signals; no need to add more top-level dials unless we introduce a dedicated Security or Verification dial later.

---

## Applying GitClear (and research) insights in the system

Findings from GitClear AI Code Quality Research v2025.2.5 (and DORA 2024) are applied **in the extension**, not only in docs: real signals where we have data, plus UI copy and hints.

### Implemented in the extension

| Insight from article | Application in dashboard |
| -------------------- | ------------------------- |
| **Copy/paste &gt; moved; 8× duplicate blocks** | Label **Context & Resource** as “(spread & duplication risk)” in tooltip/breakdown; add footnote that duplicate-block detection will feed this when available. |
| **Churn = code revised/reverted within 2 weeks** | When **Interaction Quality** (flooding/drill) is high, show a hint: “High loop risk is associated with churn & duplication (GitClear 2025).” |
| **Comprehension debt** (low review + high churn/duplication) | Derive a **comprehension-debt hint** from existing data: e.g. show “Comprehension debt risk: elevated” when review engagement is low *and* response drill is high (keep-all without review). |
| **“What gets measured gets done”** | Keep dashboard copy that meters approximate **long-term maintenance risk**, not just “lines added.” Research footnote: “Meters align with GitClear 2025 & DORA 2024: churn, duplication, defect rate.” |
| **DORA: defect rate ↑ with AI adoption** | Same footnote; reinforce that Ownership & Engagement and Silent Drift are proxies for “more code, more defects” when review/refactor are low. |

**Implemented:** Dashboard Webview shows a research footnote (GitClear/DORA); breakdown can include an optional “Comprehension debt” line when (review risk high and response drill high). Tooltip can add a one-line hint when interaction risk is high.

### Planned (needs new data)

- **Churn Spike:** % of AI-attributed lines deleted/revised within N days (e.g. 14). Requires git/diff or line-lifetime data; would feed **Silent Drift** and/or **Interaction Quality**. See [ANTIPATTERN-RESEARCH-FUTURE.md](ANTIPATTERN-RESEARCH-FUTURE.md) for GitClear definitions (A0, A7).
