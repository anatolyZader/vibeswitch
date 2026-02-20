# Spec: [Feature or function name]

One-line summary of what is being specified.

**Principle:** A great spec defines not only functional requirements but **how those requirements will be tested**. Include edge cases, input-output pairs, and success criteria. That gives the agent everything it needs to produce meaningful tests—and you get exactly what you want covered.

---

## Contract

- **Name:** (e.g. function or module name)
- **Signature / API:** (e.g. `functionName(arg: type) => returnType` or module exports)
- **Location:** (e.g. `lib/validation.js` or `business_modules/<module>/app/service.js`)

---

## Business module (optional)

Only present when the spec targets a module under `business_modules/`. The `/tdd` command uses this to create the module scaffold if it does not exist.

- **Module name:** `<moduleName>` (e.g. `report`, `notifications`)
- **Domain elements:** (optional) Entities, value objects, events, or ports mentioned in the spec (e.g. `IReportPublishPort`, `ReportService`) so the agent can align the create-business-module scaffold.

---

## Input / Output (and behavior)

List explicit input → output pairs. The agent will generate one test per pair (or per logical group).

| Input | Expected output / behavior |
|-------|-----------------------------|
| `"user@example.com"` | `true` |
| `"invalid-email"` | `false` |
| `""` (empty string) | `false` |

Or as bullets:

- `"user@example.com"` → `true`
- `"invalid-email"` → `false`
- Empty string → `false`

For error cases: e.g. `null` → throws / returns error.

---

## Edge cases

- Empty input
- `null` / `undefined`
- Boundaries (min/max length, numbers)
- Unicode / special characters
- Duplicates, empty collections

---

## Error cases

- Invalid types (e.g. number instead of string)
- Failing preconditions
- What should throw or return an error object

---

## Invariants

- e.g. "Output is always a boolean"
- e.g. "No side effects; pure function"
- e.g. "Idempotent when called twice"

---

## Success criteria (how this will be tested)

Define what “done” and “correct” mean so the agent can generate tests that match your intent:

- **Pass:** List conditions that must hold for the feature to be considered correct (e.g. “All input/output pairs in the table above pass”, “No unhandled throw for the listed error cases”).
- **Coverage:** What must be tested (e.g. “Every row in Input/Output”, “Every edge case and error case listed”).
- Optional: “Test passes when …” / “Test fails when …” for specific scenarios.

---

## Test levels (optional)

Define which test levels the spec requires. The agent generates tests for each level listed.

- **Unit (default):** One unit per test; boundaries (ports, I/O) mocked. Covers I/O table, edge cases, error cases. Always generated unless the spec says otherwise.
- **Integration (optional):** Real implementations of some boundaries (e.g. real adapter + temp fs, or real adapter + mock HTTP server). Covers "component + real port" flows. Only generated if the spec lists integration scope and paths.
- **E2E (optional):** Full path (e.g. input → app → real adapters, or extension command). Only if the spec explicitly requires it; rare for a single module.

Example when using integration:

- **Unit:** All input/output, edge, and error cases; mocked ports.
- **Integration:** (Optional.) List what to test with real boundaries, e.g.:
  - Service + real IReportContentSourcePort impl (e.g. temp file); assert read then publish flow.
  - Service + real IReportPublishPort adapters with injected fetch (no real network).
- **E2E:** (Optional.) Full flow, e.g. command → controller → service → real adapters; only if needed.

---

## Test file hint (optional)

Path(s) where the agent should place tests. Can be level-aware:

- **Unit:** e.g. `tests/lib/validateEmail.test.js`, `tests/business_modules/<module>/app/service.test.js`
- **Integration:** (if Test levels include Integration) e.g. `tests/business_modules/<module>/app/service.integration.test.js` — one-line scope (e.g. "Service + real ReportFsContentSourceAdapter + temp file; reportPath → read → publish").
- **E2E:** (if Test levels include E2E) path and scope.

Simple case (unit only):

- `tests/lib/validateEmail.test.js`
- `tests/business_modules/<module>/domain/__tests__/feature.test.js`
