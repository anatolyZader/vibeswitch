# Awareness Score Algorithm (VibeSwitch)

This document describes the **current** algorithm/workflow used by VibeSwitch to compute the **Awareness Score**, including:

- The end-to-end **event → classification → suggestions/debt → score → UI** pipeline
- The **score equation** and **all elements** (variables, terms, ranges, caps)
- How **LLM enrichment** (optional) influences the score via **semantic risk multipliers**

> Notes
> - The score is primarily used in **DEV mode** to signal **review debt / risk**.
> - The system is designed for **eventual consistency**: classification, LLM enrichment, and UI refresh may occur asynchronously.

---

## 1) Data model (inputs to scoring)

### 1.1 Suggestions (suggestion-level debt + user interaction evidence)
Suggestions are tracked in-memory in the `SuggestionAggregate` and surfaced via:

- `SuggestionAggregate.getSuggestions()` → `Suggestion[]`

Each `Suggestion` includes (relevant fields):

- **identity**
  - `id` (string)
  - `document` (string URI)
- **lifecycle**
  - `status` ∈ {`pending`, `accepted`, `rejected`, `adapted`}
  - `timestamp` (ms since epoch)
- **review evidence**
  - `reviewed` (boolean)
  - `reviewTime` (ms, accumulated)
  - `reviewStarted` (ms since epoch)
- **adaptation evidence**
  - `userEdited` (boolean)
  - `editCount` (integer)
- **risk inputs**
  - `size` (characters)
  - `rangeCount` (scatter proxy)
  - `provenanceScore` (0..1, AI-likelihood; defaults from classification confidence)
  - `verificationSignals` / `hasVerification()` (boolean-ish)

### 1.2 File debt (file-level debt)
File-level debt is persisted in `DebtService.fileDebts`:

- `fileDebts: Map<fileUriString, FileDebt>`

Each `FileDebt` tracks (relevant fields):

- `fileUri` (canonical URI string key)
- `reviewed` (boolean)
- `modifiedAt` (ms since epoch)
- `totalChanges` (numeric footprint)
- `modificationCount` (integer)

File debt is loaded/saved via `DebtService.loadDebt()` / `DebtService.saveDebt()`.

---

## 2) Workflow (end-to-end)

### 2.1 Event ingestion (VS Code → input layer)
The input layer (`AwarenessEventListener`) subscribes to VS Code events (via the engine):

- `onDidChangeTextDocument` → `AwarenessEventListener.onTextChange(event)`
- `onDidSaveTextDocument` → `AwarenessEventListener.onFileSaved(document)`
- `onDidOpenTextDocument` → `AwarenessEventListener.onFileOpened(document)`
- `onDidCreateFiles` → `AwarenessEventListener.onFilesCreated(event)`
- selection/scroll/active editor events → review tracking

### 2.2 Classification (AI vs user vs formatter)
Typing changes are classified by `ClassificationService.classifyEvent(...)`, which:

1. Builds `Change` domain entities
2. Classifies them into:
   - `label` ∈ {`ai`,`user`,`formatter`,...}
   - `confidence` (0..1)
   - `reasons` (string[])
3. Records a **ledger batch** (metrics + diff bullets)
4. Routes outcomes:
   - If `label === 'ai'`: creates a **suggestion batch** via `SuggestionLifecycleService.recordAISuggestionBatch(...)`
   - If `label === 'user'`: records user edits for overlap/adaptation tracking
   - If `label === 'formatter'`: typically no suggestion tracking

### 2.3 Suggestion lifecycle (pending → accepted/rejected/adapted)
When an AI suggestion is created:

1. The suggestion is added to `SuggestionAggregate`.
2. **File-level debt** is added immediately:
   - `DebtService.addToDebt(suggestion.document, contentLength, updateScore)`
3. A status check timer is scheduled (initially ~5s).

Status checks (`checkSuggestionStatus(suggestionId)`) determine:

- **rejected**: if current text shrank below ~40% of original size
- **adapted**: if the user edited overlapping ranges
- **accepted**: only after the suggestion is marked `reviewed` (via review tracking)
- otherwise: stay `pending`, and schedule another status check (~10s)

### 2.4 Review tracking (what counts as “reviewed”)
There are two complementary mechanisms:

- **Suggestion review**:
  - dwell-time + engagement signals can mark suggestions as reviewed (aggregate method)
  - this enables the next `checkSuggestionStatus` to resolve pending → accepted

- **File-level debt clearing** (SessionService):
  - if a user spends enough time + interactions in a file with debt, `DebtService.markAsReviewed(...)` is called
  - and pending suggestions in that file are also marked reviewed

### 2.5 Score update trigger points
Score recomputation is triggered by:

- new suggestion recorded
- suggestion status changes (accepted/rejected/adapted)
- debt added/cleared
- periodic timer (engine runs `updateScore()` on an interval)
- optional LLM insight updates (`onInsightUpdate → updateScore()`)

### 2.6 Optional LLM enrichment (async, never blocks typing)
`ClassificationService.handleClassifiedChanges(...)` may call `_enrichWithLLMAsync(...)` if an LLM insight service is wired.

Workflow:

1. Assemble minimal batch context:
   - file URI + relative path
   - classification label/confidence/reasons
   - metrics: inserted/deleted/lineSpan/distinctRangeCount
   - diff bullets
   - (optional) small snippet (bounded + possibly redacted)
2. Call `llmInsightService.analyzeBatch(...)` (async)
3. Persist insight to ledger (`kind: llm_insight`)
4. Store insight in `InsightStore` (in-memory)
5. Trigger `onInsightUpdate()` → recompute score and refresh UI

**Important**: LLM output affects scoring only through a **semantic risk multiplier** used by debt scoring.

---

## 3) Score computation (ScoreService)

`ScoreService.calculateScore({ suggestions, debtService, recentWindowMs })` computes:

- `pendingSuggestions`: all suggestions with `status === 'pending'`
- `recentSuggestions`: suggestions where `now - suggestion.timestamp <= recentWindowMs` (default 10s)
- `completed`: `recentSuggestions` where `status !== 'pending'`
- `debtScore`: computed from `DebtService.calculateDebtScore(pendingSuggestions, { useRiskBased: true })`

There are **two regimes**: “recent activity exists” vs “no recent activity”.

---

## 4) The score equation (all elements)

### 4.1 Outputs
- **Total score** \(S_{total}\) is the main value used by the awareness meter.
- Component scores are tracked as:
  - \(S_{review}\) (0..40)
  - \(S_{critical}\) (0..30)
  - \(S_{adaptation}\) (0..30)
  - \(S_{debt}\) (0..30)

---

## 4.2 Time window variables
- \(W\): the “recent activity” window in milliseconds (`recentWindowMs`, default 10,000ms)
- \(t_{now}\): current time (`Date.now()`)
- Each suggestion has \(t_i = suggestion.timestamp\)

Define:
- `recentSuggestions` = \(\{ s_i \mid t_{now} - t_i \le W \}\)
- `pendingSuggestions` = \(\{ s \mid s.status = pending \}\)
- `completed` = `recentSuggestions` excluding pending

---

## 4.3 Total score \(S_{total}\)

### A) Normal regime (recent completed suggestions exist)
If `completed.length > 0`:

\[
S_{raw} = S_{review} + S_{critical} + S_{adaptation} + S_{debt}
\]
\[
S_{total} = \text{round}(\min(S_{raw}, 100))
\]

### B) No recent activity regime (windowed UX behavior)
If `recentSuggestions.length === 0`, the score uses special handling:

- If there are still pending suggestions:

\[
S_{total} = \min(50 + S_{debt}, 100)
\]

- Else if there is debt but no pending suggestions:

\[
S_{total} = \text{round}(\text{clamp}(100 \cdot S_{debt}/30, 0, 100))
\]

- Else:

\[
S_{total} = 0
\]

### C) Pending-only recent activity
If `recentSuggestions.length > 0` but `completed.length === 0`:

\[
S_{total} = 50
\]

---

## 4.4 Component: Review score \(S_{review} \in [0,40]\)

Computed over `completed`:

- \(N\): number of completed suggestions in window
- \(R\): count of `reviewed === true`
- \(T\): total review time, \(T=\sum reviewTime_i\)
- \(avg = T/N\)

Review score is:

\[
S_{review} = \text{round}\Big( 20 \cdot \frac{R}{N} \;+\; \min(20 \cdot \frac{avg}{10000}, 20) \Big)
\]

Interpretation:
- Review rate contributes up to 20 points.
- Average review time contributes up to 20 points (10s per suggestion ≈ max).

---

## 4.5 Component: Critical score \(S_{critical} \in [0,30]\)

Computed over `completed`:

- \(A\): accepted count
- \(J\): rejected count
- \(N\): total count
- \(acceptRate = A/N\), \(rejectRate = J/N\)

This component is intentionally **inverted** for DEV interpretation:
- Blind acceptance → higher points (worse).

Piecewise rule:

- If \(acceptRate = 1.0\): \(S_{critical}=30\)
- Else if \(rejectRate = 1.0\): \(S_{critical}=20\)
- Else if \(0.6 \le acceptRate \le 0.8\): \(S_{critical}=15\)
- Else if \(acceptRate < 0.5\): \(S_{critical}=0\)
- Else: \(S_{critical}=\text{round}(30 \cdot acceptRate)\)

---

## 4.6 Component: Adaptation score \(S_{adaptation} \in [0,30]\)

Computed over `completed`:

- \(adaptRate = \#adapted / N\)
- \(avgEdits = \frac{1}{N}\sum editCount_i\)

\[
S_{adaptation} = \text{round}\Big( 15 \cdot adaptRate \;+\; \min(15 \cdot \frac{avgEdits}{2}, 15) \Big)
\]

Interpretation:
- Adapting more suggestions increases score.
- More edits per suggestion increases score.

---

## 4.7 Component: Debt score \(S_{debt} \in [0,30]\) (risk-based default)

Debt is computed from two sources:

1. **File-level debt entries** (`FileDebt`) that are unreviewed
2. **Pending suggestions** (`Suggestion.status === 'pending'`)

The default path uses **risk-based debt**:

\[
S_{debt} = \text{round}(\min(D_{total}, 30))
\]

Where:
\[
D_{total} = \sum_f D_f + \sum_s D_s
\]

### 4.7.1 File-level term \(D_f\)
For each unreviewed file debt entry \(f\):

Variables:
- \(footprint_f = f.totalChanges\)
- \(C_f = getFileCriticality(fileUri)\) ∈ {0.5, 1.0, 1.3, 1.5, 2.0}
- \(M_f = getSemanticRiskMultiplier(fileUri, ctx)\) (optional, defaults to 1)
- \(ageHours_f = (t_{now} - f.modifiedAt)/(3600\cdot 1000)\)
- \(A_f = 1 + \min(0.1\cdot ageHours_f, 1.0)\)

Base risk (capped):
\[
B_f = \min\Big(\frac{footprint_f}{1000} \cdot C_f \cdot M_f, 6\Big)
\]

Contribution:
\[
D_f = B_f \cdot A_f
\]

### 4.7.2 Suggestion-level term \(D_s\)
For each pending suggestion \(s\):

Variables:
- \(footprint_s = s.size\)
- \(scatter_s = s.rangeCount\)
- \(C_s = getFileCriticality(s.document)\)
- \(M_s = getSemanticRiskMultiplier(s.document, ctx)\) (optional, defaults to 1)
- \(provenance_s = s.provenanceScore\) (0..1; fallback from classification confidence)
- \(\alpha\) = provenance coefficient (default 0.5)
- \(P_s = 1 + \alpha \cdot provenance_s\)
- \(V_s = 0.5\) if `hasVerification()==true`, else \(1.0\)
- \(ageHours_s = (t_{now} - s.timestamp)/(3600\cdot 1000)\)
- \(A_s = 1 + \min(0.1\cdot ageHours_s, 1.0)\)

Base risk (capped):
\[
B_s = \min\Big(\big(\frac{footprint_s}{500} + \frac{scatter_s}{10}\big)\cdot C_s \cdot M_s, 3\Big)
\]

Contribution:
\[
D_s = B_s \cdot P_s \cdot V_s \cdot A_s
\]

---

## 5) LLM influence (optional, limited scope)

LLM enrichment does **not** directly change \(S_{review}\), \(S_{critical}\), or \(S_{adaptation}\).

It only influences the score via **semantic risk multipliers**:

- \(M_f\) / \(M_s\) in the debt calculation
- Derived from the latest `InsightStore` record for a file URI

Default behavior if no insight is available:

- \(M(\cdot) = 1\)

---

## 6) UI interpretation (meter)

The meter consumes:

- `total` (the final score \(S_{total}\))
- `components` (review/critical/adaptation/debt component breakdown)
- `suggestions` counts (pending/accepted/rejected/adapted)
- `debt.unreviewedFiles` (file-level debt count)

Additional UI nuance:
- The status bar may show a warning background when debt exists even without recent activity (a “debt persists” signal).

---

## 7) Reference points (code locations)

Key implementation files:

- Scoring orchestration:
  - `business_modules/awareness/app/scoring/scoreService.js`
- Component + debt calculations:
  - `business_modules/awareness/app/scoring/scoreCalculations.js`
- Debt persistence + computation:
  - `business_modules/awareness/app/debt/debtService.js`
- Suggestion lifecycle + status checks:
  - `business_modules/awareness/app/suggestions/suggestionLifecycleService.js`
- Review sessions + clearing debt:
  - `business_modules/awareness/app/sessions/sessionService.js`
- Classification + optional LLM enrichment:
  - `business_modules/awareness/app/classificationService.js`
- File criticality heuristic:
  - `business_modules/awareness/app/utilities/fileCriticality.js`

