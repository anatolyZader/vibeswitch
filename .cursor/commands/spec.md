# Spec — Create spec from description

Create a filled-in spec file from a short free-form description. Use this command when you want to **automate spec writing**: you describe the module or functionality in plain language; the agent drafts the full spec so you can peruse and improve it before using TDD.

## How to use

In Cursor chat, type **`/spec`** followed by a short description of the desired module or functionality in free language. For example:

- `/spec validate email addresses: valid format returns true, invalid returns false, empty string false`
- `/spec function that normalizes path segments and resolves .. and . for the current OS`
- `/spec module to compute session duration from start and end timestamps; handle same-day and overnight`
- `/spec new business module for notifications: send in-app and email` → creates spec **and** creates the four-layer module structure (see “When the description is a business module” below).

## Instruction (for the agent)

The user has invoked the **/spec** command. The rest of their message (or the immediately following message) is a **short description in free language** of the module or functionality they want to develop.

**Your task:**

1. **Infer** from the description: the intended contract (name, signature/API, file location), main input/output behavior, edge cases, error cases, and invariants.
2. **Create a new spec file** in `docs/specs/` using the structure in `docs/specs/SPEC-TEMPLATE.md`. File naming: `spec-<feature-slug>.md` (e.g. `spec-validateEmail.md`, `spec-normalizePath.md`). Use a kebab-case or camelCase slug derived from the description.
3. **Fill in every section** of the spec with concrete content (no placeholders left as "(e.g. …)" unless the description is too vague):
   - **Contract** — Name, signature/API, and suggested file location.
   - **Input / Output** — Explicit input → output pairs (table or bullets).
   - **Edge cases** — Empty, null/undefined, boundaries, Unicode, duplicates, etc., as relevant.
   - **Error cases** — Invalid types, preconditions, what throws or returns an error.
   - **Invariants** — e.g. pure function, no side effects, idempotent.
   - **Success criteria** — What “done” and “correct” mean; what must be tested.
   - **Test file hint** — Suggested path for the test file (e.g. `tests/lib/<name>.test.js` or `tests/business_modules/<module>/domain/__tests__/<name>.test.js`).
4. **Write the spec so it defines not only behavior but how it will be tested** — the agent (or you) will use it with `/tdd` to generate tests; good specs make test generation unambiguous.

**After you create the spec:** Tell the user the path of the new file. The user will **peruse and improve** the spec if needed, then use **`/tdd`** with that spec path to start spec-first TDD (Red → commit tests → Green).

**If the description is ambiguous:** Make reasonable assumptions and state them briefly in the spec (e.g. in the one-line summary or Contract). The user can refine when they peruse.

---

## When the description is a business module

If the user’s description indicates they want to **build a business module** (e.g. “new module for X”, “business module that …”, “add a module to handle …”, “feature in business_modules”), you MUST also apply the **create-business-module** workflow:

1. **Still create the spec first** (as above), with **Contract → Location** set to a path under `business_modules/<moduleName>/` (e.g. `business_modules/<moduleName>/app/<moduleName>Service.js` or domain/ports as appropriate).
2. **Then follow the create-business-module skill**: read `.cursor/skills/create-business-module/SKILL.md` and execute its workflow — create the four layers (input/, app/, domain/, infrastructure/adapters/), use correct naming, mirror tests under `tests/business_modules/<moduleName>/`, and wire the module in `compositionRoot.js`. Use the spec’s Contract and Test file hint for exact paths.
3. **Verification:** Before marking done, complete the skill’s verification checklist (four layers, naming, tests mirror layout, no cross-module imports, domain purity).

So for a business-module request: **spec first** (so behavior is defined and testable), then **create the module structure and wire it** using the create-business-module skill. The user can still run `/tdd` on the spec afterward to generate tests and implement.

**Reference:** Template and principle: `docs/specs/SPEC-TEMPLATE.md`. Workflow: `docs/2026-02-20_07-36-spec-first-tdd-and-agent-workflow.md` (or latest `docs/*-spec-first-tdd-and-agent-workflow.md`). Module structure: `.cursor/skills/create-business-module/SKILL.md`, `.cursor/rules/module-structure.mdc`.
