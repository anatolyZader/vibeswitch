#!/bin/bash
set -euo pipefail
IFS=$'\n\t'

cat > /dev/null

# jq check (soft fail - just default to dev if missing)
if ! command -v jq >/dev/null 2>&1; then
  MODE="dev"
else
  MODE_FILE="$HOME/.vibeswitch/state/mode.json"
  MODE=$(jq -r '.mode // "dev"' "$MODE_FILE" 2>/dev/null || echo "dev")
fi

if [ "$MODE" = "dev" ]; then
  printf '{"continue":true,"additional_context":"SYSTEM: DEV MODE.\\n\\nYou CANNOT use Write/StrReplace/Edit.\\n\\nTo modify files:\\n1. Call mcp__vibeswitch__submit_patch(filePath, unifiedDiff)\\n2. Wait for user approval\\n3. Call mcp__vibeswitch__apply_patch(requestId, filePath, unifiedDiff, token)\\n\\nShell: Only npm test, git status/log/diff, read-only. No chaining/redirects."}'
else
  printf '{"continue":true,"additional_context":"VIBE MODE: Proceed autonomously. Note: shell chaining/redirects still blocked for safety."}'
fi
exit 0
