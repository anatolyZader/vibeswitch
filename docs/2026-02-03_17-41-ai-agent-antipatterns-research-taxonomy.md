# AI-Agent Behavioral Anti-Patterns: Research Taxonomy

This document is a research-backed map of **behavioral anti-patterns** that appear when developers build with AI agents and code generators, and how they relate to classic software-engineering anti-patterns. It grounds in peer-reviewed SE/HCI work on AI code tools and established SE anti-pattern literature (technical debt, code smells, cargo-culting), then translates into actionable, observable behaviors that can be metered.

**Integration with VibeSwitch:** [ANTIPATTERN-METERS-REVIEW.md](ANTIPATTERN-METERS-REVIEW.md) maps these patterns to the extension’s 6 canonical meters and current implementation. [ANTIPATTERN-RESEARCH-FUTURE.md](ANTIPATTERN-RESEARCH-FUTURE.md) covers future instrumentation and measurable signals.

---

## Research foundation

**Thesis:** VibeSwitch measures where human attention fails to scale with AI output.

AI does not invent entirely new failure modes so much as **amplify known ones**. The following four structural shifts explain modern vibe-coding failures:

| Shift | Effect in practice |
|-------|---------------------|
| **Cost structure** | Code becomes cheaper than understanding. |
| **Trust dynamics** | Automation bias; confidence-by-fluency. |
| **Provenance opacity** | Harder to judge why code is “this way.” |
| **Volume/velocity** | More surface area to review, same human attention. |

Empirical studies of Copilot-style tools examine **trust**, **validation/repair behavior**, and **provenance awareness** in IDE workflows. There is direct evidence that AI-assisted outputs can carry measurable **maintainability/technical-debt** signals (e.g. code smells), even when often correct.

---

## Taxonomy: 10 AI/Vibe-Coding Behavioral Anti-Patterns (with Classic Mappings)

### 1. Blind Acceptance

- **Behavior:** Accepting suggestions (or large diffs) with minimal scrutiny because they “look right.”
- **Why AI intensifies it:** Fluency + speed trigger automation bias; the tool “sounds confident” even when wrong. Trust studies focus on how developers form (sometimes shaky) trust judgments with AI code tools.
- **Classic analog:** Cargo-cult programming / copy-paste reuse without understanding.
- **Mitigation:** Enforce “reason-to-merge” checks (design intent + invariants) before accept/commit; require at least one non-AI signal (test, trace, spec link).

### 2. Verification Debt

- **Behavior:** Shipping code faster than you validate it; review gets deferred indefinitely.
- **Why AI intensifies it:** Output volume increases faster than review capacity; review feels “slower than writing.” Surveys and commentary label this gap as **verification debt**.
- **Classic analog:** Skipping code review / “works on my machine” culture; “big bang” merges.
- **Mitigation:** Small PR budgets + mandatory minimal tests per change type; explicitly meter “unverified delta.”

### 3. Silent Drift (Debt Accretion without Local Pain)

- **Behavior:** Small, frequent AI changes accumulate into architecture erosion and code smells without obvious breakage.
- **Why AI intensifies it:** AI is good at locally plausible edits that subtly violate boundaries. Code-quality studies find AI-generated code can carry non-trivial technical-debt proxies (e.g. smells).
- **Classic analog:** Technical debt accumulation; “broken windows.” Well-established in SE practice literature.
- **Mitigation:** Architecture boundary checks (imports, dependency rules), plus “drift budgets” per module.

### 4. Context Dilution / Boundary Violations

- **Behavior:** AI introduces dependencies, patterns, or conventions that don’t match the system’s bounded context.
- **Why AI intensifies it:** The model mixes priors from many ecosystems; it may optimize for generic correctness over your architecture. Research on biases in LLM code generation (including provider/stack bias) can push solutions toward certain services/choices.
- **Classic analog:** “Golden hammer,” shotgun integration, framework-of-the-week.
- **Mitigation:** “Context contracts”: module constraints + allowed patterns list + “why this belongs here” prompt/guardrail.

### 5. Over-delegation of Reasoning (Cognitive Offloading)

- **Behavior:** Developer stops building/maintaining an internal model of the system, relying on the agent for next steps.
- **Why AI intensifies it:** AI reduces cognitive load now; long-term it can degrade critical engagement if used as a shortcut. Research on cognitive offloading finds associations with reduced critical thinking in heavy AI-tool use.
- **Classic analog:** Learned helplessness in debugging; “I’ll just try things.”
- **Mitigation:** Force “explain-back”: ask for invariants, edge cases, and failure modes in the developer’s words before accepting big diffs.

### 6. Prompt Thrash / Spec-by-Conversation

- **Behavior:** Iterating prompts until tests pass, without clarifying requirements; solutions become accidental.
- **Why AI intensifies it:** The interaction loop rewards incremental patching; developers may treat the model as an oracle instead of doing requirement discovery. Validation/repair studies show developers spend meaningful effort fixing and adapting AI outputs, not just accepting them.
- **Classic analog:** Shotgun debugging; patchwork design.
- **Mitigation:** Require a written “decision record” when prompt iterations exceed N, or when edits cross boundaries.

### 7. Test Theater

- **Behavior:** Generating shallow tests (or snapshot-heavy tests) that validate implementation details, not behavior; using tests as a merge token.
- **Why AI intensifies it:** AI can mass-produce plausible tests quickly; teams can confuse “coverage” with “assurance.” Copilot empirical work often notes “passing tests ≠ correctness” as a methodological caution.
- **Classic analog:** Coverage chasing; brittle test suites.
- **Mitigation:** Property/invariant tests for core logic; mutation testing gates for critical modules.

### 8. Security-by-Omission

- **Behavior:** Accepting code that is functionally correct but violates secure coding practices (validation, encoding, authZ).
- **Why AI intensifies it:** LLMs can emit insecure defaults; security-focused reviews show LLM code generation can introduce vulnerabilities; SLRs document both risks and mitigations.
- **Classic analog:** “Sanitize later”; insecure copy/paste from examples.
- **Mitigation:** Mandatory security linters + SAST rules on AI-touched code; require explicit security requirements in prompts.

### 9. Observability Neglect

- **Behavior:** AI writes business logic without logs/metrics/traces aligned to operational needs.
- **Why AI intensifies it:** The default completion target is “feature works,” not “feature is operable.”
- **Classic analog:** Throwing code over the wall; “it’s fine” until prod.
- **Mitigation:** “Definition of done” includes telemetry; templates for instrumentation.

### 10. Diff Flooding

- **Behavior:** Large AI-generated PRs that swamp review bandwidth; reviewers rubber-stamp or miss issues.
- **Why AI intensifies it:** AI can expand scope (“while I’m here…”) and generate broad refactors quickly. Some industry analyses claim no broad quality regression, but they’re often metric-limited and don’t eliminate review-capacity risks.
- **Classic analog:** Big-bang refactors; “mega PR.”
- **Mitigation:** PR size budgets + “slice-by-capability” workflow.

---

## Comparison Table: AI-Specific vs Classic

| AI-agent behavioral anti-pattern | Classic cousin | What changes with AI |
|-----------------------------------|----------------|------------------------|
| Blind acceptance | Cargo-culting | Higher automation bias + fluency trust |
| Verification debt | Skipped review/testing | Output volume outruns attention |
| Silent drift | Technical debt | Debt accrues faster, locally plausible |
| Context dilution | Golden hammer | Model priors override local architecture |
| Over-delegation | Learned helplessness | Cognitive offloading reduces critical engagement |
| Prompt thrash | Shotgun debugging | Spec-by-conversation, accidental solutions |
| Test theater | Coverage chasing | Cheap test generation increases false confidence |
| Security-by-omission | Insecure defaults | LLMs frequently pick insecure patterns |
| Observability neglect | Throwing over the wall | Default target is “works,” not “operable” |
| Diff flooding | Mega PR / big-bang | AI expands scope quickly; review capacity fixed |

---

## Practical Meters (Defensible in Research Terms)

If instrumenting (e.g. VibeSwitch), these are **high-signal, low-argument** measures:

| Meter | Definition | Research grounding |
|-------|------------|--------------------|
| **Acceptance without scrutiny** | Accept-rate of suggestions vs subsequent edits/deletes (proxy for “rubber stamping”); time-to-first-edit after accept (short = superficial accept). | Observational work on Copilot collaboration + validation/repair behaviors. |
| **Verification debt index** | AI-touched LOC merged with: no tests added/updated, no review comments addressed, no run/debug session, no linked requirement. | Verification-debt and review-capacity literature. |
| **Drift indicators** | New dependencies across bounded contexts; smell deltas / maintainability deltas on AI-touched code (tie to “technical debt” framing). | Code-quality and technical-debt studies on AI-generated code. |
| **Trust calibration gaps** | Repeated accept of low-quality suggestions (bugfix churn); “over-trust then rework” patterns (accept → later revert). | Trust/provenance research in AI code tools. |

---

## Mapping to VibeSwitch Canonical Meters

| Research taxonomy (this doc) | VibeSwitch canonical meter | Status in extension |
|------------------------------|----------------------------|----------------------|
| 1. Blind acceptance | Ownership & Engagement | ✅ Implemented (sub-signal) |
| 2. Verification debt | Ownership & Engagement | ✅ Implemented (proxy: accepted without test/save/navigate signal) |
| 3. Silent drift | Silent Drift (Debt) | ✅ Implemented |
| 4. Context dilution | Context & Resource Discipline | ⚠️ Approx (context spread) |
| 5. Over-delegation | Ownership & Engagement | ✅ Implemented (adaptation sub-signal) |
| 6. Prompt thrash | Interaction Quality (response drill, flooding) | ✅ Implemented (approx) |
| 7. Test theater | Ownership & Engagement / Unreviewed Drift (Verification Quality) | ✅ Implemented (UI-only, experimental) |
| 8. Security-by-omission | (new or Context) | 🕒 Planned |
| 9. Observability neglect | (future) | 🕒 Conceptual |
| 10. Diff flooding | Interaction Quality / Context & Resource | ✅ Implemented (flooding, context spread approx) |

Full implementation details, sub-signals, and reconciliation are in [ANTIPATTERN-METERS-REVIEW.md](ANTIPATTERN-METERS-REVIEW.md).

---

## Recommended Reading (High-Value Sources)

- **Trust + provenance + developer judgment in AI code tools (HCI/SE):** Empirical studies on Copilot behavior/collaboration.
- **Code quality / technical debt in AI-assisted code:** Studies on maintainability and code smells in AI-generated code.
- **Security-focused surveys/reviews on LLM code generation:** SLRs and security reviews.
- **Classic anti-pattern foundations / smells / debt metaphors:** SE practice and technical-debt literature.

### Research citations (placeholder)

| Cluster | Example sources | Notes |
|---------|-----------------|--------|
| Trust / overconfidence | Sabouri et al. (2025) Overconfidence in AI-Assisted Software Development | Automation bias, trust calibration. |
| Copilot behavior / liability | Moradi Dakhel et al. (2023) GitHub Copilot: Asset or Liability? | Novice vs expert filtering. |
| Code quality / technical debt | Yetiştiren et al. (2023), Chen et al. (2023) Code quality of AI-assisted tools; reviewer sentiment | Smells, duplication in AI PRs. |
| Industry / practice | Thoughtworks Technology Radar (2024–2025) Complacency with AI-generated code | “Passing tests ≠ correctness.” |
| Classic anti-patterns | Fowler, technical-debt literature | Refactoring, debt metaphors. |

*(URLs and BibTeX to be added when curating the reference set.)*

---

Created at 2026-02-03T17:41:50.511Z