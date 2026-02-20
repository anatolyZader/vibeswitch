---
name: tests-from-spec
description: When the user points to a spec file in docs/specs/, generate tests for all input/output, edge, and error variants in the spec and follow TDD (no implementation until tests are committed).
---

# Tests from Spec — Spec-First TDD

Use this skill when the user points to a spec file (e.g. in `docs/specs/`) or says "from spec" / "tests from spec". Generate tests that cover every variant in the spec, then follow the TDD workflow without writing implementation until the user has committed the tests.

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

- **Unit:** Write tests for all input/output pairs, edge cases, and error cases; place in unit hint paths (or follow project layout below); use mocks for boundaries (ports, I/O). Tests must fail (e.g. function not defined or wrong return).
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
- Confirm **all** new tests fail for the right reason. Do not write implementation in this step.

### 4. After user commits tests — Green phase

- When the user says they have committed the tests, implement the code that makes **all** written tests pass (unit and integration, and e2e if present).
- Do **not** modify the tests unless the user explicitly asks to fix a broken test.
- Run tests and iterate until all specified tests pass.

## Summary

| Phase   | Action |
|---------|--------|
| Red     | Read spec → write tests for all levels (unit + integration/e2e if specified) → evaluate coverage (LLM), add missing tests → run tests → confirm fail. No implementation. |
| Commit  | User commits test file(s). |
| Green   | Implement to pass all tests (all levels); do not change tests; iterate until green. |

| Level       | Red: write …                                         | Green: …               |
| ----------- | ---------------------------------------------------- | ---------------------- |
| Unit        | All I/O, edge, error; mocked ports                    | Implement to pass      |
| Integration | Flows with real port impls (temp fs, injected fetch) | Implement/wire so pass |
| E2E         | Only if spec lists E2E                               | Same                   |

## See also

- [docs/2026-02-19_17-38-spec-first-tdd-workflow.md](../../docs/2026-02-19_17-38-spec-first-tdd-workflow.md) — Full three-step workflow.
- [.cursor/rules.md](../../.cursor/rules.md) — "Spec-first TDD" subsection.
