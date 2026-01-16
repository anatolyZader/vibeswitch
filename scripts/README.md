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
