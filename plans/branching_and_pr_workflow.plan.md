# Branching and PR Workflow (Solo + LLM Agents, main = Prod)

Full plan for moving from "push everything to dev" to main-as-production with PRs. Summary and GitHub UI steps are in [docs/2026-02-09_16-55-branching-and-pr-workflow.md](../docs/2026-02-09_16-55-branching-and-pr-workflow.md).

## Goals (design principles)

1. **Protect `main`** — always releasable; no direct pushes.
2. **Make changes reviewable** — even as the only reviewer; PR is the unit of change.
3. **Make agent work auditable + reversible** — no "mystery commits"; agents propose via PRs, never merge.

## Target model (accepted)

- **main** = production. Only updated via merged PRs.
- **dev** = default merge target for your and agents' PRs. Merge dev → main only on release (version bump, changelog, publish).
- **Feature/agent branches** = short-lived. Always open a PR; never push to `dev` or `main`.

## Branch strategy

Types: `feat/`, `fix/`, `chore/`, `refactor/`, `agent/<name>/...`. Scopes: `extension/<area>`, `bm/<module>/<layer>`, `ccm/<module>/<layer>`, `infra/ci`, `docs/architecture`, `deps/npm`. Keep branches short-lived (hours to 1–2 days).

## GitHub setup (do in UI)

- Default branch: `main`. Enable "Automatically delete head branches". Use Squash merge.
- Protect `main`: require PR, require status check "test" (from pr-tests workflow), no force-push, restrict direct push.
- Optionally protect `dev` the same way.

## Solo workflow

1. From dev: create branch → work → run `npm run test:mvp` → push → open PR to **dev** (or main for hotfix).
2. CI green → review checklist → squash merge → delete branch.
3. Release: PR dev → main, then tag and publish.

## PR and CI

- PR template: `.github/pull_request_template.md` (Summary, Context, Changes, Scope, Boundaries, Tests, Risk, Notes; Agent metadata for agent PRs).
- CI: `.github/workflows/pr-tests.yml` runs on PR/push to main and dev: `npm ci`, `npm run lint`, `npm run test:mvp`. Require "test" in branch protection.

## Agents

- Agents work on their own branch, open PRs with template; **agents never merge**. Two identities: you (merges), bot (agent PRs). DEV = strict PR+CI; VIBE = draft PRs, you mark Ready for review. Never push to main from agents.

## Review checklist (section 9)

Architecture (boundaries, no casual coupling); Correctness (tests, edge cases); Observability (logs/events); Security (no secrets, deps justified); Maintainability (naming, docs).

## Agent guardrails (section 10)

No cross-module imports without allowance; no new deps without rationale; no large refactor+feature in one PR; "Why this design"; executable test plan; labels (agent, needs-review, risk-high).

## Rollout (section 11)

Week 1: protect main, PR template, CI. Week 2: bot identity, agents open PRs only. Week 3: CodeQL, release label, smoke build.

## Starting rules (section 12)

main always releasable; no direct pushes to main; every change via PR; small PRs; agents open PRs never merge; CI must pass; squash merge with Conventional Commit title.

## One-time migration

If main does not exist: create from dev, set default, add protection. If main exists but is behind: one PR dev → main, then protect both.
