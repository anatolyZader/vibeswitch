---
name: tests-from-spec
description: When the user points to a spec file in docs/specs/, generate tests for all input/output, edge, and error variants in the spec and follow TDD (no implementation until tests are committed).
---

# Tests from Spec — Spec-First TDD

Use this skill when the user points to a spec file (e.g. in `docs/specs/`) or says "from spec" / "tests from spec". Generate tests that cover every variant in the spec, then follow the TDD workflow without writing implementation until the user has committed the tests.

## Prerequisites

- A spec file exists in `docs/specs/` (or path given by user) using the format in [docs/specs/SPEC-TEMPLATE.md](../../docs/specs/SPEC-TEMPLATE.md).
- Project TDD rules and test layout are in [docs/TDD-PLAN-AND-WORKFLOW.md](../../docs/TDD-PLAN-AND-WORKFLOW.md).

## Instructions

### 1. Read the spec

- Open and read the spec file (path from user or e.g. `docs/specs/spec-<name>.md`).
- Identify: **Contract** (name, signature, location), **Input/Output** pairs (or table), **Edge cases**, **Error cases**, **Invariants**, **Success criteria** (how it will be tested), and optional **Test file hint**. A good spec defines not only what the feature does but how it will be tested—use that to produce exactly the coverage the user wants.

### 2. Write tests (Red phase only)

- Write tests that cover **all** input/output pairs, edge cases, and error cases listed in the spec.
- Place tests in the path from the spec’s "Test file hint" or follow project layout: `tests/**/*.test.js` or `business_modules/<module>/<sub>/__tests__/<name>.test.js` (see [docs/TDD-PLAN-AND-WORKFLOW.md](../../docs/TDD-PLAN-AND-WORKFLOW.md) §4–5).
- Use existing Jest and project test patterns (describe/it, same style as other tests in the repo).
- Do **not** write implementation or mocks for the behavior under test. Tests must fail (e.g. function not defined or wrong return).

### 3. Confirm red

- Run the relevant test suite (e.g. `npm test -- <path-to-test-file>`).
- Confirm the new tests fail for the right reason. Do not write implementation in this step.

### 4. After user commits tests — Green phase

- When the user says they have committed the tests, implement the code that makes all tests pass.
- Do **not** modify the tests unless the user explicitly asks to fix a broken test.
- Run tests and iterate until all specified tests pass.

## Summary

| Phase   | Action |
|---------|--------|
| Red     | Read spec → write tests for all variants → run tests → confirm fail. No implementation. |
| Commit  | User commits test file(s). |
| Green   | Implement to pass all tests; do not change tests; iterate until green. |

## See also

- [docs/2026-02-19_17-38-spec-first-tdd-workflow.md](../../docs/2026-02-19_17-38-spec-first-tdd-workflow.md) — Full three-step workflow.
- [.cursor/rules.md](../../.cursor/rules.md) — "Spec-first TDD" subsection.
