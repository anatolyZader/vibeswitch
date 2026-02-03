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

## Documentation management
- **All markdown documentation files MUST be placed in `/docs` directory** - When creating any new markdown files (documentation, explanations, changelogs, architecture notes, etc.), they must be created in the `/docs` folder at the project root. Create `/docs` if it doesn't exist. No markdown documentation files in root or other directories.
- **ALWAYS use timestamp prefix for markdown files in `/docs`** - When creating markdown files in `/docs`, ALWAYS prefix the filename with timestamp in format `YYYY-MM-DD_HH-MM-filename.md` (e.g., `2026-01-19_14-30-awareness-score-review.md`). Use `scripts/create-md.js` or `npm run create-md "filename"` or manually generate the timestamp prefix. This ensures chronological sorting and prevents naming conflicts.
- **UPDATE timestamp prefix when modifying markdown files in `/docs`** - When updating an existing markdown file in `/docs`, ALWAYS rename it with a new timestamp prefix to reflect the update time (same format). Use the script or manual prefix. Old file can be kept for history or deleted.

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
