# Spec: [Feature or function name]

One-line summary of what is being specified.

**Principle:** A great spec defines not only functional requirements but **how those requirements will be tested**. Include edge cases, input-output pairs, and success criteria. That gives the agent everything it needs to produce meaningful tests—and you get exactly what you want covered.

---

## Contract

- **Name:** (e.g. function or module name)
- **Signature / API:** (e.g. `functionName(arg: type) => returnType` or module exports)
- **Location:** (e.g. `lib/validation.js` or `business_modules/<module>/app/service.js`)
  - **Business modules:** Put the **controller in the app layer** (`app/<module>Controller.js`). It accepts the call, extracts data, and calls the service. **Input layer only when the module has a transport entry** (HTTP, events, pub/sub, CLI, webhooks, etc.): add a file in `input/` that receives by transport and delegates. **When the module is only called in-process by other modules**, no input layer is needed — the app controller (or service) is the entry point; callers resolve it from DI and call it directly. If you do add input, name by type: `input/<module>Input.js`, `input/<module>EventListener.js`, `input/<module>Router.js`, or `input/<module>PubsubListener.js`.

---

## Naming (optional)

Conventions for names used in this spec (and in generated code). Fill only what applies; omit if using default conventions.

- **Function / module / API:** (e.g. camelCase for functions and files, PascalCase for classes)
- **Parameters and options:** (e.g. camelCase; `reportInput`, `platforms`)
- **Business module (when applicable):** File names camelCase. **Controller in app:** `app/<module>Controller.js`. **Input (optional):** only when transport; name by type (`Input.js`, `EventListener.js`, `Router.js`, `PubsubListener.js`). Domain: PascalCase for entities, value objects, events. **Ports:** `I<Module><Port>.js`. **Adapters:** `<module><Thing>Adapter.js` in `infrastructure/adapters/`. See `.cursor/skills/create-business-module/SKILL.md` for the full naming table and examples.

---

## Business module (optional)

Only present when the spec targets a module under `business_modules/`. The `/tdd` command uses this to create the module scaffold if it does not exist. **Build a rich DDD domain model**; include each kind only if applicable. You can open the spec after creation and refine the model. For the separation of responsibilities between this template, the create-business-module skill, and the module-structure rule, see `docs/MODULE-SPEC-SKILL-RULE-SEPARATION.md`.

- **Module name:** `<moduleName>` (e.g. `report`, `notifications`)
- **Layers (mandatory for modules):**
  - **Input (optional):** Only when the module **receives messages from a transport** (HTTP, events, pub/sub, CLI, webhooks, etc.) — add a file in `input/` that receives and delegates only; name by type: `input/<module>Input.js`, `input/<module>EventListener.js`, `input/<module>Router.js`, or `input/<module>PubsubListener.js`. **When the module is only called in-process by other modules**, omit the input layer; the app controller (or service) is the entry — it accepts the call, extracts data, and calls the service.
  - **App:** Put the **controller in the app layer** (`app/<module>Controller.js`). It accepts the request/message, extracts data, and calls the service. The main application service lives in `app/<module>Service.js`.
- **Domain model (DDD)** — Fill only what applies; omit a bullet if not applicable:
  - **Entities:** (optional) Objects with identity; list name and brief role (e.g. `Report` — a publishable report with id).
  - **Aggregates / aggregate roots:** (optional) Consistency boundaries; list root entity and boundary (e.g. `Report` aggregate — report + publish outcomes).
  - **Value objects:** (optional) Immutable concepts (e.g. `ReportInput`, `PlatformResult`, `PublishResult`, ids).
  - **Domain events:** (optional) Things that happen (e.g. `ReportPublished` — content published to platform).
  - **Ports:** (optional) Interfaces for I/O (e.g. `IReportPublishPort`, `IReportContentSourcePort`); list name and method contract.

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

## Edge cases and corner cases

- **Edge cases:** Empty input; `null` / `undefined`; boundaries (min/max length, numbers); Unicode / special characters; duplicates, empty collections.
- **Corner cases:** Rare or combined conditions (e.g. empty collection with one invalid item, or multiple boundaries at once) that might expose gaps in handling.

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
