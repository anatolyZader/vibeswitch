# VibeSwitch Git Workflow

Professional git workflow for solo development with LLM agents. Three goals:

1. **Protect main** (always releasable)
2. **Make changes reviewable** (even as the only reviewer)
3. **Make agent work auditable + reversible** (no "mystery commits")

---

## Starting rules

- `main` is always releasable.
- No direct pushes to `main`.
- Every change goes through a PR.
- PRs are small and scoped (≤ 300 lines default).
- Agents may open PRs, never merge.
- CI must pass before merge.
- Squash merge with Conventional Commit title.

---

## 1. Branch model: trunk-based with short-lived branches

No GitFlow. Predictable naming + small PRs.

### Branch naming

```
<type>/<scope>/<short-kebab-desc>
```

For agent-created branches:
```
agent/<agentName>/<type>/<scope>/<short-kebab-desc>
```

### Types

| Type | When |
|------|------|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code refactoring (no behavior change) |
| `chore` | Maintenance / tooling |
| `docs` | Documentation only |
| `test` | Test additions or fixes |
| `perf` | Performance improvement |
| `ci` | CI/CD changes |
| `build` | Build system changes |

### Scopes (maps to repo structure)

| Scope | Maps to |
|-------|---------|
| `extension/<area>` | VS Code/Cursor extension core (`extension.js`, `vsCommandsFactory.js`, etc.) |
| `bm/<module>/<layer>` | `business_modules/<module>/<layer>/` |
| `ccm/<module>/<layer>` | `cross-cut-modules/<module>/<layer>/` |
| `dashboard/<area>` | `dashboard-app/` |
| `infra/<area>` | CI, tooling, scripts |
| `docs/<area>` | Documentation |
| `deps/<area>` | Dependency changes |

### Examples

| Branch | Description |
|--------|-------------|
| `feat/extension/webview-dashboard-tab` | New dashboard webview feature |
| `fix/bm/awareness/app-verification-debt-filter` | Fix in awareness module, app layer |
| `refactor/ccm/pubsub/port-adapter-split` | Refactor pubsub cross-cut module |
| `chore/infra/ci-node-cache` | CI performance improvement |
| `test/bm/awareness/app-integration-suite` | Add awareness integration tests |
| `agent/cursor/refactor/bm/awareness/app-dedupe-window` | Agent-created refactoring |
| `agent/qa/test/extension/webview-smoke` | Agent-created smoke tests |

### Rules

- Keep under ~80 chars.
- One PR = one branch = one concern.
- Keep branches short-lived: hours to 1–2 days, not weeks.

---

## 2. Commit convention: Conventional Commits

```
<type>(<scope>): <short description>

[optional body]
[optional footer]
```

### Examples

```
feat(extension): add dashboard webview shell
fix(awareness): correct verification-debt filter
refactor(pubsub): extract port interface
chore(infra): add CI workflow
test(awareness): add score monotonicity tests
docs(architecture): update module boundaries
```

### Rules

- Type and scope are required.
- Description starts lowercase, no period.
- Body explains **why**, not **what** (the diff shows what).
- Breaking changes: add `BREAKING CHANGE:` footer or `!` after type.

---

## 3. PR workflow

### PR size

- Default: **≤ 300 lines changed**.
- If bigger: split by concern (refactor PR first, feature PR second).

### PR must answer 5 questions

1. What problem does it solve?
2. What changed (high-level)?
3. How to test (exact steps / commands)?
4. Risk / rollback plan
5. Screenshots / logs (if UI)

### Templates

- Default: `.github/pull_request_template.md`
- Agent PRs: `.github/PULL_REQUEST_TEMPLATE/agent.md`

### Daily workflow

**Start work:**
1. Pull latest main: `git checkout main && git pull`
2. Create branch: `git checkout -b feat/scope/description`
3. Small commits as you go
4. Push branch: `git push -u origin feat/scope/description`
5. Open PR early (draft is fine)

**Finish:**
6. Ensure CI green
7. Do review checklist
8. Squash merge
9. Branch auto-deleted

**Hotfixes:** Still PR-based, just smaller + faster.

---

## 4. Agent operating model

### Rules for agents

- Agents **always** work on their own branch.
- Agents open PRs with structured descriptions + test evidence.
- Agents **never merge**. Only the human merges.
- Agent branches: `agent/<agentName>/<type>/<scope>/<short-desc>`

### Agent PR requirements

- No cross-module imports unless explicitly allowed.
- No dependency additions without a rationale section.
- No large refactors mixed with features.
- Require a "Why this design" paragraph.
- Require an executable test plan.
- Label: `agent`, appropriate `risk-*`, and `scope:*` labels.

### DEV vs VIBE mode mapping

| Aspect | DEV mode (strict) | VIBE mode (fast) |
|--------|-------------------|------------------|
| Branch | You create branch | You create branch |
| Implementation | Agent suggests, you approve | Agent implements autonomously |
| PR | Required, CI required | Required, draft PRs early |
| Agent iteration | One step at a time | Agents can iterate on branch |
| Merge | After your review checklist | When you convert to "Ready" |
| Push to main | **Never** | **Never** |

---

## 5. Review checklist

Before merging any PR:

- [ ] **Architecture:** boundaries respected, no new coupling introduced casually
- [ ] **Correctness:** tests added/updated, edge cases considered
- [ ] **Observability:** logs/events meaningful (especially for agent changes)
- [ ] **Security:** no secrets, dependencies justified
- [ ] **Maintainability:** naming consistent, docs updated if behavior changed

---

## 6. CI checks (minimum viable)

Every PR runs (`.github/workflows/ci.yml`):

| Check | Status |
|-------|--------|
| ESLint (lint) | ✅ Configured |
| Jest (unit tests) | ✅ Configured |
| Dashboard tests | ✅ Configured |
| Extension build | ✅ Configured |
| VSIX packaging | ✅ Configured |
| npm audit (security) | ✅ Configured |

---

## 7. Setup instructions

### First-time setup

```bash
# 1. Protect branches + configure merge settings
bash .github/setup-branch-protection.sh

# 2. Create labels
node .github/sync-labels.js

# 3. Verify at:
# https://github.com/anatolyZader/vibeswitch/settings/branches
```

### Repository settings (GitHub UI)

- **Protect main:**
  - Require PR before merge
  - Require status checks to pass (CI)
  - Require linear history
  - No force pushes

- **Enable:**
  - "Automatically delete head branches"
  - Squash merge (recommended) or rebase merge

---

## 8. Labels

Labels are defined in `.github/labels.yml`. Sync with:

```bash
node .github/sync-labels.js
```

| Category | Labels |
|----------|--------|
| Author | `agent`, `human` |
| Risk | `risk-low`, `risk-medium`, `risk-high` |
| Architecture | `boundary-change`, `new-dependency` |
| Type | `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `ci` |
| Scope | `scope:extension`, `scope:awareness`, `scope:dashboard`, `scope:mode-enforcement`, `scope:infra` |
| Review | `needs-review`, `wip` |
