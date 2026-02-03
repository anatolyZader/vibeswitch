# Research-Backed AI/Vibe-Coding Antipatterns (Future Instrumentation)

This document captures **additional antipatterns** identified from research on AI-assisted coding failure modes. All are scoped to what VibeSwitch can **actually measure** under “no prompt text / no chat access”: editor events, repo/git signals, file/dependency metadata, and (where noted) lightweight static checks.

**Related:** [ANTIPATTERN-METERS-REVIEW.md](ANTIPATTERN-METERS-REVIEW.md) — current 6 canonical meters, implementation, and **reconciliation** of dashboard vs research. [2026-02-03_17-41-ai-agent-antipatterns-research-taxonomy.md](2026-02-03_17-41-ai-agent-antipatterns-research-taxonomy.md) — research-backed **10-pattern taxonomy**. [2026-02-03_17-59-event-signal-weight-meters-spec.md](2026-02-03_17-59-event-signal-weight-meters-spec.md) — **event → signal → weight** tables for Verification Debt, Diff Flooding, Context Dilution, Observability Neglect (UI-only formulas and data-model notes).

---

## Implementation status vs VibeSwitch dashboard

The extension dashboard today shows **4 canonical meters** built from **7 sub-signals** plus **2 research-backed composites** (comprehension debt, verification debt) — no prompt/chat access:

| Status | Research antipattern | How it appears in VibeSwitch today |
| ------ | -------------------- | ----------------------------------- |
| ✅ **Implemented** | Blind acceptance, Review engagement, Over-delegation | Ownership & Engagement (sub-signals in breakdown) |
| ✅ **Implemented** | Silent drift (debt) | Silent Drift dial |
| ✅ **Implemented** | Flooding, Response drill | Interaction Quality (approx sub-signals) |
| ✅ **Implemented** | Context spread | Context & Resource Discipline dial |
| ✅ **Implemented** | Comprehension debt | getAntipatternBreakdown: composite of low review rate + high response drill; shown in dashboard & tooltip |
| ✅ **Implemented** | Verification debt (proxy) | getAntipatternBreakdown: accepted without verification signal (test/save/navigate); shown in dashboard & tooltip |
| 🕒 **Planned** | Churn spike, Duplication drift, Dependency integrity, Context hijack, Verification gap, Security hygiene | Require new signals (git, lockfile, ingestion paths, rules); will feed existing canonical dials |
| 🕒 **Future** | Architecture & Responsibility, AI Mental Model | Conceptual placeholders in UI; need role/dialogic signals |

Full reconciliation (capabilities, mapping, what would enable each) is in [ANTIPATTERN-METERS-REVIEW.md#reconciliation-dashboard-vs-research-antipatterns](ANTIPATTERN-METERS-REVIEW.md#reconciliation-dashboard-vs-research-antipatterns).

---

## Mapping to canonical dials (UI stays stable)

| Canonical dial | Research-backed future sub-signals |
| ----------------- | ------------------------------------ |
| **Ownership & Engagement** | Comprehension Debt ✅, Verification Debt (proxy) ✅, Test Skipping (verification gap) 🕒 |
| **Silent Drift (Debt)** | Churn Spike, Duplication Drift |
| **Interaction Quality / Progress** | Churn Spike (loop outcome), repeated delete/rewrite cycles |
| **Context & Resource Discipline** | Duplicate Logic Injection (multi-file copy), dependency sprawl |
| **Architecture & Responsibility (future)** | God-agent patterns |
| **AI Mental Model (future)** | Non-iterative prompting, mental model mismatch |

---

## High-confidence antipatterns (editor + repo signals)

### 1. Churn Spike

**What it is:** AI-generated code that gets **deleted or rewritten soon after** (“looks good”, then reverted). Correlates with unstable design and weak understanding.

**Source:** GitClear AI Code Quality Research v2025.2.5 (211M lines, 2020–2024): churn (code revised/reverted within 2 weeks) rose; “revising newer code” trend; Google DORA 2024 links higher AI adoption to lower delivery stability. GitClear defines *churn* as lines authored then reverted or substantially revised within 2 weeks [A0, A7].

**Measurable signals (strong):**
- % of AI-attributed lines deleted within N hours / N commits
- Repeated edits to same region shortly after acceptance
- “Accept → large edit batch → delete batch” patterns

**Meter idea:** *Churn Spike Risk*

**Implementation note:** Requires git/diff history or equivalent “line lifetime” tracking for AI-attributed changes.

---

### 2. Duplicate Logic Injection (Duplication Drift)

**What it is:** AI repeatedly generates similar blocks instead of reusing existing abstractions → DRY breaks, copy/paste proliferation.

**Source:** GitClear AI Code Quality Research v2025.2.5: 2024 was the first year “Copy/Pasted” lines exceeded “Moved” lines (refactoring); 8× increase in commits containing duplicate blocks (5+ contiguous lines) vs prior years; “Moved” code (reuse signature) fell from ~25% to &lt;10% of changed lines. Research (e.g. Mo et al. on DL software, Mondal on bug propagation) shows co-changed clones involved in bugs at ~57% [A5, A8, A9].

**Measurable signals (strong):**
- New duplicated blocks detected (local clone detection on changed files)
- “Near-duplicate” functions introduced in same module
- Refactor avoidance: new helper not created when duplication appears

**Meter idea:** *Duplication Drift*

**Implementation note:** Clone/near-duplicate detection on AI-touched files; optional AST/similarity pass.

---

### 3. Comprehension Debt

**What it is:** Shipping changes faster than understanding grows (common framing in AI-assisted dev discussions).

**Source:** ITNEXT and similar discussions on comprehension vs velocity.

**Measurable signals (medium, composite):**
- Low review time + high churn + high duplication combined
- Repeated “keep-all” batches with minimal subsequent manual edits
- Large deltas without corresponding “review engagement” behavior

**Meter idea:** *Comprehension Debt Risk* — composite of existing signals + churn/duplication when available.

---

### 4. Supply-Chain Trust Fall (Dependency Integrity)

**What it is:** Accepting AI-suggested dependencies and snippets without validating provenance. “Package hallucination” and “slopsquatting” (attackers register hallucinated package names) are documented risks.

**Source:** Trend Micro (package hallucination, supply-chain); slopsquatting research.

**Measurable signals (strong):**
- New dependency added immediately after AI-attributed edit batch
- Dependency name not in allowlist / not in lockfile baseline
- First-time package + no audit step (no SCA scan / no registry check event)

**Meter idea:** *Dependency Integrity Risk*

**Implementation note:** Lockfile/package.json diff + optional allowlist/registry checks; no prompt access needed.

---

### 5. Prompt-Injection Exposure (Context Hijack)

**What it is:** Repo content (issues, README, docs, rules files) contains hidden instructions that hijack coding agents/tools. Widely discussed for agentic IDEs.

**Source:** HiddenLayer and similar (security for AI / agent context).

**Measurable signals (medium):**
- Developer opens/edits “high-risk ingestion surfaces” (README, AGENTS.MD, issues content, docs) shortly before AI-attributed batch or tool action
- Tool invocation that touches secrets/tokens after ingesting external text (if detectable)
- Agent actions attempted outside an allowlisted tool chain (e.g. MCP boundaries)

**Meter idea:** *Context Hijack Risk*

**Implementation note:** File-open/edit timestamps on known ingestion paths + optional MCP/tool allowlist events.

---

### 6. Insecure Defaults Acceptance

**What it is:** AI-generated code often misses basic security controls (e.g. input sanitization); developers accept it as “production-ready”.

**Source:** TechRadar and security reviews of AI-generated code.

**Measurable signals (strong if lightweight checks integrated):**
- AI-attributed change introduces known insecure patterns (regex/AST rules, Semgrep-style)
- New endpoints added without auth/validation middleware
- Missing output encoding / sanitization in web contexts

**Meter idea:** *Security Hygiene Risk*

**Implementation note:** Requires lightweight static rules or Semgrep integration on changed regions; AI-attribution from existing classifier.

---

## Medium-confidence antipatterns (careful proxying)

### 7. Test Skipping Under AI Velocity (Verification Gap)

**What it is:** Generating lots of code while deferring testing/validation (“trust but verify” in best-practice docs).

**Source:** Addy Osmani (Substack) and similar best-practice guidance.

**Measurable signals (medium):**
- AI-attributed batch touching business logic with no corresponding test file edits
- Failing tests after AI batch not addressed before next AI batch
- Long streak of changes without running tests (if test commands / CI triggers detectable)

**Meter idea:** *Verification Gap*

---

### 8. Homogeneous Vulnerability Reuse (Boilerplate Vulnerability Drift)

**What it is:** Similar prompts → similar insecure boilerplate replicated widely (“synthetic vulnerability” / homogeneity risk).

**Source:** Radware (homogeneity of AI-generated vulnerabilities).

**Measurable signals (medium):**
- AI signature detection (repeated code templates across repo)
- Repeated insecure snippet patterns introduced multiple times
- Repeated copy blocks across services/modules

**Meter idea:** *Boilerplate Vulnerability Drift*

---

## Low-confidence without prompt access (keep future/experimental)

- **Non-Iterative Prompting / Mental Model Mismatch** — Already in ANTIPATTERN-METERS-REVIEW as “AI Mental Model Alignment”; needs dialogic signals.
- **God-Agent / Responsibility Collapse** — Already in review as “Architecture & Responsibility”; needs role/task routing signals.

---

## GitClear AI Code Quality Research (2025.2.5)

*AI Copilot Code Quality: Evaluating 2024’s Increased Defect Rate via Code Quality Metrics.* William Harding, Alloy.dev Research / GitClear. February 2025. [GitClear AI Code Quality Research v2025.2.5]

This report analyzes **211 million changed lines** (Jan 2020–Dec 2024) on quantifiable code-quality metrics. Findings directly support VibeSwitch’s Churn Spike and Duplication Drift antipatterns and align with our “comprehension debt” and “defect rate” framing.

### Key findings (mapped to our antipatterns)

| Finding | Our antipattern | Relevance |
| -------- | ---------------- | --------- |
| **Copy/Pasted &gt; Moved (2024)** — First year copy/paste exceeded “moved” (refactoring) lines. Moved fell from ~25% to &lt;10% of changed lines. | Duplication Drift, Context & Resource | Less reuse, more duplicate blocks; “more code” without consolidation. |
| **8× rise in commits with duplicate blocks** — 5+ contiguous repeated lines; 2024 ~6.66% of commits contained a duplicate block vs ~0.7% in 2020. | Duplication Drift | Clone detection on AI-touched files is a defensible signal. |
| **Churn trend** — % of new code revised within 2–4 weeks rose; “revising newer code” up, refactoring older code down. | Churn Spike | Lines authored then reverted/revised shortly after = churn; aligns with “accept → delete/rewrite” proxy. |
| **Google DORA 2024** — For every 25% increase in AI adoption, ~7.2% decrease in “delivery stability”; defect rate correlates with AI adoption. | Comprehension Debt, Ownership | Corroborates “more code + more defects” when refactoring is swapped for cloning. |
| **“What gets measured gets done”** — If productivity = commit count or lines added, maintainability decays; need metrics that approximate long-term maintenance cost. | All meters | VibeSwitch’s canonical meters (ownership, drift, interaction quality, context) aim at that. |

### Definitions we can align to (GitClear A0, A7, A8)

- **Churn:** Line authored, committed, then reverted or substantially revised within 2 weeks. (“Incomplete or erroneous when first written.”)
- **Copy/Pasted:** Identical (non-keyword) lines committed in multiple files/functions in one commit.
- **Moved:** Line cut-and-pasted to new file/function; content unchanged (refactoring/reuse).
- **Duplicate block:** 5+ contiguous lines (excluding blanks/keywords) repeated; Type 1 clone (identical save whitespace/comments).

### Implications for VibeSwitch

- **Churn Spike:** Once we have git/diff or line-lifetime data, define “churn” as AI-attributed lines revised or deleted within N days; use 2-week window to match GitClear/DORA framing.
- **Duplication Drift:** Duplicate-block detection (e.g. 5+ line clones) on AI-touched files is research-backed; Type 1 (exact) is minimum; Type 2/3 (renamed, gap) would strengthen.
- **Comprehension Debt:** Composite of low review engagement + high churn + high duplication is supported by GitClear + DORA “more code, more defects” narrative.
- **Canonical dials:** No change—Churn and Duplication feed Silent Drift / Interaction Quality / Context & Resource as planned.

---

## Best next 3 to implement (highest ROI)

Recommended order for extending the current system **without prompt access**:

1. **Churn Spike Risk** — Editor + git/diff history; % AI-attributed lines deleted within N hours/commits; accept→edit→delete patterns. (GitClear)
2. **Dependency Integrity Risk** — Lockfile + registry/allowlist checks; new deps after AI batch; first-time packages. (Trend Micro, supply-chain research)
3. **Context Hijack Risk** — Agent ingestion surfaces (README, AGENTS.MD, docs) + tool allowlisting; open/edit before AI batch. (HiddenLayer)

These align with existing canonical dials (Silent Drift / Progress Quality / Context & Resource) and add defensible, research-backed signals.

---

## References (summary)

- **GitClear AI Code Quality Research v2025.2.5** — *AI Copilot Code Quality: Evaluating 2024’s Increased Defect Rate via Code Quality Metrics.* William Harding, Lead Researcher & CEO, Alloy.dev Research. Published February 2025. 211M lines analyzed (2020–2024); code change operations (Added, Deleted, Updated, Moved, Copy/Pasted, Find/Replaced, Churn); duplicate block detection (A8); churn = revised/reverted within 2 weeks (A0, A7). Corroboration with Google DORA 2024 (defect rate vs AI adoption). [GitClear]
- **Google DORA 2024** — Accelerate State of DevOps; delivery stability decreases with AI adoption (~7.2% per 25% AI increase); defect rate correlation. [1]
- **Mo, Zhang et al. (2023)** — “Exploring the Impact of Code Clones on Deep Learning Software”; ~57% of co-changed clones involved in bugs; Type 1/2/3 clones. [5]
- **Mondal et al.** — Bug propagation through code cloning; clone-related defect rates. [3, 7]
- **[ITNEXT]** — Comprehension debt vs velocity in AI-assisted dev.
- **[Trend Micro]** — Package hallucination, supply-chain, slopsquatting.
- **[HiddenLayer]** — Security for AI; prompt-injection, context hijack, agent ingestion.
- **[TechRadar]** — Insecure defaults in AI-generated code.
- **[Addy Osmani / Substack]** — Trust but verify; test/deployment practices.
- **[Radware]** — Homogeneous/synthetic vulnerability reuse.

(GitClear report appendix refs: A0=Code Change Definitions, A1=Raw data, A2=Database, A5=Clone types, A7=Code Provenance, A8=Duplicate block detection, A9=Research on detriment of clones.)
