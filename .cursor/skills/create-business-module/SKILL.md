---
name: create-business-module
description: Create or extend a business module with the mandatory 4-layer structure (input, app, domain, infrastructure). Use when the user asks to create a new business module, add a new module, add a feature to a business module, or when creating new files under business_modules/.
---

# Create Business Module

When creating a **new business module** or adding a **new feature/layer** to an existing one, follow this workflow. The structure is mandatory; see [.cursor/rules/module-structure.mdc](../../.cursor/rules/module-structure.mdc) for full detail.

## Quick reference: four layers

| Layer | Path | Role |
|-------|------|------|
| Input | `business_modules/<name>/input/` | Controllers, event listeners — thin; call app only |
| App | `business_modules/<name>/app/` | Services, engines; orchestrate domain and ports |
| Domain | `business_modules/<name>/domain/` | entities/, aggregates/, ports/, services/ — no app/infra imports |
| Infrastructure | `business_modules/<name>/infrastructure/adapters/` | Adapters implementing domain ports |

Naming: `<module>Controller.js` or `<module>EventListener.js` (input); `<module>Service.js` (app); `I<Module><Port>.js` (domain/ports); `<module><Thing>Adapter.js` (infrastructure). File names: camelCase.

## Workflow

### 1. New module — create layout

- Create `business_modules/<moduleName>/` with:
  - `input/` — at least one entry (e.g. `<module>EventListener.js` or `<module>Controller.js`)
  - `app/` — at least `<module>Service.js` (and optionally `<module>Engine.js`)
  - `domain/` — subdirs as needed: `entities/`, `aggregates/`, `ports/`, `services/`
  - `infrastructure/adapters/` — at least one adapter implementing a domain port
- Add `index.js` at module root only if you need a barrel/entry.
- Do **not** import one business module from another; wire in `compositionRoot.js` and resolve via DI.

### 2. New feature in existing module

- Add files in the **correct layer** only.
- Reuse existing subdirs when they fit (e.g. `app/usage/`, `app/scoring/`, `app/classification/`).
- If the feature is cross-cutting (shared across modules), put it in `cross-cut-modules/` instead.

### 3. Tests (mirror structure)

- For each new source file under `business_modules/<name>/<layer>/...`, add a test under `tests/business_modules/<name>/<layer>/...` with the same path and `.test.js` suffix (e.g. `app/foo.js` → `tests/business_modules/<name>/app/foo.test.js`).

### 4. Composition

- Register new services/adapters and wire the module in `compositionRoot.js`.
- Input layer resolves the app service from the DI container; no direct imports of other business modules.

### 5. Verification (before marking done)

- [ ] All four layer directories exist (for a new module) or new files are in the correct layer (for an extension).
- [ ] Naming follows the pattern above (module prefix on controllers, services, ports, adapters; camelCase files).
- [ ] Tests mirror the source tree under `tests/business_modules/<moduleName>/`.
- [ ] No direct imports between business modules; composition is in `compositionRoot.js`.
- [ ] Domain has no imports from app or infrastructure.

## Reference

- Full structure and naming: [.cursor/rules/module-structure.mdc](../../.cursor/rules/module-structure.mdc)
- Architecture and DDD boundaries: `.cursor/rules.md` (Architecture Rules, DDD/Hexagonal)
- Rationale: `docs/ARCHITECTURE-COMPARISON.md`, `docs/APP-DIRECTORY-ORGANIZATION-RATIONALE.md`
