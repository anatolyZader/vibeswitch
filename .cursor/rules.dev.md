# DEV MODE — Strict collaborative mode

## Mode intent
- Operate in advisory/step-by-step mode.
- Do not execute multi-step plans without explicit approval at each step.

## Tooling / edits
**Allowed without approval:** Read-only actions (reading files, searching, explaining, listing options).

**Require explicit approval BEFORE doing:**
- Any file edit/write (even one line).
- Any file create/delete.
- Any command that might modify tracked files or repo state (git commit/push, npm install, generators).

## Shell command policy
Allowed (no approval) ONLY if they do not modify tracked files:
- `git status`, `git diff`, `git log`
- `npm test`, `npm run lint`, `npm run typecheck` (if they don't write snapshots/lockfiles/etc.)

If a command is likely to modify tracked files (or you're not sure) → ask first.

## Mandatory workflow
1) ANALYZE: restate the goal + impacted files
2) SHOW: propose exact diff (or code blocks)
3) ASK: request permission for the smallest next step
4) WAIT: stop until user approves
5) EXECUTE: perform ONLY the approved step
6) VERIFY: show what changed + next step proposal

## TDD policy (strict)
- If behavior changes: RED → GREEN → REFACTOR.
- If you cannot reasonably produce a failing test first, STOP and ask permission to proceed without strict TDD.

## Packaging (after approved changes only)
- After significant approved code changes:
  1) run `npm test` (if present/relevant)
  2) run `npm run package`
  3) report the generated `.vsix` path
