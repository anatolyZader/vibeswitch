# Docs Timestamp Prefix Functionality

This document describes how documentation files in `/docs` are named with date/time prefixes, how the rule is enforced for the AI, and how to use the tooling.

---

## What It Does

- **Naming convention**: All markdown documentation in the project lives under `/docs`, and filenames use a timestamp prefix so they sort chronologically and avoid conflicts.
- **Format**: `YYYY-MM-DD_HH-MM-filename.md` (e.g. `2026-02-03_16-45-docs-timestamp-prefix-functionality.md`).
- **Rule for the AI**: When creating or updating markdown in `/docs`, the AI is instructed to use this prefix (via Cursor rules assembled from `.cursor/rules.common.md`).

---

## How the Rule Reaches Cursor

The active Cursor rules are **assembled**, not stored in a single file:

1. **Rule assembler** (`business_modules/mode/app/ruleAssembler.js`) builds the effective rules by concatenating:
   - **Common rules**: `.cursor/rules.common.md` (applies in all modes)
   - **Mode rules**: `.cursor/rules.dev.md` (DEV) or `.cursor/rules.vibe.md` (VIBE)

2. On **mode switch**, the VibeSwitch extension writes the assembled text to `.cursor/rules.md`. Cursor uses that file as the active rules.

3. The **documentation management** section (including "ALWAYS use timestamp prefix" and "UPDATE timestamp prefix when modifying") lives in **`rules.common.md`**, so it is included in both DEV and VIBE.

If the timestamp rule ever "stops working," it usually means it was only in the legacy long `rules.md` and not in `rules.common.md`; the assembler only uses common + mode files, so the rule must be in `rules.common.md` to be in effect.

---

## Creating a New Doc with Timestamp (Script)

Use the project script so the filename gets the correct prefix and the file is created in `/docs`:

```bash
# From project root
npm run create-md "my-doc-name"
# Or with node
node scripts/create-md.js "my-doc-name" --dir docs
```

- **With timestamp** (default): creates `docs/YYYY-MM-DD_HH-MM-my-doc-name.md` and a short template (title + "Created at" time).
- **Without timestamp**: `node scripts/create-md.js "my-doc-name" --dir docs --no-timestamp` → creates `docs/my-doc-name.md`.

The script is implemented in `scripts/create-md.js` and is documented in `scripts/README.md`.

---

## When to Update the Timestamp

Per the rule in `rules.common.md`:

- **Creating** a new doc in `/docs` → always use the timestamp prefix (use the script or generate it manually).
- **Updating** an existing doc in `/docs` → rename the file with a **new** timestamp prefix to reflect the update time. The old file can be kept for history or deleted.

---

## Summary

| Item | Location / Command |
|------|--------------------|
| Naming format | `YYYY-MM-DD_HH-MM-filename.md` |
| Where the rule is defined | `.cursor/rules.common.md` → "Documentation management" |
| How it becomes active | ruleAssembler writes common + mode → `.cursor/rules.md` on mode switch |
| Script to create timestamped doc | `npm run create-md "filename"` or `node scripts/create-md.js "filename" --dir docs` |
| Script implementation | `scripts/create-md.js` |
| Script docs | `scripts/README.md` |

Created at 2026-02-03T16:45:50.511Z
