# Agent PR: Summary
<!-- 2–4 sentences: what this PR does and why -->

## Agent metadata (required)
- **Agent name:** <!-- e.g. architector / qa / security / cursor-agent -->
- **Mode:** <!-- DEV | VIBE -->
- **Prompt / task summary:**
- **Assumptions made:**
- **Known limitations:**

## Context / Problem
<!-- Link issues, user story, or short background -->

## Changes (high level)
- [ ] 
- [ ] 
- [ ] 

## Scope (select all that apply)
- [ ] VibeSwitch extension (VS Code/Cursor)
- [ ] business_modules (isolated, event-driven)
- [ ] cross-cut-modules (cross-cutting/AOP-style)
- [ ] dashboard-app (React webview)
- [ ] infra / CI / tooling
- [ ] docs

## Boundaries & Architecture (required)
- **Touched modules:** <!-- list paths -->
- **New dependencies added?** (yes/no)
  - If yes: justify + alternatives considered:
- **Cross-module calls introduced?** (yes/no)
  - If yes: explain why this does NOT violate isolation rules:
- **Events / pubsub changes?** (yes/no)
  - If yes: list event names + schema changes:

## Why this design
<!-- Required for agent PRs: explain the design approach and alternatives considered -->

## Tests & Verification (required)
### Automated
- CI status: <!-- link / or "expected green" -->
- Added/updated tests:
  - [ ] unit
  - [ ] integration
  - [ ] e2e / @vscode/test-electron
- Command(s) run (paste exact):
  - `npm test`
  - `npm run lint`
- Test output (paste or screenshot):

### Manual (if applicable)
- Steps to verify:
  1.
  2.

## Risk assessment (required)
- Risk level: [low | medium | high]
- What can break:
- Rollback plan:
  - [ ] revert squash commit
  - [ ] toggle/flag (if exists)
  - [ ] other:

## Checklist (agent self-check)
- [ ] No cross-module imports unless explicitly allowed
- [ ] No dependency additions without rationale
- [ ] No large refactors mixed with features
- [ ] Tests added and passing
- [ ] `// @ai` markers present on all changes
- [ ] Branch follows naming convention

## Notes for human reviewer
- Key files to review first:
  - `...`
- Non-obvious decisions / rationale:
- Follow-ups (explicitly out of scope):
  - [ ]
