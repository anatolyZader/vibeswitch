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

## Git workflow (mandatory — all modes)

### Branch policy
- **Never push directly to `main`.** All changes go through a branch + PR.
- **Never push directly to `dev`** unless explicitly instructed. Prefer PR.
- If the current branch is `main` or `dev`, **stop and create a feature branch first**.
- For agent work: open a PR, **never merge it**. Only the human merges.

### Branch naming convention
```
<type>/<scope>/<short-kebab-desc>
```
For agent-created branches:
```
agent/<agentName>/<type>/<scope>/<short-kebab-desc>
```

**Types:** `feat` | `fix` | `refactor` | `chore` | `docs` | `test` | `perf` | `ci` | `build`

**Scopes (maps to repo structure):**
- `extension/<area>` — VS Code/Cursor extension core
- `bm/<module>/<layer>` — business_modules (e.g. `bm/awareness/app`)
- `ccm/<module>/<layer>` — cross-cut-modules (e.g. `ccm/code-analysis/app`)
- `dashboard/<area>` — dashboard-app
- `infra/<area>` — CI, tooling, scripts
- `docs/<area>` — documentation

**Examples:**
- `feat/extension/webview-dashboard-tab`
- `fix/bm/awareness/app-verification-debt-filter`
- `agent/cursor/refactor/bm/awareness/app-dedupe-window`

**Rules:** keep under ~80 chars, one PR = one branch = one concern.

### Commit convention (Conventional Commits)
```
<type>(<scope>): <short description>
```
- `feat(extension): add dashboard webview shell`
- `fix(awareness): correct verification-debt filter`
- `refactor(pubsub): extract port interface`
- `chore(infra): add CI workflow`
- `test(awareness): add score monotonicity tests`

### PR rules
- PR description **must** follow the repository PR template (`.github/pull_request_template.md`).
- Include: summary, scope, boundaries, tests, risk, rollback.
- PRs should be small and scoped: **≤ 300 lines changed** as default. If bigger, split by concern.
- If asked to "just push to main", **refuse** and propose the PR flow instead.

### Agent-specific PR rules
- Use the agent PR template (`.github/PULL_REQUEST_TEMPLATE/agent.md`).
- Label agent PRs with: `agent`, appropriate `risk-*`, and `scope:*` labels.
- No cross-module imports unless explicitly allowed.
- No dependency additions without a rationale section.
- No large refactors mixed with features.
- Require a "Why this design" paragraph.
- Require an executable test plan.

### Review checklist (before merge)
- [ ] Architecture: boundaries respected, no new coupling introduced casually
- [ ] Correctness: tests added/updated, edge cases considered
- [ ] Observability: logs/events meaningful (especially for agent changes)
- [ ] Security: no secrets, dependencies justified
- [ ] Maintainability: naming consistent, docs updated if behavior changed

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
