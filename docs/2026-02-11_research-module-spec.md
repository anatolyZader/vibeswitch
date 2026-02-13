# Research Module Spec: AI-Assisted Coding Antipatterns Validation

Spec for a **research agent** that grounds and validates VibeSwitch measures using internet research and statistical analysis. The agent acts as a **data scientist**, not the developer.

**Context:** VibeSwitch measures AI-assisted coding antipatterns (blind acceptance, verification debt, diff flooding, etc.). Raw scores can mislead—e.g. top developers may have low review rates but high effectiveness. What matters is the **relationship** between developer habits and objective outcomes.

**Related:** [ANTIPATTERN-METERS-REVIEW.md](ANTIPATTERN-METERS-REVIEW.md), [2026-02-03_17-59-event-signal-weight-meters-spec.md](2026-02-03_17-59-event-signal-weight-meters-spec.md).

---

## 1. Core Responsibilities

### 1.1 Daily Internet Research

- **Task:** Perform daily internet research and review of new research in the field of **AI-assisted coding antipatterns**.
- **Output:** Summary of relevant papers, blog posts, industry reports, and emerging patterns.
- **Purpose:** Keep the extension’s antipattern taxonomy and measures aligned with current research.

### 1.2 Statistical Research (Internal Data)

- **Task:** Analyze relationships between measures using professional statistical methods.
- **Role:** The research agent acts as a **data scientist**—it selects methods, runs analyses, and interprets results.
- **Purpose:** Statistically validate the measures invented in the extension and ground antipatterns in objective evidence.

### 1.3 Transparency

- **Requirement:** For every analysis, provide:
  - Equations used
  - Methods used (e.g. regression type, ANOVA design)
  - Assumptions and limitations
- **Purpose:** Enable the user to assess validity and, if warranted, pursue academic publication with proper methodology documentation.

---

## 2. Data Sources

| Source | Description | Integration |
|--------|-------------|-------------|
| **Token counting** | Cursor/LLM usage API totals (input/output tokens) | Existing `tokenUsage` in dashboard |
| **SonarCube** | Architectural and code-smell review results | CI integration (future) |
| **Project schedule** | Whether the project is on time or delayed | CI/sprint metadata (future) |
| **Extension metrics** | Awareness scores, antipattern breakdown, meters | `scoreData`, `antipatternBreakdown`, events |
| **Time series** | Measures over time (daily/session granularity) | Persisted during development |

**Objective measures** (external validation): SonarCube, tokens, schedule.  
**Subjective/behavioral measures** (extension): review rate, blind acceptance, debt, flooding, etc.

---

## 3. Statistical Methods

The research agent **autonomously selects** which techniques to use each run. Supported methods:

| Method | Use Case | Output |
|--------|----------|--------|
| **Regression** | Relationship between X (e.g. blind acceptance) and Y (e.g. token usage) | Coefficients, R², p-values |
| **Factorial design** | Multi-factor effects (e.g. review × debt on quality) | Main effects, interactions |
| **ANOVA** | Group differences (e.g. high vs low awareness developers) | F-statistic, p-values |
| **Correlation** | Linear association between measures | r, significance |
| **Time-series** | Trends over sessions/days | Slopes, seasonality |

**Transparency:** Each analysis must document the design, model, and assumptions so the user can replicate or extend for academic work.

---

## 4. Scheduling

| Trigger | Frequency | Rationale |
|---------|-----------|-----------|
| **Internet research** | Daily | Stay current with field |
| **Statistical analysis** | Daily (or configurable) | Balance insight vs token cost |
| **Not on every push/PR** | — | Avoid excessive token usage |

**Recommendation:** Run research agent on a schedule (e.g. once per day, or after N commits) rather than on every CI event.

---

## 5. Persistence

### 5.1 Requirements

- **Volume:** Large amounts of time-series and analysis results.
- **Context:** Node.js / VS Code extension.
- **Constraint:** Must not significantly increase extension bundle size.

### 5.2 Persistence: SQLite

**Choice:** **SQLite** for research data persistence.

| Option | Choice | Rationale |
|--------|--------|------------|
| **SQLite** | ✓ Selected | Strong, queryable, efficient for time-series; supports aggregation, joins, indexes |
| **Storage location** | User data dir (e.g. `~/.vscode/vibeswitch/research.db` or workspace-relative) | Outside extension bundle; per-user or per-workspace |
| **Package** | `better-sqlite3` (native, fast) or `sql.js` (pure JS, no native deps) | Prefer `sql.js` if bundle size is critical; `better-sqlite3` for performance |

**Implementation notes:**
- Database file lives in user/workspace data directory, not in the extension package.
- Schema supports time-series, analysis results, and literature summaries (see 5.3).

### 5.3 Data Model (SQLite Schema)

**Tables:**

- **`time_series`** — `(id, timestamp, session_id, measure_name, value, metadata_json)`
- **`analysis_results`** — `(id, run_id, method, design, equations, findings, p_values_json, created_at)`
- **`literature_summaries`** — `(id, date, sources_json, summary, relevance)`

Indexes on `timestamp`, `measure_name`, `run_id`, `date` for efficient queries.

---

## 6. Output and Presentation

### 6.1 To User

- **Dashboard integration:** Dedicated "Research" section or insights panel.
- **Insights format:** Markdown reports (similar to dashboard-chat insights) with:
  - Methods used
  - Equations
  - Findings (relationships, significance)
  - Caveats and limitations

### 6.2 Academic Pathway

- If findings look valid, the user may:
  - Export methodology and results
  - Continue to formal academic research
  - Publish with manual peer review and caution
- The spec does **not** automate publication; it provides a validated, documented foundation.

---

## 7. Agent Autonomy

- **Daily run:** The research agent decides **by itself** which statistical techniques to use for that day’s data.
- **Selection criteria:** Data shape, sample size, research questions implied by recent measures.
- **No manual design:** The user does not specify regression vs ANOVA; the agent chooses.

---

## 8. Integration Points

| Component | Role |
|-----------|------|
| **Awareness engine** | Supplies `scoreData`, `antipatternBreakdown`, events |
| **Token usage** | Supplies `tokenUsage` (when API available) |
| **CI (future)** | SonarCube, schedule data |
| **Dashboard** | Displays research insights |
| **Insights writer** | Persists research reports (e.g. `insights/research-*.md`) |

---

## 9. Constraints and Risks

| Constraint | Mitigation |
|------------|------------|
| **Token cost** | Schedule-based runs, not per-push |
| **Bundle size** | SQLite DB file in user data dir (outside extension); use `sql.js` if native deps undesirable |
| **False positives** | Document methods; user validates before academic use |
| **Overfitting** | Agent should report sample size, assumptions, cross-validation when applicable |

---

## 10. MVP Scope

**Phase 1 (MVP):**

1. Persist time-series of extension measures (scores, antipatterns) to SQLite in user data dir.
2. Daily (or scheduled) research run:
   - Internet research summary (if API/key available).
   - Basic correlation/regression between extension measures and token usage.
3. Output: Markdown report in `insights/` with method, equations, findings.

**Phase 2:**

- SonarCube integration.
- Schedule data integration.
- ANOVA, factorial design.
- Dashboard "Research" tab.

**Phase 3:**

- Export for academic use.
- Configurable schedule and method preferences.

---

## 11. Conventions

- **Measure names:** Align with `scoreData.components` and `antipatternBreakdown` keys.
- **Timestamps:** ISO 8601, UTC.
- **Statistical significance:** Report p-values; use α = 0.05 as default unless documented otherwise.
- **Equations:** LaTeX or plain math in markdown for reproducibility.

---

*Created from dialogue on research agent role, statistical validation, and persistence. 2026-02-11.*
