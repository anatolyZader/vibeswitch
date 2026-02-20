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
│   ├── <module>Controller.js         # Receive only: VS Code/CLI entry, or Fastify plugin that decorates with methods
│   ├── <module>Router.js             # Optional: Fastify HTTP routes (when target is HTTP app, not VS Code)
│   └── <module>PubsubListener.js     # Or <module>EventListener.js — message/event listener
├── app/
│   ├── <module>Service.js            # Main application service
│   ├── <module>Controller.js         # Optional: accept message/request, extract data, call service (used by input)
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
| **Input** | `<module>Controller.js`, `<module>Router.js`, `<module>PubsubListener.js` | DI container, framework (e.g. fastify); no domain/app internals | **Receive** the initial message only: HTTP routers declare routes; Fastify plugin **decorates** with handler methods. Handlers resolve app-layer Controller (or Service) from DI and delegate; map transport errors to HTTP/response. No extraction logic, no business logic. |
| **App** | `<module>Service.js`, optional `<module>Controller.js`, optional `<module>Engine.js` | Domain only (entities, value_objects, events, ports) | **Service:** Constructor receives **port implementations**; orchestrate domain and ports. **Controller:** Accept message/request, **extract** important data, call **Service** with that data. No direct DB/FS/HTTP. |
| **Domain** | entities/, value_objects/, events/, ports/, services/ | Nothing from app or infrastructure | Pure domain: entities, value objects, domain events, port **interfaces** (abstract; throw in constructor if `new.target === I*`). No I/O. |
| **Infrastructure** | `<module><Thing>Adapter.js` in `adapters/` | Domain ports only (to extend/implement) | Each adapter extends one domain port; implements its methods with real I/O (DB, HTTP, Pub/Sub, FS). |

### Naming rules

| Kind | Pattern | Example (module = git) |
|------|---------|-------------------------|
| Input | `<module>Controller.js` (receive/delegate or VS Code entry), `<module>Router.js` (HTTP only), `<module>EventListener.js` or `<module>PubsubListener.js` | gitController.js, aiRouter.js, gitPubsubListener.js |
| App service | `<module>Service.js` | gitService.js |
| App controller | `<module>Controller.js` | gitController.js (app layer: extract + call service) |
| Domain entity | `domain/entities/<Entity>.js` | domain/entities/repository.js |
| Value object | `domain/value_objects/<Name>.js` | domain/value_objects/userId.js, repoId.js |
| Domain event | `domain/events/<Name>.js` | domain/events/repoFetchedEvent.js |
| Port | `domain/ports/I<Module><Port>.js` | domain/ports/IGitPort.js, IGitPersistPort.js |
| Adapter | `infrastructure/adapters/<module><Thing>Adapter.js` | gitGithubAdapter.js, gitPostgresAdapter.js |

All file names: **camelCase**. Port interface names: **I** + **Module** (Pascal) + **Port** (Pascal).

### Dependency flow

- **Input → App:** Resolve `<module>Controller` or `<module>Service` from DI; call controller (which extracts data and calls service) or service only. No extraction or business logic in input.
- **App → Domain:** Import and use entities, value objects, events; call port methods (injected adapters).
- **App ← Infrastructure:** Adapters are injected into the app service (via constructor); each adapter implements one port.
- **Domain:** No outgoing imports to app or infrastructure.
- **Cross-module:** No direct imports between business modules; wire in `compositionRoot.js`; use DI or events.

---

## Input layer: file types and how to build them

The **input layer only receives** the initial message (HTTP request, event, command). It does **not** extract business data or contain business logic—it delegates to the **app layer** (Controller or Service). Use the right input type for the runtime; build each file type **exactly** as below.

### When to use which

- **VS Code extension (e.g. VibeSwitch):** Use `<module>Controller.js` and/or `<module>EventListener.js`. Do **not** add `<module>Router.js` (no Fastify/HTTP).
- **HTTP app (Fastify):** Use input `<module>Router.js` for routes/schemas and input `<module>Controller.js` as a Fastify plugin that decorates fastify with handler methods. Handlers resolve the app-layer Controller from request.diScope, call it with the request, and map errors to HTTP. Extraction and service calls live in the app-layer Controller.

### 1. Input Controller (input/`<module>Controller.js`) — two variants

**A. VS Code / CLI**  
- **Role:** Thin entry; resolve app-layer Controller or Service from DI; expose methods that call it only. No extraction, no business logic.
- **Shape:** Factory like `createReportController(deps)` returning an object whose methods call `deps.reportService.methodName(...)` or `deps.reportController.methodName(...)`.

**B. Fastify decorator plugin**  
- **Role:** Receive the HTTP request only; decorate fastify with handler methods. Each handler: resolve app-layer `<module>Controller` from `request.diScope`, call `appController.methodName(request)`, return result, map errors to `fastify.httpErrors`. Do not put extraction or service calls here—that is in the app-layer Controller.
- **Structure:** `'use strict';` and `const fp = require('fastify-plugin');` then `module.exports = fp(async function <module>Controller(fastify, options) { ... });` with one `fastify.decorate('<methodName>', async (request, reply) => { ... })` per operation. Inside each handler: `const c = await request.diScope.resolve('<module>Controller'); return c.methodName(request);` (with try/catch and fastify.httpErrors). Extraction of params/query/body belongs in app layer.
- **Minimal Fastify decorator template (input layer):** Use `fp(async function <module>Controller(fastify, options) { ... })` and inside use `fastify.decorate('methodName', async (request, reply) => { const c = await request.diScope.resolve('<module>Controller'); if (!c) throw new Error('...'); return c.methodName(request); });` with try/catch and `fastify.httpErrors.internalServerError(...)`. The app-layer Controller (in app/, e.g. app/gitController.js) receives the request and does extraction (params, query, body, user, correlationId) and calls the Service.

### 2. EventListener / PubsubListener (`<module>EventListener.js`, `<module>PubsubListener.js`)

- **Role:** Subscribe to framework or message-bus events; call `<module>Service` methods only; map errors to logging or response. No business logic.
- **Shape:** Register listeners (e.g. `vscode.onDid...`, or pub/sub subscribe); in each handler, resolve service from DI/context and call one service method. No domain or infra imports.

### 3. Router — Fastify HTTP (`<module>Router.js`)

- **Use only when** the target is an **HTTP app (Fastify)**. Do **not** create this file for a VS Code extension.
- **Role:** Register HTTP routes and request/response schemas only. Handlers live on the fastify instance (e.g. `fastify.respondToPrompt`, `fastify.processPushedRepo`); they are wired in composition to the app service. The router file contains **no business logic** and **no direct service calls**—only `fastify.route({ ... })` and schema.
- **Structure (build exactly like this):**
  - `'use strict';`
  - `const fp = require('fastify-plugin');`
  - `module.exports = fp(async function <module>Router(fastify, opts) { ... });`
  - Inside the plugin function: one `fastify.route({ ... })` per endpoint.
  - Each route must have:
    - `method`: `'GET'`, `'POST'`, etc.
    - `url`: path string (e.g. `'/respond'`, `'/search/text'`).
    - `preValidation`: optional array (e.g. `[fastify.verifyToken]`).
    - `handler`: **must** be a reference to a handler attached to fastify, e.g. `fastify.respondToPrompt`, `fastify.searchText`—**not** an inline function. The actual service call is implemented where the app is wired (composition), which decorates fastify with these handler names.
    - `schema`: object with `tags` (array), and for request/response:
      - **POST:** `body`: JSON Schema object (`type: 'object'`, `required`, `properties`, `additionalProperties`).
      - **GET:** `querystring`: JSON Schema object.
      - **Response:** `response: { 200: { type: 'object', properties: {...}, required: [...], additionalProperties: true|false } }`.
  - No `require()` of the app service or domain inside the router file. Handlers are provided by the host app that registers the plugin.
- **Interaction:** Composition (e.g. app entry or composition root) must (1) create the app service and adapters, (2) decorate fastify with handler functions that call the service (e.g. `fastify.decorate('respondToPrompt', async (req, reply) => { ... await aiService.respond(...); })`), (3) register the router plugin. The router only declares routes and schemas; it does not import the module’s service or domain.

**Minimal Router template (Fastify):** Use file name `<module>Router.js` (e.g. `aiRouter.js`) and function name `<module>Router` in camelCase (e.g. `aiRouter`). Replace placeholders in the snippet accordingly.

```js
// e.g. aiRouter.js — use only for Fastify/HTTP apps
'use strict';
const fp = require('fastify-plugin');

module.exports = fp(async function aiRouter(fastify, opts) {
  fastify.route({
    method: 'POST',
    url: '/example',
    preValidation: [fastify.verifyToken],
    handler: fastify.handleExample,
    schema: {
      tags: ['ai'],
      body: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', minLength: 1 } },
        additionalProperties: false
      },
      response: {
        200: {
          type: 'object',
          properties: { result: { type: 'string' } },
          required: ['result'],
          additionalProperties: false
        }
      }
    }
  });
});
```

- **Naming:** File name `<module>Router.js` (camelCase), e.g. `aiRouter.js`, `reportRouter.js`. Plugin function name = same, e.g. `aiRouter`.

---

## App layer: Controller (extract data, call service)

The Controller in the **app** layer (file: app/ and named like gitController.js) has the role: accept the initial message or request, extract important data, and call the appropriate Service. It does not live in the input layer.

- **When to add:** Use when the input layer delegates with the raw request (e.g. Fastify handlers resolve this from DI and pass the request). Optional if input calls the Service directly.
- **Responsibility:** Receive a request object; read params, query, body, headers (e.g. user id, correlation id); normalize and validate; call the module Service with extracted data; return the result. No HTTP or framework APIs.
- **Imports:** App Controller imports and uses the module Service only. No fastify, no reply, no domain ports.
- **Shape:** Class or factory that receives the Service in the constructor; methods like fetchRepo(request) that extract and call this.gitService.fetchRepo(...).
- **Naming:** app/ plus module name plus Controller.js (e.g. app/gitController.js). Input layer delegates to this.

---

## Workflow

### 1. New module — create layout

- Create `business_modules/<moduleName>/` following the **module structure schema** above:
  - `input/` — at least one of: `<module>Controller.js`, `<module>EventListener.js`, or `<module>PubsubListener.js`. Receive only; resolve app Controller or Service from DI and delegate. No extraction or business logic in input.
  - `app/` — at least `<module>Service.js`. Optionally `<module>Controller.js` to accept request/message, extract data, and call Service. Service receives port implementations via constructor; orchestrates domain and ports only.
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

**After running `npm run validate:module -- --module=<moduleName>`**, paste into your response:
- The exact command you ran
- The exit code (0 = pass, non-zero = fail)
- The last ~20 lines of the command output

Agents must not claim "validator passed" without showing this output; requiring the paste makes bypassing the gate much harder.

### 6. Verification checklist (before marking done)

- [ ] All four layer directories exist (for a new module) or new files are in the correct layer (for an extension).
- [ ] Layout and naming follow the **module structure schema** in this skill (directory tree, per-layer contract, naming rules, dependency flow).
- [ ] Input only receives and delegates (resolve app Controller or Service from DI; no extraction in input); app Controller (if present) extracts data and calls Service; app Service receives ports via constructor; domain has no app/infra imports; adapters extend domain ports.
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
 Rules, DDD/Hexagonal)
- Rationale: `docs/ARCHITECTURE-COMPARISON.md`, `docs/APP-DIRECTORY-ORGANIZATION-RATIONALE.md`
ayer contract, naming rules, dependency flow).
- [ ] Input only receives and delegates (resolve app Controller or Service from DI; no extraction in input); app Controller (if present) extracts data and calls Service; app Service receives ports via constructor; domain has no app/infra imports; adapters extend domain ports.
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
d`, `docs/APP-DIRECTORY-ORGANIZATION-RATIONALE.md`
 Rules, DDD/Hexagonal)
- Rationale: `docs/ARCHITECTURE-COMPARISON.md`, `docs/APP-DIRECTORY-ORGANIZATION-RATIONALE.md`
ayer contract, naming rules, dependency flow).
- [ ] Input only receives and delegates (resolve app Controller or Service from DI; no extraction in input); app Controller (if present) extracts data and calls Service; app Service receives ports via constructor; domain has no app/infra imports; adapters extend domain ports.
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
