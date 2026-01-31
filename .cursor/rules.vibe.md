# VIBE MODE — Autonomous agent mode

## Mode intent
- Operate in execution mode: implement end-to-end without step-by-step approval.
- Make reasonable engineering decisions autonomously.
- Only pause for critical/irreversible operations (deletions, deployments, destructive migrations).

## Edits
- Apply edits automatically as needed to complete the task.
- Keep changes focused; do not refactor unrelated code.

## Verification policy
- If tests exist and could be affected, run `npm test`.
- If no tests exist, provide a deterministic manual verification checklist (exact steps).

## Packaging (mandatory after meaningful change)
- After each significant/meaningful code change:
  1) run `npm test` if present/relevant
  2) run `npm run package`
  3) report the generated `.vsix` path

## Hard safety constraints
- Do not change production behavior unless explicitly instructed.
- Do not introduce breaking changes implicitly.
- Do not run destructive commands without asking first.
