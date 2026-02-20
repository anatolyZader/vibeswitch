# TDD — Spec-First TDD

Start spec-first TDD. Replace `[path-to-spec]` with the actual spec file (e.g. `docs/specs/spec-validateEmail.md` or `docs/specs/spec-report.md`).

## Instruction

I'm starting spec-first TDD. The spec is at **[path-to-spec]**.

Use the **tests-from-spec** skill (`.cursor/skills/tests-from-spec/SKILL.md`) for the Red and Green phases. Follow the steps below in order.

### 1. Read the spec

Read the spec file and `docs/TDD-PLAN-AND-WORKFLOW.md`. Identify Contract (name, signature, location), Input/Output, edge cases, error cases, invariants, success criteria, test levels, and test file hint (unit / integration / e2e).

### 2. Ensure business module exists (if the spec targets one)

- **Determine if the spec targets a business module:** Prefer an explicit **"Business module" → Module name** in the spec. Else parse **Contract → Location** for any path like `business_modules/<name>/` and use that `<name>`.
- **If the spec targets a business module:**
  - Check if the module exists and is complete: run `npm run validate:module -- --module=<moduleName>`. If the module directory does not exist, the validator will fail.
  - If the module **does not exist or is incomplete:** Run the **create-business-module** skill for that module: read `.cursor/skills/create-business-module/SKILL.md` and follow it. Create the layout, wire composition, and run the validator until it passes. Do **not** implement the feature yet—only the scaffold.
  - If the module already exists (validator passes), skip creation.
- **If the spec does not target a business module** (e.g. Location is `lib/` or similar), skip this step.

### 3. Red phase: write tests

Follow the tests-from-spec skill. Write tests that cover every input/output pair, edge case, and error case in the spec, and **for every test level** (unit, integration, e2e) **listed in the spec**. Place tests per the spec test file hint or `tests/business_modules/<module>/...`. Do **not** write implementation or mocks; tests must fail (e.g. function not defined or wrong return).

### 3b. Evaluate coverage (LLM)

Compare the written tests to the spec (I/O table, edge cases, error cases, success criteria, test levels). Report gaps; add any missing tests, then re-evaluate until coverage is acceptable. This stays inside Red; no commit yet.

### 4. Confirm red

Run the full set of tests (unit + integration, and e2e if any), e.g. `npm test -- <path-to-test-dir-or-files>`. Confirm **all** new tests fail for the right reason. Do not write implementation in this step.

### 5. After user commits tests — Green phase

When the user says they have committed the tests, implement the code that makes **all** specified tests pass (all levels). Do not modify the tests unless the user explicitly asks to fix a broken test. Run tests and iterate until all specified tests pass.

---

Full workflow: see `docs/2026-02-19_17-38-spec-first-tdd-workflow.md` (or latest `docs/*-spec-first-tdd-workflow.md`).
