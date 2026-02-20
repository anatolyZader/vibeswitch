# Scripts Directory

Utility scripts for VibeSwitch development and maintenance.

## create-md.js

Creates markdown files with optional timestamp prefixes.

### Usage

```bash
# Basic usage (creates in docs/ directory)
npm run create-md "filename"

# Or directly
node scripts/create-md.js "filename"

# Specify directory
npm run create-md "filename" -- --dir docs
node scripts/create-md.js "filename" --dir docs

# Without timestamp prefix
npm run create-md "filename" -- --no-timestamp
node scripts/create-md.js "filename" --no-timestamp
```

### Examples

```bash
# Creates: docs/2024-12-19_14-30-design-notes.md
npm run create-md "design-notes"

# Creates: docs/2024-12-19_14-30-api-changes.md
npm run create-md "api-changes"

# Creates: docs/2024-12-19_14-30-research-alignment.md
npm run create-md "research-alignment"

# Creates: docs/meeting-notes.md (no timestamp)
npm run create-md "meeting-notes" -- --no-timestamp

# Creates: custom-dir/2024-12-19_14-30-notes.md
npm run create-md "notes" -- --dir custom-dir
```

### Why Use This?

- **Consistent naming**: All markdown files follow the same timestamp pattern
- **Chronological sorting**: Files sort naturally by creation date
- **Audit trail**: Easy to see when documentation was created
- **Deterministic**: Works the same in Cursor, terminal, CI, and other tools

### File Format

Created files include:
- Timestamp prefix: `YYYY-MM-DD_HH-MM-filename.md`
- Auto-generated title from filename
- Creation timestamp in content

Example output:
```markdown
# Design Notes

Created at 2024-12-19T14:30:00.000Z

---
```

---

## judge-spec-coverage.js

Uses an LLM (OpenAI API) to judge whether a test suite adequately covers a spec file. Run **before** starting the TDD implementation (Green) phase to catch coverage gaps.

### Usage

```bash
export OPENAI_API_KEY=your-key
npm run judge-spec-coverage -- --spec docs/specs/spec-foo.md --tests tests/path/to/foo.test.js
npm run judge-spec-coverage -- --spec docs/specs/spec-foo.md --tests tests/ --output report.md
```

### Options

| Option | Description |
|--------|-------------|
| `--spec`, `-s` | Path to the spec file (e.g. `docs/specs/spec-validateEmail.md`) |
| `--tests`, `-t` | Path to a single test file or a directory (all `*.test.js` under it are read) |
| `--suggested-cases` | Path to suggested edge/corner cases file (from `suggest-spec-cases.js`) — judge will also check coverage of these |
| `--output`, `-o` | Write the report to a file (default: stdout) |
| `--model`, `-m` | OpenAI model (default: `SPEC_LLM_MODEL` or `gpt-4o-mini`) |
| `--api-key` | OpenAI API key (default: `OPENAI_API_KEY` env) |
| `--help`, `-h` | Show help |

### Environment

- **OPENAI_API_KEY** — Required. Your OpenAI API key.
- **SPEC_LLM_MODEL** — Optional. Model name (default: `gpt-4o-mini`).

### Exit codes

- **0** — Coverage adequate; safe to proceed to implementation.
- **1** — Gaps found; report lists missing or weak coverage.
- **2** — Usage error or API failure.

---

## suggest-spec-cases.js

Uses an LLM to suggest additional **edge cases** and **corner cases** for a spec (beyond what is already listed). Output can be passed to `judge-spec-coverage` via `--suggested-cases` so the judge also checks whether tests cover these.

### Usage

```bash
export OPENAI_API_KEY=your-key
npm run suggest-spec-cases -- --spec docs/specs/spec-foo.md --output docs/specs/suggested-foo.md
npm run suggest-spec-cases -- --spec docs/specs/spec-foo.md --code lib/foo.js --output suggested.md
```

### Options

| Option | Description |
|--------|-------------|
| `--spec`, `-s` | Path to the spec file (required) |
| `--code`, `-c` | Optional path to implementation or test file (improves suggestions) |
| `--output`, `-o` | Write suggested cases to file (default: stdout) |
| `--model`, `-m` | OpenAI model (default: `SPEC_LLM_MODEL` or `gpt-4o-mini`) |
| `--api-key` | OpenAI API key (default: `OPENAI_API_KEY` env) |
| `--help`, `-h` | Show help |

### Pipeline: suggest then judge

```bash
# 1. Suggest edge/corner cases from spec (optional: add --code path/to/impl.js)
npm run suggest-spec-cases -- --spec docs/specs/spec-foo.md --output docs/specs/suggested-foo.md

# 2. Judge test coverage including suggested cases
npm run judge-spec-coverage -- --spec docs/specs/spec-foo.md --tests tests/ --suggested-cases docs/specs/suggested-foo.md --output report.md
```
