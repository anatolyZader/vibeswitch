# Research: Why "Blocked: shell operators" appears in VIBE mode

## Summary

The block happens **before** the hook ever looks at the mode. In VIBE mode the mode branch would allow the command, but the command is rejected by `has_dangerous_chars()` first, so the VIBE branch is never reached.

## Hook flow (gate-shell.sh)

```
1. Read stdin → INPUT (JSON)
2. COMMAND = jq -r '.command' from INPUT
3. MODE = jq -r '.mode' from ~/.vibeswitch/state/mode.json (default "dev")
4. if has_dangerous_chars "$COMMAND" → deny "Blocked: shell operators" and EXIT 2   ← BLOCK HAPPENS HERE
5. COMMAND_NORM = trim(COMMAND)
6. if MODE = "dev" → is_blocked / is_allowed / deny
7. if MODE = "vibe" → only catastrophic check, then allow
```

So:

- **Step 4** runs for every command, regardless of mode.
- If `has_dangerous_chars` is true, the script denies and exits; steps 6–7 (where VIBE is handled) are never run.
- So in VIBE mode you still get "Blocked: shell operators" whenever the command string triggers `has_dangerous_chars`.

## Why the agent’s command triggers has_dangerous_chars

`has_dangerous_chars` returns true if the command string matches any of:

- `$(` (subshell)
- `` ` `` (backticks)
- `;` `&` `|`
- `<` `>`
- Newline / `\r`
- **Command starts with:** `sh|bash|zsh|dash|ksh|fish|cmd|powershell` followed by `-c` or `-Command`
- **Command starts with:** `eval`

When the **agent** runs a shell command, Cursor (or the runner) often executes it via the shell, e.g.:

```text
sh -c "git commit -m \"message\""
```

So the string passed to the hook in the `.command` field may literally be:

```text
sh -c "git commit -m \"MCP servers...\""
```

That matches the pattern on line 26 of gate-shell.sh:

```bash
echo "$cmd" | grep -qiE '^(sh|bash|zsh|dash|ksh|fish|cmd|powershell)\s+(-c|-Command)' && return 0
```

So `has_dangerous_chars` returns true, and the hook denies with "Blocked: shell operators" **before** checking whether the mode is VIBE.

So:

- **Why it appears in VIBE mode:** Because the dangerous-chars check is unconditional and runs first; VIBE is only considered later, and we never get there when the command is rejected.
- **Why the agent is blocked:** The command the hook sees is likely wrapped as `sh -c "..."`, which is explicitly treated as dangerous and blocked regardless of mode.

## Recommended fix

**Option A (recommended):** Only run `has_dangerous_chars` in DEV mode. In VIBE mode, skip it and go straight to the catastrophic check, then allow.

- In DEV: keep current behavior (dangerous chars + allowlist).
- In VIBE: only block catastrophic patterns (`rm -rf /`, etc.); allow `sh -c "..."` and other “dangerous” forms the agent uses.

**Option B:** Keep a dangerous-chars check in VIBE but allow `sh -c` / `bash -c` when the inner command is considered safe (e.g. strip the wrapper and check the inner command). More complex and still mode-dependent.

**Option C:** Change how Cursor/agent invokes the shell so the hook receives the raw command (e.g. `git commit -m "..."`) instead of `sh -c "..."`. That would require Cursor/runner changes and is outside this repo.

Implementing **Option A** means: in gate-shell.sh, move the `has_dangerous_chars` check so it runs only when `MODE = "dev"` (e.g. after reading MODE, only run the dangerous-chars + deny block inside the dev branch). Then in VIBE we never run that check and only apply the catastrophic deny.
