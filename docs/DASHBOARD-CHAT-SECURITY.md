# Dashboard Chat Security Model

Dashboard chat is designed with **technical enforcement**, not just prompt-based rules.

## Enforcement Layers

| Layer | Type | Description |
|-------|------|-------------|
| 1 | Prompt | System prompt guides read-only behavior |
| 2 | Tool whitelist | Only `create_insight` is allowed; all others rejected in code |
| 3 | Input validation | Filename, path, and content validated before execution |
| 4 | Path restriction | Writes only to `business_modules/dashboard-chat/insights/` |
| 5 | Content validation | Blocks malicious patterns (script, eval, etc.) |
| 6 | Response scanning | Output content scanned for unsafe patterns |

## What Is Prevented

- Editing source code
- Running commands or scripts
- Accessing files outside insights directory
- Path traversal (`../`, etc.)
- Overwriting existing files
- XSS/injection in response content

## Attack Scenarios

| Attack | Mitigation |
|--------|------------|
| Jailbreak prompt | Tool whitelist – no Write/Shell tools exist |
| Path traversal | Filename regex + path.join() normalization |
| Malicious content | Pattern detection in content validation |
| Unauthorized tools | OperationValidator blocks non-create_insight |

## Security Report

Call `OperationValidator.getSecurityReport()` for a full report of enforcement mechanisms.
