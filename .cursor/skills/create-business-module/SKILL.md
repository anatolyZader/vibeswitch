---
name: create-business-module
description: Create or extend a business module with the mandatory 4-layer structure (input, app, domain, infrastructure). Use when the user asks to create a new business module, add a new module, add a feature to a business module, or when creating new files under business_modules/.
---

# Create Business Module

When creating a **new business module** or adding a **new feature/layer** to an existing one, follow this workflow. Use the **module structure schema** below as the single source of truth for layout, naming, and layer boundaries. See [.cursor/rules/module-structure.mdc](../../.cursor/rules/module-structure.mdc) for the same rules in rule form.

---

## Module structure schema (reference layout)

*Extracted from `eventstorm/gitModuleExample.js`. Apply this structure and naming to every new module.*

### Directory tree (parameterize `<module>` and `<Module>`)

```
business_modules/<module>/
├── index.js                          # Optional barrel
├── input/
│   ├── <module>Controller.js         # HTTP/command handlers
│   └── <module>PubsubListener.js     # Or <module>EventListener.js — message/event listener
├── app/
│   ├── <module>Service.js            # Main application service
│   ├── <module>Engine.js              # Optional orchestrator
│   └── interfaces/                   # Optional: I<Module>Service.js
├── domain/
│   ├── entities/                     # <Entity>.js (e.g. Repository.js)
│   ├── value_objects/                # <ValueObject>.js (e.g. UserId.js, RepoId.js)
│   ├── events/                       # <Event>.js (e.g. RepoFetchedEvent.js)
│   ├── aggregates/                   # Optional
│   ├── ports/                        # I<Module><Port>.js (e.g. IGitPort.js, IGitPersistPort.js)
│   └── services/                    # Optional domain services
└── infrastructure/
    └── adapters/
        └── <module><Thing>Adapter.js # e.g. gitGithubAdapter.js, gitPostgresAdapter.js
```

### Per-layer contract

| Layer | Files (examples) | Allowed imports | Responsibility |
|-------|-------------------|-----------------|----------------|
| **Input** | `<module>Controller.js`, `<module>PubsubListener.js` | DI container, framework (e.g. fastify); no domain/app internals | Resolve `<module>Service` from DI (or request.diScope); call service methods only; map transport errors to HTTP/response. No business logic. |
| **App** | `<module>Service.js`, optional `<module>Engine.js` | Domain only (entities, value_objects, events, ports) | Constructor receives **port implementations** (e.g. `{ gitAdapter, gitPersistAdapter, gitMessagingAdapter }`). Orchestrate: use domain types, call port methods, create/publish domain events via ports. No direct DB/FS/HTTP. |
| **Domain** | entities/, value_objects/, events/, ports/, services/ | Nothing from app or infrastructure | Pure domain: entities, value objects, domain events, port **interfaces** (abstract; throw in constructor if `new.target === I*`). No I/O. |
| **Infrastructure** | `<module><Thing>Adapter.js` in `adapters/` | Domain ports only (to extend/implement) | Each adapter extends one domain port; implements its methods with real I/O (DB, HTTP, Pub/Sub, FS). |

### Naming rules

| Kind | Pattern | Example (module = git) |
|------|---------|-------------------------|
| Input | `<module>Controller.js`, `<module>EventListener.js` or `<module>PubsubListener.js` | gitController.js, gitPubsubListener.js |
| App service | `<module>Service.js` | gitService.js |
| Domain entity | `domain/entities/<Entity>.js` | domain/entities/repository.js |
| Value object | `domain/value_objects/<Name>.js` | domain/value_objects/userId.js, repoId.js |
| Domain event | `domain/events/<Name>.js` | domain/events/repoFetchedEvent.js |
| Port | `domain/ports/I<Module><Port>.js` | domain/ports/IGitPort.js, IGitPersistPort.js |
| Adapter | `infrastructure/adapters/<module><Thing>Adapter.js` | gitGithubAdapter.js, gitPostgresAdapter.js |

All file names: **camelCase**. Port interface names: **I** + **Module** (Pascal) + **Port** (Pascal).

### Dependency flow

- **Input → App:** Resolve `<module>Service` from DI; call only public service methods.
- **App → Domain:** Import and use entities, value objects, events; call port methods (injected adapters).
- **App ← Infrastructure:** Adapters are injected into the app service (via constructor); each adapter implements one port.
- **Domain:** No outgoing imports to app or infrastructure.
- **Cross-module:** No direct imports between business modules; wire in `compositionRoot.js`; use DI or events.

---

## Workflow

### 1. New module — create layout

- Create `business_modules/<moduleName>/` following the **module structure schema** above:
  - `input/` — at least one of: `<module>Controller.js`, `<module>EventListener.js`, or `<module>PubsubListener.js`. Thin: resolve app service from DI, call service only.
  - `app/` — at least `<module>Service.js`. Service receives port implementations via constructor; orchestrates domain and ports only.
  - `domain/` — subdirs as needed: `entities/`, `value_objects/`, `events/`, `aggregates/`, `ports/`, `services/`. No imports from app or infrastructure.
  - `infrastructure/adapters/` — at least one adapter per port: `<module><Thing>Adapter.js`, each extending the corresponding `I<Module><Port>`.
- Add `index.js` at module root only if needed.
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

### 5. Run the validator (required gate)

Run the deterministic validator. **Done = validator passes.**

```bash
npm run validate:module -- --module=<moduleName>
```

(or `pnpm run validate:module -- --module=<moduleName>` / `yarn run validate:module -- --module=<moduleName>`)

The validator checks:

- **Required dirs exist:** `input/`, `app/`, `domain/`, `infrastructure/` under `business_modules/<name>/`
- **Forbidden imports:** Domain must not import from infra, app, or input
- **No cross-module imports:** Only composition in `compositionRoot.js`; no direct `require` from another business module (pub/sub or DI only)
- **Required wiring:** `compositionRoot.js` must reference the module (e.g. `require('./business_modules/<name>/...')`)

If the validator fails, fix the reported issues and run it again. Do **not** mark the task done until `npm run validate:module -- --module=<name>` exits 0.

### 6. Verification checklist (before marking done)

- [ ] All four layer directories exist (for a new module) or new files are in the correct layer (for an extension).
- [ ] Layout and naming follow the **module structure schema** in this skill (directory tree, per-layer contract, naming rules, dependency flow).
- [ ] Input is thin (resolve service from DI, call service only); app receives ports via constructor; domain has no app/infra imports; adapters extend domain ports.
- [ ] Tests mirror the source tree under `tests/business_modules/<moduleName>/`.
- [ ] No direct imports between business modules; composition is in `compositionRoot.js`.
- [ ] **Validator passes:** `npm run validate:module -- --module=<moduleName>` exits 0.

## Done

**Done = validator passes.** Run `npm run validate:module -- --module=<moduleName>` and fix any errors until it exits 0. Do not mark the task complete until then.

## Reference

- **Schema source:** The module structure schema in this skill was extracted from `eventstorm/gitModuleExample.js`; no need to re-analyze that file.
- Full structure and naming: [.cursor/rules/module-structure.mdc](../../.cursor/rules/module-structure.mdc)
- Architecture and DDD boundaries: `.cursor/rules.md` (Architecture Rules, DDD/Hexagonal)
- Rationale: `docs/ARCHITECTURE-COMPARISON.md`, `docs/APP-DIRECTORY-ORGANIZATION-RATIONALE.md`
