# Spec Template, Create-Business-Module Skill, and Module-Structure Rule

This document explains the **role** of each artifact, **what should be put in each**, and how they work together so there is a clear separation of functionality and no conflicting guidance. See also: `docs/specs/SPEC-TEMPLATE.md`, `.cursor/skills/create-business-module/SKILL.md`, `.cursor/rules/module-structure.mdc`.

---

## 1. Overview

| Artifact | Role | When used |
|----------|------|-----------|
| **SPEC-TEMPLATE.md** | Template for writing a spec (feature, function, or business module). What to specify and how it will be tested. | `/spec` or authoring a spec in `docs/specs/`. |
| **create-business-module (SKILL.md)** | How to create or extend a business module: schema, workflows, file templates, validator. Single source of truth for layout and naming. | Creating/extending a module; `/tdd` when creating a module scaffold from a spec. |
| **module-structure.mdc** | Mandatory rule when editing under `business_modules/**`. Enforces structure; points to the skill for full schema. | Automatically when editing any file under `business_modules/`. |

Flow: Spec (optional) then TDD/implementation; skill used for layout; rule applies on every edit under business_modules.

## 2. SPEC-TEMPLATE.md (`docs/specs/SPEC-TEMPLATE.md`)

**Role:** Spec authoring only. One spec = one feature, function, or business module. It defines **what to specify** (contract, behavior, edge/error cases) and **how the feature will be tested** (success criteria, test levels, test file hints). It is **not** the place for long "how to build a module" instructions or code templates; those live in the skill.

**What to put here:**
- **Contract:** Name, API/signature, and **location** (e.g. `business_modules/<module>/app/service.js`). For business modules: a **short** reminder that the controller is in the app layer and the input layer is optional when the module is only called in-process. Do not duplicate the full directory tree.
- **Naming (optional):** Conventions for the spec and generated code. For business modules: a **brief** summary (e.g. controller in app; input optional; name by type) and a pointer: "See create-business-module skill for full table."
- **Business module (optional):** Only when the spec targets a module under `business_modules/`. Put: **module name**, **DDD domain model** (entities, aggregates, value objects, events, ports), and **short** layer rules (input optional when transport; app has controller + service). Do not list every file type or code template—the skill does that.
- **Input/Output, Edge cases, Error cases, Invariants, Success criteria, Test levels, Test file hint:** All spec and test-definition content.

**What not to put here:** Full directory trees for business modules; step-by-step "create input/ then app/ then domain/" workflow; code snippets for Input, EventListener, Router; validator commands or checklist; detailed "allowed imports" per layer. Those belong in the skill or rule.

**Principle:** The spec template stays feature/spec-centric. It gives just enough structure and reminders for business modules so that a filled-in spec can drive TDD and scaffold creation; the **canonical** structure and build instructions live in the skill.

## 3. Create-Business-Module Skill (`.cursor/skills/create-business-module/SKILL.md`)

**Role:** **Single source of truth** for the business module schema (directory tree, per-layer contract, naming rules, dependency flow) and the **operational guide** for creating or extending a module (when and how to add input, how to build each input type, how to wire composition and run the validator). Used by humans and agents when creating or extending a business module, or when generating a module scaffold from a spec (e.g. `/tdd`).

**What to put here:**
- **Module structure schema:** Full **directory tree** (parameterized by `<module>`), with comments that input is optional and when to use it. **Per-layer contract table**: files, allowed imports, responsibility. **Naming rules table**: Input, App, Domain, Infrastructure file patterns and examples. **Dependency flow**: Input→App, App→Domain, App←Infrastructure, no cross-module imports.
- **Input layer:** **Rule:** Add input only when the module has a transport (HTTP, events, pub/sub, CLI, etc.); when only in-process callers, do not add input—the app controller or service is the entry. **File types:** Input.js, EventListener.js, Router.js, PubsubListener.js. **Templates/shape** for each (class name, constructor, delegate pattern; Fastify router template if applicable).
- **App layer:** Controller lives in app; accepts request/message, extracts data, calls service. When to add controller; no HTTP or framework APIs in app.
- **Workflow:** New module—create dirs (input only if transport), add at least one file per layer used, wire in compositionRoot. New feature—add files in the correct layer. Tests—mirror structure. Composition—wire in compositionRoot. **Validator:** run `npm run validate:module -- --module=<name>`; document that **app, domain, infrastructure** are required and **input is optional** (if present, must contain at least one .js file). Checklist and "Done = validator passes." References to the rule and architecture docs.

**What not to put here:** Feature-specific input/output tables or success criteria (those are in the spec). Enforcing structure on every edit (that is the rule's job).

**Principle:** The skill is the **build-time** authority. Anyone creating or extending a business module should follow this skill; the rule ensures the same structure is respected when editing existing files.

## 4. Module-Structure Rule (`.cursor/rules/module-structure.mdc`)

**Role:** **Mandatory rule** that applies whenever code under `business_modules/**` is created or edited (via `globs: business_modules/**/*`, `alwaysApply: true`). It ensures that every touch to a business module respects the same structure and naming. The rule is kept **short** and points to the **skill** for the full schema and templates so the rule does not duplicate long content.

**What to put here:**
- **Description / globs:** When the rule applies (`business_modules/**/*`, alwaysApply).
- **Directory layout:** A **compact** tree: input (optional), app, domain, infrastructure; one line per layer. Short comment that input is omitted when only in-process callers.
- **Layer responsibilities:** One sentence per layer: Input (optional, transport only; receive and delegate); App (controller or service is entry when no input; extract and call service; orchestrate domain and ports); Domain (no app/infra imports); Infrastructure (adapters implement ports).
- **File and type naming:** A short table: rows for Input, App, Domain, Infrastructure; columns for location and naming pattern. Plus camelCase and port naming (I<Module><Port>.js).
- **Rules when adding new code:** New module—create app, domain, infrastructure; add input only when transport. New feature—correct layer, existing subdirs. Cross-cutting code→cross-cut-modules. Composition—wire in compositionRoot, resolve from DI.
- **References:** "Canonical layout and schema: create-business-module SKILL.md." Links to .cursor/rules.md and architecture docs.

**What not to put here:** Full code templates (Input, Router, Fastify)—those are in the skill. Workflow steps like "run validator and paste output"—in the skill. Spec-specific content (contract, I/O, test hints)—in the spec template. Long tables (e.g. every port/adapter example)—in the skill; the rule keeps one short naming table.

**Principle:** The rule is mandatory and lightweight. It reminds structure and naming and defers to the skill for the full schema and how-to.

## 5. Separation Summary

| Topic | Spec template | Skill | Rule |
|-------|----------------|-------|------|
| Contract / API / location | Yes (per feature) | No | No |
| DDD domain model | Yes (in spec) | No | No |
| Input/Output, edge/error, tests | Yes | No | No |
| Directory tree | Short reminder | Full tree | Compact tree |
| Per-layer contract | No | Full table | One sentence per layer |
| Naming | Summary + "see skill" | Full table + examples | Short table |
| Input optional / in-process | Reminder | Full rule + workflow | Reminder |
| Input file types | List only | Templates + code | List |
| Code templates | No | Yes | No |
| Workflow, validator, checklist | No | Yes | No |
| Applies when | Writing a spec | Creating/extending module | Editing under business_modules/ |

## 6. Consistency

- Input optional: all three state it; app controller (or service) is entry when only in-process.
- Validator: skill must say app, domain, infrastructure required; input optional. Match scripts/validate-module.js.
- Single source of truth: skill is canonical for tree, per-layer contract, naming. Rule and spec template summarize and point to it.
- Update order: (1) skill, (2) rule, (3) spec template.

## 7. References

- Spec template: docs/specs/SPEC-TEMPLATE.md
- Skill: .cursor/skills/create-business-module/SKILL.md
- Rule: .cursor/rules/module-structure.mdc
- Validator: scripts/validate-module.js
