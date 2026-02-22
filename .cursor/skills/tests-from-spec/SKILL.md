---
name: tests-from-spec
description: When the user points to a spec file in docs/specs/, generate tests for all input/output, edge, and error variants in the spec and follow TDD through to Green in one run (no pause for test commit unless the user asks).
---

# Tests from Spec — Spec-First TDD

Use this skill when the user points to a spec file (e.g. in `docs/specs/`) or says "from spec" / "tests from spec". Generate tests that cover every variant in the spec, then run TDD through to Green in the same run: Red (write tests, verify coverage, confirm fail) → then implement until all tests pass. Do not pause for the user to commit tests unless they explicitly ask to stop after Red.

## Prerequisites

- A spec file exists in `docs/specs/` (or path given by user) using the format in [docs/specs/SPEC-TEMPLATE.md](../../docs/specs/SPEC-TEMPLATE.md).
- Project TDD rules and test layout are in [docs/TDD-PLAN-AND-WORKFLOW.md](../../docs/TDD-PLAN-AND-WORKFLOW.md).
- When the spec targets a business module (Contract Location under `business_modules/<name>/`), the **TDD command** will ensure the module scaffold exists before generating tests. If you are invoked from `/tdd`, the scaffold is already in place; test file hints under `tests/business_modules/<module>/` are valid.

## Instructions

### 1. Read the spec

- Open and read the spec file (path from user or e.g. `docs/specs/spec-<name>.md`).
- Identify: **Contract** (name, signature, location), **Input/Output** pairs (or table), **Edge cases**, **Error cases**, **Invariants**, **Success criteria** (how it will be tested), optional **Test levels**, and optional **Test file hint** (unit / integration / e2e). A good spec defines not only what the feature does but how it will be tested—use that to produce exactly the coverage the user wants.

### 2. Write tests (Red phase only)

Generate tests for **every test level** declared in the spec (default: unit; add integration and e2e only if the spec lists them).

- **Unit:** Write tests for all input/output pairs, edge cases, and error cases; place in unit hint paths (or follow project layout below); use mocks for boundaries (ports, I/O). Tests must fail (e.g. function not defined or wrong return). Do **not** add production stubs or partial implementation in Red; only add the minimum so tests can run (e.g. module file that exports the function/class under test) if the spec targets an existing module. Prefer tests failing on missing module or wrong return.
- **Integration:** If the spec defines an "Integration" scope and paths, write integration tests that use **real** implementations for the boundaries listed (e.g. real adapter + temp file, or real adapters with injected fetch; no real network). Assert the same behaviors as the spec. Place in the spec's integration paths (e.g. `*.integration.test.js`). Tests must fail until the implementation exists.
- **E2E:** Only if the spec defines E2E: write tests per the spec's E2E hint (path + scope). Same Red rule: fail for the right reason.
- **Unit placement:** Place tests in the path from the spec Test file hint or follow project layout: `tests/**/*.test.js` or `business_modules/<module>/<sub>/__tests__/<name>.test.js` (see [docs/TDD-PLAN-AND-WORKFLOW.md](../../docs/TDD-PLAN-AND-WORKFLOW.md) §4–5).
- Use existing Jest and project test patterns (describe/it, same style as other tests in the repo). Do **not** write implementation or mocks for the behavior under test.

### 2b. Evaluate coverage (LLM)

- Compare the written tests to the spec (I/O table, edge cases, error cases, Success criteria, Test levels).
- Report: **Covered** (which spec items have at least one test per level) and **Gaps** (missing I/O row, missing edge/error case, missing test level, or missing assertion).
- If there are gaps, add the missing tests and re-evaluate until coverage is acceptable. This stays inside Red; no commit yet.
- Then proceed to Confirm red.

### 3. Confirm red

- Run the full set of tests (unit + integration, and e2e if present), e.g. `npm test -- <path-to-test-dir-or-files>`.
- Confirm **all** new tests fail for the right reason.

### 4. Green phase (same run)

- **Without pausing for the user to commit tests**, implement the code that makes **all** written tests pass (unit and integration, and e2e if present). Create only the production code required by the tests (e.g. create module scaffold when tests expect a module; add adapters when tests require them).
- **Do not add new tests during or after Green.** The test set is fixed when Red is confirmed (step 3).
- **Do not fix or change existing tests to make them pass.** Green = production code only. If a test fails, change the **implementation**, not the test. Do not relax assertions, change expected values, adjust mocks or setup, or edit test code so the test passes; change production behavior so the existing test assertions are satisfied. Do **not** modify existing tests unless the user **explicitly** asks you to fix a broken test.
- Run tests and iterate until all specified tests pass. If a test cannot be made green by any reasonable production change, report that to the user instead of changing the test. Run the module validator if the spec targets a business module (`npm run validate:module -- --module=<name>`).
- **Exception:** If the user explicitly asks to stop after Red or to wait for test commit before implementing, then stop after step 3 and tell them to commit; implement only when they say they have committed.

## Summary

| Phase   | Action |
|---------|--------|
| Red     | Read spec → write tests for all levels (unit + integration/e2e if specified) → evaluate coverage (LLM), add missing tests → run tests → confirm fail. No production implementation or stubs; only minimum so tests run (e.g. exports) if needed. **Tests are then fixed; no new tests and no test edits in Green.** |
| Green   | Implement to pass **existing** tests only; **do not add new tests**; **do not fix or change existing tests**—change production code only; iterate until green; run module validator if applicable. If a test cannot be made green by production changes, report to user. (Pause for commit only if the user explicitly asks to stop after Red.) |

| Level       | Red: write …                                         | Green: …               |
| ----------- | ---------------------------------------------------- | ---------------------- |
| Unit        | All I/O, edge, error; mocked ports                    | Implement to pass      |
| Integration | Flows with real port impls (temp fs, injected fetch) | Implement/wire so pass |
| E2E         | Only if spec lists E2E                               | Same                   |

## See also

- [docs/2026-02-19_17-38-spec-first-tdd-workflow.md](../../docs/2026-02-19_17-38-spec-first-tdd-workflow.md) — Full three-step workflow.
- [.cursor/rules.md](../../.cursor/rules.md) — "Spec-first TDD" subsection.
