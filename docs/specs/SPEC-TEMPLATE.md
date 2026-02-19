# Spec: [Feature or function name]

One-line summary of what is being specified.

**Principle:** A great spec defines not only functional requirements but **how those requirements will be tested**. Include edge cases, input-output pairs, and success criteria. That gives the agent everything it needs to produce meaningful tests—and you get exactly what you want covered.

---

## Contract

- **Name:** (e.g. function or module name)
- **Signature / API:** (e.g. `functionName(arg: type) => returnType` or module exports)
- **Location:** (e.g. `lib/validation.js` or `business_modules/<module>/app/service.js`)

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

## Test file hint (optional)

Path where the agent should place the test file, e.g.:

- `tests/lib/validateEmail.test.js`
- `tests/business_modules/<module>/domain/__tests__/feature.test.js`
