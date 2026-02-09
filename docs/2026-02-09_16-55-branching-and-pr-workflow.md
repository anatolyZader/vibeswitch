# Branching and PR Workflow

Summary of the branching and PR workflow for VibeSwitch: main = production, dev = integration, all changes via PRs. Full detail is in the plan in `plans/`.

## Branch model

- **main** — Production; only updated via merged PRs. Always releasable.
- **dev** — Default merge target for your and agents' PRs. Merge dev → main only when you release (version bump, changelog, publish).
- **Feature/agent branches** — Short-lived (hours to 1–2 days). Always open a PR; never push directly to `dev` or `main`.

## Solo workflow

1. From `dev`: `git checkout dev && git pull && git checkout -b feat/scope/short-desc` (or `fix/`, `chore/`, `agent/name/...`).
2. Work and commit on the branch. Run `npm run test:mvp` locally.
3. Push and open PR into **dev** (or **main** for hotfix): `git push -u origin <branch>`, then GitHub "Compare & pull request" → base `dev`.
4. Ensure CI green, run your review checklist, squash merge, delete branch.
5. Release: when ready for production, open a PR **dev → main**, merge, tag, publish.

## Branch naming

Format: `<type>/<scope>/<short-kebab-desc>`. Types: feat | fix | refactor | chore | docs | test | perf | ci | build. Scopes: extension/<area>, bm/<module>/<layer>, ccm/<module>/<layer>, infra/ci, docs/architecture, deps/npm. Agent branches: `agent/<agentName>/<type>/<scope>/<short-desc>`. Keep under ~80 chars.

## PR rules

- Default ≤ 300 lines changed; split by concern if bigger.
- Use the PR template (Summary, Context, Changes, Scope, Boundaries, Tests, Risk, Notes; Agent metadata for agent PRs).
- Squash merge with a Conventional Commit–style title (e.g. `feat(extension): add webview`).

## Agents

- Agents work on their own branch and open PRs; they never merge. Only you merge.
- Use two identities: your account for merges; bot/GitHub App for agent PRs.
- In DEV: you create branch, PR + CI required, merge after your review. In VIBE: still branch-based; draft PRs OK; you mark Ready for review. Never push to main from agents.

## GitHub setup (do once in GitHub UI)

1. **Default branch:** Settings → Branches → Default branch → `main` (if not already).
2. **Protect main:** Settings → Branches → Add rule for `main`:
   - Require a pull request before merging (at least 1).
   - Require status checks to pass (e.g. "test" from the PR tests workflow).
   - Do not allow force-push. Restrict direct push so all changes go via PR.
3. **Optional:** Protect `dev` the same way (require PR; optional status checks).
4. **Repo options:** Enable "Automatically delete head branches" after merge. Use Squash merge as default.
5. **One-time migration:** See [Add main branch (one-time)](#add-main-branch-one-time) below.

## Add main branch (one-time)

If `main` does not exist yet, create it from your local repo (recommended, fastest):

```bash
# From your current branch (e.g. dev), create main and push it
git checkout -b main
git push -u origin main
```

Then on GitHub: **Settings → General → Default branch** → switch to **main**. Add branch protection for `main` (require PR, require status checks, no force-push). If you use `dev` for integration, keep working on `dev` and merge dev → main when you release.

If `main` already exists but is behind: open a PR **dev → main** to catch up, then protect both branches.

## Step-by-step: create and push a feature branch

From your local repo:

```bash
# Make sure you're up to date (use main or dev as your base)
git checkout main
git pull origin main

# Create and switch to a new branch
git checkout -b feat/extension/webview-dashboard

# Verify
git branch

# Push it to GitHub
git push -u origin feat/extension/webview-dashboard
```

Then on GitHub: open **Compare & pull request** (base: `dev` for normal work, or `main` for hotfix), fill the PR template, and merge after CI passes and review.

## CI

The repo has `.github/workflows/pr-tests.yml`: on pull_request and push to `main` and `dev`, it runs `npm ci`, `npm run lint`, `npm run test:mvp`. Require this workflow (e.g. job name "test") in branch protection for `main`.

## Cursor rules

See `.cursor/rules.common.md` for the Git and PR section: always work on a branch; never push to `dev` or `main`; remind the user to push branch and open a PR after changes.

## Release

See [Pre-publish checklist](PRE-PUBLISH-CHECKLIST.md) in this folder for packaging and publish steps. Merge dev → main, then tag version and publish extension/dashboard as needed.
