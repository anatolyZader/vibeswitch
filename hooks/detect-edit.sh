#!/bin/bash
set -euo pipefail
IFS=$'\n\t'

INPUT=$(cat)

if ! command -v jq >/dev/null 2>&1; then
  MODE="dev"
  FILE="UNKNOWN"
else
  MODE_FILE="$HOME/.vibeswitch/state/mode.json"
  MODE=$(jq -r '.mode // "dev"' "$MODE_FILE" 2>/dev/null || echo "dev")
  FILE=$(echo "$INPUT" | jq -r '.file_path // ""')
  [ -z "$FILE" ] && FILE="UNKNOWN"
fi

if [ "$MODE" = "dev" ]; then
  TS=$(date -Iseconds)
  ALERT="$HOME/.vibeswitch/state/alert.json"
  echo "{\"file\":\"$FILE\",\"ts\":\"$TS\"}" > "$ALERT"
  AUDIT="$HOME/.vibeswitch/state/audit.log"
  echo "{\"ts\":\"$TS\",\"action\":\"UNAPPROVED_EDIT\",\"file\":\"$FILE\"}" >> "$AUDIT"
fi

echo '{}'
exit 0
