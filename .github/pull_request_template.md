# Summary
<!-- 2–4 sentences: what this PR does and why -->

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
- **Touched modules:** <!-- list paths, e.g. business_modules/awareness, cross-cut-modules/code-analysis -->
- **New dependencies added?** (yes/no)
  - If yes: justify + alternatives considered:
- **Cross-module calls introduced?** (yes/no)
  - If yes: explain why this does NOT violate isolation rules:
- **Events / pubsub changes?** (yes/no)
  - If yes: list event names + schema changes:

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

### Manual (if applicable)
- Steps to verify:
  1.
  2.
- Evidence:
  - [ ] screenshot(s)
  - [ ] logs / trace
  - [ ] before/after notes

## Risk assessment (required)
- Risk level: [low | medium | high]
- What can break:
- Rollback plan:
  - [ ] revert squash commit
  - [ ] toggle/flag (if exists)
  - [ ] other:

## Notes for reviewer
- Key files to review first:
  - `...`
  - `...`
- Non-obvious decisions / rationale:
- Follow-ups (explicitly out of scope):
  - [ ]
  - [ ]

---

## Agent metadata (fill ONLY for agent-created PRs)
- Agent name: <!-- e.g. architector / qa / security / cursor-agent -->
- Mode: <!-- DEV | VIBE -->
- Prompt / task summary (short):
- Assumptions made:
- Known limitations:
