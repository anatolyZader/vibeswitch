# COMMON RULES (apply in all modes)

## Architecture invariants
- Respect existing architectural boundaries.
- No direct imports across business modules. Inter-module comms only via explicit interfaces/messages.
- Domain must not depend on infrastructure.
- Cross-cut modules may be used, but must not leak into domain logic.

## Coding constraints
- Pure Node.js CommonJS only (`require`, `module.exports`). No TypeScript.
- Follow existing code style and conventions.
- Do not refactor unrelated code.
- Do not rename public APIs unless explicitly requested.
- Do not invent APIs/files/modules that do not exist.

## Error handling (hard rule)
- Use try/catch ONLY at system boundaries (VS Code commands/events/timers, fs/network).
- Internal logic must not use try/catch; let errors propagate to boundary handler.
- Prefer one shared boundary wrapper (e.g., `safe(label, fn, { fatal })`) over scattered try/catch.

## Validation policy
- Validate inputs at module boundaries (public methods, external events, deserialization).
- Do not re-validate down the internal call chain.

## AI marking (mandatory)
- Mark ALL AI-generated or AI-modified code with `// @ai`.
- Prefer block-level marking:
  - For new/changed blocks or functions: add `// @ai` at the start of the block.
  - For isolated single-line changes: add `// @ai` on the same line or immediately above.
- No exceptions.

## Approval levels (reference)
| Action | DEV | VIBE |
|--------|-----|------|
| Read/search | allowed | allowed |
| Edit 1 file | approval required | auto-apply |
| Edit >1 file | approval per file | auto-apply |
| Create/delete file | approval required | ask only if destructive |
| Run non-mutating commands | allowed | allowed |
| Run mutating commands | approval required | allowed |
| Package VSIX | after approval | always after change |
