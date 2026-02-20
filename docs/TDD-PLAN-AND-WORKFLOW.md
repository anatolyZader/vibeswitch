# TDD Plan and Workflow — VibeSwitch

**Goal:** Develop VibeSwitch using Test-Driven Development (TDD) consistently. Tests are the verifiable target the Agent iterates against.

---

## 1. Why TDD for VibeSwitch

- **Clear target:** Agents perform best with a concrete goal. Tests provide exactly that—input/output pairs and behavior the implementation must satisfy.
- **Acceptance criteria:** The test suite *is* the acceptance criteria. No ambiguity about “done.”
- **Safe refactors:** Existing behavior is protected by tests when you change code.
- **Design feedback:** Writing tests first often improves API design (small, testable functions).

---

## 2. The TDD Workflow (Strict Phases)

Use this workflow for **every** new feature or behavior. Do not skip phases.

### Phase A: Write tests first (Red)

1. **You (or the Agent) write tests** based on expected input/output and behavior. When using a spec: write tests for **every test level** declared in the spec (unit, and integration/e2e if the spec lists them). Place tests per the spec Test file hint per level.
2. **Evaluate coverage (LLM):** When using a spec, compare the written tests to the spec (I/O table, edge cases, error cases, success criteria, test levels). Report gaps; add any missing tests until coverage is acceptable. This stays inside Red; no commit yet.
3. **Be explicit** that you’re doing TDD so the Agent:
   - Does **not** create mock implementations or stubs for functionality that doesn’t exist yet.
   - Does **not** write the real implementation in this phase.
4. Follow existing test patterns (see §4).
5. Tests should target a **specific unit/function/component** with a clear contract (e.g. `validateEmail(str) → boolean`), or (for integration) a flow with real port implementations.

### Phase B: Run tests and confirm they fail

1. **Run the full set of tests** (unit + integration, and e2e if present), e.g. `npm test` or a focused run.
2. **Confirm all new tests fail** for the right reason (e.g. “function not defined” or “expected true, received undefined”).
3. **Do not write implementation code in this phase.** If tests pass already, the behavior may already exist or the tests are wrong—fix the tests or scope.

### Phase C: Commit the tests

1. When you’re satisfied with the tests (names, cases, coverage of the contract), **commit only the test file(s)**.
2. Commit message example: `test: add tests for validateEmail (TDD red phase)`.

### Phase D: Implement to pass (Green)

1. **Ask the Agent to implement** the code that makes **all** written tests pass (unit and integration, and e2e if present).
2. **Instruct:** “Do not modify the tests. Keep iterating until all tests pass.”
3. Agent runs tests, sees failures, fixes implementation, repeats until green.
4. Implementation may be minimal (e.g. return a constant first) then generalized—that’s fine.

### Phase E: Commit the implementation

1. When all relevant tests pass, **commit the implementation**.
2. Commit message example: `feat: implement validateEmail to pass tests`.

### Phase F: Refactor (optional)

1. If needed, refactor for clarity/performance while keeping tests green.
2. Commit refactors separately if they’re non-trivial.

---

## 3. Example Prompts to Use With the Agent

Use these as templates; replace the example with your actual function/behavior.

### Phase A + B (tests first, then run and confirm fail)

```text
Write tests for a function that validates email addresses.

Expected behavior:
- "user@example.com" returns true
- "invalid-email" returns false
- Empty string returns false

Use the testing patterns in `__tests__/` (or `tests/`). Don't implement the function yet—I want the tests to fail first. Put the tests in [e.g. tests/business_modules/foo/__tests__/validateEmail.test.js].
```

Then:

```text
Run the tests and confirm they fail. Do not write any implementation code at this stage.
```

### Phase C (commit)

You do this yourself (or ask the Agent):  
“Commit only the new test file(s) with message: test: add tests for validateEmail (TDD red phase).”

### Phase D (implement)

```text
Now implement the validateEmail function to pass all tests. Don't modify the tests. Keep iterating until all tests pass.
```

For a different feature:

```text
Implement [the feature/function] to pass all tests in [path/to/test file]. Do not change the tests. Run tests and iterate until everything passes.
```

---

## 4. Where Tests Live and Naming

- **Extension / business_modules:**  
  - `tests/**/*.test.js` (matched by Jest), or  
  - Next to code: `business_modules/<module>/<sub>/__tests__/<name>.test.js`
- **Dashboard app:**  
  - `dashboard-app/__tests__/<ComponentOrFeature>.test.js`
- **Jest config:** `jest.config.js` — `testMatch: ['**/tests/**/*.test.js']`.  
  Dashboard tests: `npm run test:dashboard`.

**Test levels (unit, integration, e2e):**

- **Unit:** Default; one unit per test, mocks at boundaries; fast. File: `*.test.js`.
- **Integration:** Multiple components + real implementations of some ports (e.g. real adapter, temp fs or mock HTTP); still in-process, no real external services. File: `*.integration.test.js`. Use when the spec lists Integration in Test levels.
- **E2E:** Full path (e.g. extension host, or command to controller to service to adapters); optional and spec-driven. File: `*.e2e.test.js` or electron suite. See the spec Test levels / Test file hint for which levels a feature uses.

**Naming:**

- File: `*.test.js` (unit), `*.integration.test.js` (integration), `*.e2e.test.js` (e2e). E.g. `validateEmail.test.js`, `reportService.integration.test.js`.
- Describe: feature or module (e.g. `describe('validateEmail', () => { ... })`).
- Cases: one behavior per `test()`/`it()` with clear expectation (e.g. `'returns true for valid email'`).

---

## 5. Test Patterns Already in the Project

- **Jest** for unit tests (`npm test`).
- **VSCode API** mocked via `tests/__mocks__/vscode.js` (see `jest.config.js`).
- **Node env** for most tests (`testEnvironment: 'node'`).
- **Fast-check** for property-based tests where used (e.g. some awareness/scoring tests).
- **React components (dashboard):** `ReactTestRenderer` in `dashboard-app/__tests__/`.

When adding tests, mirror existing style in the same area (e.g. same `describe`/`it` structure, same way of importing and mocking).

---

## 6. Rules for the Agent (TDD Mode)

When the user says they’re doing TDD or points to this doc:

1. **Red phase:** Only add or change **test** code. Do not add stubs or real implementation for the behavior under test (except the minimal “does not exist” state so tests fail for the right reason).
2. **Green phase:** Only add or change **implementation** code. Do not change test code unless the user explicitly asks to fix a broken test.
3. **Run tests:** When implementing, run the relevant test suite after changes and iterate until the specified tests pass.
4. **Scope:** One logical behavior per test; tests should be deterministic and fast (no flake, avoid heavy I/O in unit tests).

---

## 7. Checklist for Each New Feature

- [ ] Behavior/contract defined (e.g. function signature and expected return values).
- [ ] Tests written and placed in the correct `tests/` or `__tests__/` location.
- [ ] Tests run and **fail** (red) before any implementation.
- [ ] Tests committed (red phase).
- [ ] Implementation written; tests run until they **pass** (green).
- [ ] Implementation committed (green phase).
- [ ] Refactor if needed; tests stay green.

---

## 8. Quick Reference: Commands

| Action              | Command                          |
|---------------------|----------------------------------|
| Run all Jest tests  | `npm test`                       |
| Run dashboard tests | `npm run test:dashboard`         |
| Watch mode          | `npm run test:watch`             |
| Coverage            | `npm run test:coverage`          |
| MVP subset          | `npm run test:mvp`               |
| Unit only (optional)| `npm run test:unit` (if configured; excludes `*.integration.test.js` and e2e for faster feedback) |

---

## 9. Document History

- **2026-02-17:** Initial TDD plan and workflow for VibeSwitch; aligned with existing Jest setup and test layout.
