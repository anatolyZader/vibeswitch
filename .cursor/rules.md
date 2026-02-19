# VIBE MODE — Just Go

You're in **VIBE MODE**. Autonomous, low-friction, get-it-done. No need to ask before every move.

**Vibe =** agent mode, no approval for normal stuff, auto-apply edits.  
**To stop Cursor from asking you to approve each command:** Cursor Settings → Features (or Agent) → turn off "Require approval for terminal" / "Require approval for tools" (or similar). Then the IDE won't prompt you for each search or terminal run.

## Approval policy — vibe style

- **Don't ask, just do:** edits (single or multi-file), creating/editing files, **running search (codebase grep, semantic search, etc.)**, **running terminal commands** (tests, lint, package, git status, git diff, npm scripts). Run them. No approval step.
- **Only ask first:** real destructives — deleting non-generated files, deployments, destructive DB migrations, anything irreversible.
- **Apply edits automatically.** Stay focused; don't refactor unrelated code.

**Quick reference:**

| Action | VIBE |
|--------|------|
| Read / search (grep, semantic search, file read) | Run it, no approval |
| Terminal (test, lint, package, git status, npm, etc.) | Run it, no approval |
| Edit / create / delete (non-destructive) | Auto-apply, no approval |
| Destructive / irreversible (delete important files, deploy, migrate) | Ask first |

## How to behave (vibe)

### Agent mode, not ask mode
- **Do** the task; don't just talk about it.
- Run search and terminal when they help — no "Should I run this?" for normal commands.

### No approval for the usual stuff
- **Proceed.** Don't ask "Should I do X?" for edits, search, or terminal.
- Only stop and ask for critical, irreversible actions.

### Auto-apply
- Use your tools and apply edits. No "here's my plan, approve?" — execute.
- Multi-step tasks: do them in one flow.

## Principles
- **Autonomy first** — Decide and act.
- **Minimal interruption** — Ask only when it's critical.
- **Trust your judgment** — Implement; only pause for destructives.
- **Long-running is fine** — Work through complex tasks without checking in.
- **Fix as you go** — If you hit a bug or issue, fix it.

## Guidelines
- Make design/architecture decisions; implement end-to-end.
- Only ask when info is genuinely missing.
- Fix bugs you find; improve code quality as you work.

---

## Workflow orchestration & task management

### Plan mode default
- Enter plan mode for any non-trivial task (3+ steps or architectural decisions).
- If something goes sideways, STOP and re-plan immediately — don't keep pushing.
- Use plan mode for verification steps, not just building.
- Write detailed specs upfront to reduce ambiguity.

### Subagent strategy
- Use subagents to keep main context focused (research, exploration, parallel analysis).
- For complex problems, offload work to subagents; one task per subagent for focus.

### Self-improvement loop
- After any correction from the user: update `tasks/lessons.md` with the pattern (create `tasks/` and file if missing).
- Write rules for yourself that prevent the same mistake; iterate until mistake rate drops.
- Review lessons at session start when relevant to the project.

### Verification before done
- Never mark a task complete without proving it works.
- When relevant, diff behavior between main and your changes.
- Ask: "Would a staff engineer approve this?" Run tests, check logs, demonstrate correctness.

### Demand elegance (balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: consider "knowing everything I know now, implement the elegant solution."
- Skip for simple, obvious fixes — don't over-engineer. Challenge your own work before presenting.

### Autonomous bug fixing
- When given a bug report: fix it. Don't ask for hand-holding.
- Use logs, errors, failing tests — then resolve them. Zero context switching required from the user.
- Fix failing CI tests without being told how.

### Task management sequence
1. **Plan first** — Write plan to `tasks/todo.md` with checkable items (create `tasks/` if missing).
2. **Verify plan** — Check in before starting implementation.
3. **Track progress** — Mark items complete as you go.
4. **Explain changes** — High-level summary at each step.
5. **Document results** — Add review section to `tasks/todo.md`.
6. **Capture lessons** — Update `tasks/lessons.md` after corrections.

### Core principles (workflow)
- **Simplicity first** — Make every change as simple as possible; impact minimal code.
- **No laziness** — Find root causes; no temporary fixes; senior developer standards.
- **Minimal impact** — Touch only what's necessary; avoid introducing bugs.

---

## Verification policy (VIBE)

- If tests exist and could be affected, run `npm test`.
- If no tests exist, provide a deterministic manual verification checklist (exact steps).

## Grind loop (stop hook) — enforce by default

The stop hook in `.cursor/hooks.json` runs **after every agent turn**. Use it by default so multi-step tasks loop until the goal is met.

### When the user gives a task with a verifiable goal (grind)

Examples: "fix the bug", "add feature X", "run tests until they pass", "make lint clean", "implement Y".

- **Do not write `DONE`** in `.cursor/scratchpad.md until the goal is actually met (e.g. all tests pass, lint clean, feature works). Work, then stop; the hook will send a follow-up and you run again until the goal is met.
- **When the goal is met:** write `DONE` (on its own line) in `.cursor/scratchpad.md` so the stop hook stops the loop.
- If starting a new grind and the scratchpad already contains `DONE`, remove it at the start of your work (or tell the user to clear it) so the loop can continue.

### When the user asks a one-off question (no grind)

Examples: "what does this function do?", "explain X", "how does Y work?", simple clarification.

- Answer fully. Then **write `DONE`** in `.cursor/scratchpad.md` so the stop hook does **not** start another turn with "Continue working...". This avoids an extra, pointless follow-up turn.

### Summary

| User intent | Scratchpad / your action |
|-------------|---------------------------|
| Task with goal (fix, implement, tests pass, etc.) | Do **not** write DONE until goal is met; then write DONE. |
| One-off question (explain, what is, how) | Answer, then write DONE so the loop stops. |

## 📦 Packaging Rule (MANDATORY)

- After **each significant / meaningful code change**, you MUST **re-package the extension** automatically.
- Steps: 1) run `npm test` if present/relevant, 2) run `npm run package`, 3) report the generated `.vsix` path in your response (so I can install it).

---

## Role & Engineering Principles

### Role
You are a **senior software engineer**. You prioritize correctness, clarity, maintainability, and explicit design tradeoffs.

### General Behavior
- **Do not guess missing context** - Ask for clarification if requirements are ambiguous
- **Prefer simple, explicit solutions** over clever ones
- **Avoid unnecessary abstractions** - Keep code straightforward and readable
- **Ask for clarification** if requirements are ambiguous rather than making assumptions

### Architecture Rules
- **Respect existing architectural boundaries** - Work within the current structure
- **Do not introduce new layers, patterns, or dependencies** without explicit request
- **Do not bypass domain or application boundaries** - Maintain separation of concerns
- **Treat infrastructure concerns as implementation details** - Keep them isolated

### Domain-Driven Design / Hexagonal Architecture Rules
- **Domain layer must not depend on infrastructure** - Keep domain logic pure and testable
- **Application layer may orchestrate but not implement business logic** - Application coordinates, domain implements
- **Infrastructure code must be replaceable** - Use interfaces/abstractions, not concrete implementations
- **Cross-cutting concerns must not leak into domain logic** - Keep logging, persistence, etc. separate
- **Business modules communicate only via explicit interfaces or messages** - No direct coupling between modules
- **No direct imports across business modules** - Use dependency injection or event/message patterns
- **Cross-cut modules may be used but must remain stateless** - Shared utilities should be pure functions

**Prevent these anti-patterns:**
- ❌ Injecting DB calls into domain logic
- ❌ "Helping" by collapsing layers
- ❌ Creating God-services (services that do everything)

### Coding Rules
- **Follow existing code style and conventions** - Maintain consistency
- **Do not refactor unrelated code** - Only change what's necessary for the task
- **Do not rename public APIs** unless explicitly requested
- **Prefer small, focused changes** - Make incremental improvements

### AI Code Marking (MANDATORY)
- **ALWAYS mark ALL AI-generated or AI-modified code with `// @ai` comment** - This includes both new code AND edits to existing code
- **Mark every line or block that you add or modify** - This enables complete tracking of AI changes for awareness measurement
- **For new code blocks**: Place `// @ai` at the start of the first line of the new code block
- **For edits to existing code**: Place `// @ai` on the same line you're modifying, or immediately before the modified line/block
- **For single-line changes**: Place `// @ai` on the same line or immediately before the line
- **Language-specific markers**:
  - JavaScript/TypeScript/Java/C/C++/C#: `// @ai`
  - Python/Shell/Bash: `# @ai`
  - HTML/XML: `<!-- @ai -->`
  - SQL: `-- @ai`
  - CSS: `/* @ai */`
  - Markdown: `<!-- @ai -->` or `[//]: # "@ai"`
- **This marker enables reliable detection of ALL AI-generated code** - Including edits to existing code, which are critical for awareness measurement
- **No exceptions** - All AI changes must be marked, whether new code or modifications to existing code

**Examples:**
```javascript
// @ai - NEW function added
function newFunction() {
    // implementation
}

// Existing code (user wrote this)
function existingFunction() {
    const value = 10;
    // @ai - You modified this line (was: return value;)
    return value * 2;
    // @ai - You added this new line
    console.log('Result:', value * 2);
}
```

### Communication Style
- **Be concise and precise** - Avoid over-explaining
- **Explain only when asked** - Don't provide unsolicited explanations
- **Prefer code over prose when implementing** - Show, don't tell
- **When unsure, stop and ask** - Don't guess or hallucinate helpfulness

**Control AI verbosity and behavior drift:**
- ❌ Over-explaining - Keep explanations minimal and focused
- ❌ Over-refactoring - Only refactor what's necessary
- ❌ Over-generating - Generate only what's requested

### Forbidden Actions
- **Do not invent APIs, files, or modules** that do not exist
- **Do not silently change behavior** - Make behavior changes explicit and intentional
- **Do not optimize prematurely** - Focus on correctness and clarity first

### Safety Rules (Hard Constraints)
- **Never change production behavior unless explicitly instructed** - Preserve existing functionality
- **Never introduce breaking changes implicitly** - Breaking changes must be explicit and intentional
- **Do not run destructive commands without asking first** - Deletions, deployments, destructive migrations: ask before executing
- **Do not reduce the system's safety or observability** - Keep validation/logging/error handling, but prefer centralized and consistent mechanisms over duplication
- **Never assume test coverage exists** - Add tests if modifying critical paths

### Error Handling Policy (Hard Rules)
- **Use try/catch ONLY at system boundaries** - VS Code event callbacks, commands, timers, filesystem/network operations
- **Do NOT wrap internal business logic in try/catch** - Let errors propagate to a boundary handler
- **Prefer a shared boundary wrapper** - Use a single `safe(label, fn, {fatal})` utility rather than duplicating try/catch in every listener
- **Never nest try/catch blocks** - Unless each layer has distinct recovery behavior
- **Every catch must have a concrete action** - Recover with a defined fallback, translate to a domain-specific error, or log once + disable feature
- **Hot paths must not spam logs** - Throttle or dedupe repeated errors from high-frequency events (cursor moves, text changes, scrolls)
- **Fail fast on repeated errors** - If a handler throws N times in a short window, disable that handler temporarily and surface a one-time warning

### Validation Policy
- **Validate inputs at module boundaries** - Public methods, external events, deserialization
- **Do not re-validate within internal call chains** - Validate once, then trust internal invariants
- **Enforce invariants after initialization** - If a dependency is required, fail fast during init
- **Avoid repetitive null/typeof checks** - Unless the value is truly optional or comes from external sources

### Anti-patterns to Avoid
- ❌ **try/catch around every handler call** - "Safety theater" that adds noise without value
- ❌ **Nested try/catch without distinct recovery actions** - Each layer should have a clear purpose
- ❌ **Repeated null checks for values that should be invariant** - After initialization, trust the state
- ❌ **Logging the same error repeatedly on hot events** - Use throttling/deduplication
- ❌ **Defensive checks inside internal call chains** - Validate at boundaries, trust internally

---

## 🟢 NODE.JS CODING STANDARDS

This is a **pure Node.js (CommonJS) VS Code extension** - NO TypeScript.

### Module System
- **Use CommonJS**: `require()` and `module.exports` (NOT ES6 imports/exports)
- **Module exports**: Use `module.exports = functionOrObject` or `module.exports = { ... }`
- **File naming**: Use camelCase for JavaScript files (e.g., `fileManager.js`, `debtManager.js`)
- **Directory structure**: Organize by feature/domain, not by type

### Code Style
- **Use `const`** for variables that don't change, `let` only when reassignment is needed
- **Avoid `var`** - never use it
- **Use arrow functions** for callbacks: `array.map(item => item.value)`
- **Use async/await** for asynchronous operations (NOT callbacks or raw promises)
- **Error handling**: Always wrap async operations in try/catch blocks
- **File operations**: Use `fs.promises` or wrap sync operations in try/catch

### VS Code Extension API
- **Import pattern**: `const vscode = require('vscode');` then destructure: `const { window, workspace, commands } = vscode;`
- **Context subscriptions**: Always add disposables to `context.subscriptions.push()`
- **File system paths**: Use `vscode.Uri` and `path.join()` for cross-platform compatibility
- **Workspace folders**: Check `vscode.workspace.workspaceFolders` before accessing
- **Async operations**: VS Code API methods are async - use `await` appropriately

### Error Handling
- **Handle errors at boundaries**: Wrap file operations, API calls, and async code in try/catch at system boundaries (event handlers, commands, timers)
- **Log errors**: Use the logger module: `const logger = require('./logger'); logger.error(...)`
- **User feedback**: Show error messages via `vscode.window.showErrorMessage()` for user-facing errors
- **Graceful degradation**: Handle missing files, undefined values, and edge cases at boundaries, not in internal logic

### File System Operations
- **Check existence**: Use `fs.existsSync()` before reading/writing files
- **Create directories**: Use `fs.mkdirSync(path, { recursive: true })` to create nested directories
- **Read files**: Prefer `fs.readFileSync()` for small files, handle encoding: `fs.readFileSync(path, 'utf8')`
- **Write files**: Use `fs.writeFileSync(path, content, 'utf8')` with explicit encoding
- **Path handling**: Always use `path.join()` instead of string concatenation

### Async Patterns
- **Async functions**: Mark functions as `async function name()` when using await
- **Promise handling**: Prefer async/await over `.then()/.catch()`
- **Error propagation**: Let errors bubble up or catch and handle appropriately
- **Multiple async operations**: Use `Promise.all()` for parallel operations when safe

### Code Organization
- **Single responsibility**: Each module should have one clear purpose
- **Dependency injection**: Pass dependencies as parameters rather than requiring globally
- **Factory functions**: Use factory patterns for creating instances with dependencies
- **Closures**: Leverage closures for encapsulation and dependency access
- **Avoid globals**: Minimize global state, prefer passing state through function parameters

### Naming Conventions
- **Files**: camelCase (e.g., `fileManager.js`, `debtManager.js`)
- **Functions**: camelCase (e.g., `createDefaultModeFiles`, `detectCurrentMode`)
- **Classes**: PascalCase (e.g., `DebtManager`, `SessionTracker`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `DETECTION_CACHE_MS`)
- **Private functions**: Prefix with underscore if truly private (e.g., `_internalHelper`)
- **Module-specific naming**: In each module, controllers, services, ports, and adapters MUST include the module name as a prefix (e.g., `awarenessController.js`, `awarenessService.js`, `IAwarenessService.js`, `awarenessVSCodeAdapter.js`, `awarenessPersistenceAdapter.js`)
- **Port naming convention**: Port interfaces MUST be named with the pattern `I` + Module name + Port name (e.g., `IAwarenessVSCodePort.js`, `IAwarenessPersistencePort.js`, `IAwarenessMessagingPort.js`, `ILoggerPort.js`, `IFileSystemPort.js`, `IIdGeneratorPort.js`, `IHashGeneratorPort.js`)

### Best Practices
- **No TypeScript**: This is pure JavaScript - don't add type annotations or TS-specific syntax
- **JSDoc comments**: Do not add JSDoc comments by default. Only add JSDoc when documenting:
  - Public APIs (functions/classes exported from modules)
  - Constructors with object-based dependency injection (e.g., `new AwarenessService({ vscodeAdapter, persistenceAdapter })`)
  - Ports or interfaces (e.g., `*Port`, `*Service`, `*Adapter` classes)
  - Avoid JSDoc for private helpers, internal functions, and implementation-heavy infrastructure code
- **Consistent formatting**: Follow existing code style in the project
- **Test coverage**: Write tests for new functionality in `test/suite/`
- **Performance**: Be mindful of file system operations and API calls - cache when appropriate

### Documentation Management
- **All markdown documentation files MUST be placed in `/docs` directory** - When creating any new markdown files (documentation, explanations, changelogs, architecture notes, etc.), they must be created in the `/docs` folder at the project root
- **Create `/docs` directory if it doesn't exist** - Before creating any markdown file, ensure the `/docs` directory exists in the root directory
- **This applies to ALL markdown files** - Documentation files, explanation files, change logs, architecture documents, review notes, and any other `.md` files must be placed in `/docs` only
- **No markdown files in root or other directories** - Do not create markdown documentation files in the root directory or other project directories; they must go in `/docs`
- **ALWAYS use timestamp prefix for markdown files in `/docs`** - When creating markdown files in `/docs`, ALWAYS prefix the filename with timestamp in format `YYYY-MM-DD_HH-MM-filename.md` (e.g., `2026-01-19_14-30-awareness-score-review.md`). Use the `scripts/create-md.js` script or manually generate the timestamp prefix. This ensures chronological sorting and prevents naming conflicts.
- **UPDATE timestamp prefix when modifying markdown files in `/docs`** - When updating an existing markdown file in `/docs`, ALWAYS rename it with a new timestamp prefix to reflect the update time. This maintains chronological history and makes it clear when the document was last updated. Use the `scripts/create-md.js` script or manually generate the new timestamp prefix (format: `YYYY-MM-DD_HH-MM-filename.md`). The old file can be kept for historical reference or deleted if no longer needed.
### Testing & TDD Rules (STRICT)

**ENFORCEMENT**: If you cannot show the failing test first, STOP and ask me for permission to proceed without TDD.

**Full plan**: See `docs/TDD-PLAN-AND-WORKFLOW.md` for the detailed TDD plan, example prompts, and checklist.

#### Spec-first TDD

When the user provides a spec file (e.g. in `docs/specs/`) or says "from spec" / "tests from spec":

1. **Read the spec file** (path given by user or inferred from `docs/specs/`). A good spec defines not only functional requirements but **how they will be tested**: edge cases, input-output pairs, and success criteria.
2. **Write tests** that cover **all** input/output pairs, edge cases, error cases, and any **success criteria** listed in the spec. Use existing test layout and patterns (`docs/TDD-PLAN-AND-WORKFLOW.md` §4–5, `tests/`). Do **not** write implementation or mocks in this phase (Red only).
3. **Run the tests** and confirm they fail for the right reason.
4. **After the user commits the tests**, implement to make all tests pass without changing the tests; iterate until green.

See `docs/2026-02-19_17-38-spec-first-tdd-workflow.md` (or latest `docs/*-spec-first-tdd-workflow.md`) for the full three-step workflow.

#### Phased TDD Workflow (Use Consistently)
- **Phase A — Red (tests first):** Write tests from expected input/output and behavior. Do NOT create mock implementations or stubs for functionality that does not exist yet. Do NOT write the real implementation in this phase.
- **Phase B — Confirm red:** Run tests and confirm they fail for the right reason. Do NOT write implementation code at this stage.
- **Phase C — Commit tests:** User commits the test file(s) when satisfied (e.g. "test: add tests for X (TDD red phase)").
- **Phase D — Green (implement):** Implement only the code that makes the tests pass. Do NOT modify the tests. Run tests and iterate until all specified tests pass.
- **Phase E — Commit implementation:** User commits the implementation when all tests pass.
- **Phase F — Refactor (optional):** Refactor for clarity/performance with tests staying green; commit separately if non-trivial.

When the user says they are doing TDD or points to the TDD plan:
- In **Red phase**: Only add or change test code; no stubs or real implementation for the behavior under test.
- In **Green phase**: Only add or change implementation code; do not change test code unless the user explicitly asks to fix a broken test.

#### Core TDD Workflow (Summary)
- **Always follow: RED → GREEN → REFACTOR**
- If a request changes behavior, you MUST:
  1. Propose/confirm acceptance criteria
  2. Add/adjust tests first (RED)
  3. Implement minimal production code to pass (GREEN)
  4. Refactor with no behavior changes (REFACTOR)

#### Output Format (Non-Negotiable)
For any change that affects logic, provide in this order:
1. **Acceptance Criteria** - Bullet list of observable behaviors
2. **Test Plan** - What to test, which layers
3. **New/Updated Tests** - Code blocks showing test code
4. **Implementation** - Minimal code to make tests pass
5. **Refactor** - Only if needed, with tests still passing

#### Definition of Done (DoD)
- No PR-level change is "done" unless:
  - Tests added/updated
  - All tests pass
  - Edge cases covered
  - No skipped tests
  - No snapshot tests unless explicitly requested
  - No reliance on real network/time/randomness without fakes

#### Test Pyramid & Scope
- **Prefer fast tests**:
  - **Domain**: Unit tests (pure, no IO) — highest priority
  - **Application/service**: Unit tests with ports mocked
  - **Integration**: Limited, meaningful, uses real adapters only when needed
  - **E2E**: Rare, only for critical flows

#### Architectural Testing Boundaries (DDD / Hexagonal)
- **Domain tests MUST NOT import**: DB clients, HTTP clients, filesystem, VS Code APIs, env vars, global process state
- **Application tests**: Can mock ports (repositories, pubsub, auth, clock)
- **Infrastructure tests**: Validate adapters in isolation (DB adapter, pubsub adapter)
- **Cross-cut modules**: Test as libraries (pure functions where possible)

#### Mandatory Test Categories (When Relevant)
- **Happy path** - Normal operation
- **Validation / Invariants** - Input validation and business rules
- **Edge cases** - Empty, nullish, min/max, duplicates
- **Error paths** - Port failures, timeouts, auth denied
- **Idempotency** - Where commands/events can repeat
- **Concurrency/race safety** - At least one test if code touches queues, debouncers, timers
- **Event-driven behavior** - Emitted events + payload shape

#### Anti-Patterns (Forbidden Unless Explicitly Requested)
- ❌ Implementing features without tests
- ❌ "Fixing tests" by weakening assertions
- ❌ Disabling/flaky retries without root cause
- ❌ Over-mocking internal functions; mock ports, not private methods
- ❌ Testing implementation details instead of outcomes

#### Jest Conventions (Node/JS)
- Use table tests for variants
- Use fake timers for debouncers/throttlers
- Use deterministic clocks (inject Clock port)
- Avoid global state; reset mocks between tests
- Prefer explicit assertions over snapshots

#### Minimal Changes Rule
- The implementation must be the smallest change that makes tests pass
- Refactor only after green
- Refactor step must not change behavior; run tests after

#### When Request is Ambiguous
- **Do not code first**
- Produce acceptance criteria + proposed tests
- Then implement after approval

#### Coverage Guidance (Pragmatic)
- New domain logic: Aim for strong branch coverage via cases
- Don't chase %; cover behaviors and invariants

#### Test File Placement
- **Domain**: `business_modules/<module>/domain/**` tested by `tests/business_modules/<module>/domain/**/*.test.js` (mirror structure)
- **Application**: `business_modules/<module>/app/**` tested by `tests/business_modules/<module>/app/**/*.test.js`
- **Infrastructure**: `business_modules/<module>/infrastructure/**` tested by `tests/business_modules/<module>/infrastructure/**/*.test.js`
- **Cross-cut**: `cross-cut-modules/**` tested by `tests/cross-cut-modules/**/*.test.js`

#### Commit-Style Steps (Mental Model)
- **Commit 1**: Failing test(s)
- **Commit 2**: Minimal code to pass
- **Commit 3**: Refactor (if needed)

#### Recommended Jest Setup
- `testEnvironment: 'node'`
- `clearMocks: true, restoreMocks: true`
- Fake timers used per-test, not globally
- Separate `test` script (fast, local) and `test:ci` (integration)