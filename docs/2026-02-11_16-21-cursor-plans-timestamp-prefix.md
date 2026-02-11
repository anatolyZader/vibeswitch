# Cursor Plans Timestamp Prefix

This document describes how plan files in `.cursor/plans` are named with date/time prefixes, how the rule is enforced for the AI, and how to use the tooling. The convention matches the one used for documentation in `/docs`.

---

## What It Does

- **Naming convention**: Plan files created by the AI or by hand live under `.cursor/plans`, and filenames use a timestamp prefix so they sort chronologically and avoid conflicts.
- **Format**: `YYYY-MM-DD_HH-MM-name.plan.md` (e.g. `2026-02-11_16-21-feature-task.plan.md`).
- **Rule for the AI**: When creating a new plan, the AI is instructed to use this prefix and location (via Cursor rules in `.cursor/rules.common.md`).

---

## How the Rule Reaches Cursor

The active Cursor rules are assembled from `.cursor/rules.common.md` plus the current mode file. The **Plan preservation** section in `rules.common.md` includes:

- **Create all new plans in `.cursor/plans` with timestamp prefix** — use `scripts/create-md.js "name.plan" --plans` or `npm run create-plan "name.plan"`.

So the rule is in effect in both DEV and VIBE modes.

---

## Creating a New Plan with Timestamp (Script)

Use the same script as for docs, with the `--plans` flag (or the `create-plan` npm script):

```bash
# From project root
npm run create-plan "short-plan-name.plan"

# Or with node
node scripts/create-md.js "short-plan-name.plan" --plans
```

- Creates `.cursor/plans/YYYY-MM-DD_HH-MM-short-plan-name.plan.md` with a short template (title + "Created at" time).
- Timestamp is always applied for plans; `--no-timestamp` is ignored when the target is `.cursor/plans`.

The script is the same as for docs: `scripts/create-md.js`. It is documented in `scripts/README.md`. See also `docs/2026-02-03_16-45-docs-timestamp-prefix-functionality.md` for the docs convention.

---

## Summary

| Item | Location / Command |
|------|--------------------|
| Naming format | `YYYY-MM-DD_HH-MM-name.plan.md` |
| Where the rule is defined | `.cursor/rules.common.md` → "Plan preservation" |
| Script to create timestamped plan | `npm run create-plan "name.plan"` or `node scripts/create-md.js "name.plan" --plans` |
| Script implementation | `scripts/create-md.js` |
| Script docs | `scripts/README.md` |

Created at 2026-02-11T16:21:57.933Z
