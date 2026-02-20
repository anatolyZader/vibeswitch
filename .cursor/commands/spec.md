# Spec — Create spec from description

Create a filled-in spec file from a short free-form description. Use this command when you want to **automate spec writing**: you describe the module or functionality in plain language; the agent drafts the full spec so you can peruse and improve it before using TDD.

## How to use

In Cursor chat, type **`/spec`** followed by a short description of the desired module or functionality in free language. For example:

- `/spec validate email addresses: valid format returns true, invalid returns false, empty string false`
- `/spec function that normalizes path segments and resolves .. and . for the current OS`
- `/spec module to compute session duration from start and end timestamps; handle same-day and overnight`
- `/spec new business module for notifications: send in-app and email` → creates spec (including the optional **Business module** section); run **`/tdd`** later to create the module scaffold and run TDD.

## Instruction (for the agent)

The user has invoked the **/spec** command. The rest of their message (or the immediately following message) is a **short description in free language** of the module or functionality they want to develop.

**Your task:**

1. **Infer** from the description: the intended contract (name, signature/API, file location), main input/output behavior, edge cases, error cases, and invariants.
2. **Create a new spec file** in `docs/specs/` using the structure in `docs/specs/SPEC-TEMPLATE.md`. File naming: `spec-<feature-slug>.md` (e.g. `spec-validateEmail.md`, `spec-normalizePath.md`). Use a kebab-case or camelCase slug derived from the description.
3. **Fill in every section** of the spec with concrete content (no placeholders left as "(e.g. …)" unless the description is too vague):
   - **Contract** — Name, signature/API, and suggested file location.
   - **Business module (optional)** — When the feature belongs under `business_modules/` (either the user says “business module” or the intended Contract Location is under `business_modules/<name>/`), fill this section: **Module name** (e.g. `report`, `notifications`) and optionally **Domain elements** (entities, ports, services mentioned in the spec). This lets `/tdd` create the module scaffold if it does not exist.
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

## Creating the module scaffold

**By default, do not run the create-business-module skill.** The primary flow is: create the spec only; the user runs **`/tdd`** later, and the TDD command will create the business-module scaffold automatically when the spec targets a module that does not exist.

**Exception:** If the user **explicitly** asks to also create the module scaffold now (e.g. “spec and create the module”, “create the spec and the business module”), then after writing the spec run the create-business-module skill: read `.cursor/skills/create-business-module/SKILL.md` and follow it for the module name from the spec’s Business module section or Contract → Location.

**Reference:** Spec template: `docs/specs/SPEC-TEMPLATE.md`. Process for business modules: `.cursor/skills/create-business-module/SKILL.md`.
