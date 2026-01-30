#!/bin/bash
set -euo pipefail
IFS=$'\n\t'

deny() { echo "$1"; exit 2; }

command -v jq >/dev/null 2>&1 || deny '{"permission":"deny","user_message":"Missing jq","agent_message":"jq is required for capability gating."}'

INPUT=$(cat)
MODE_FILE="$HOME/.vibeswitch/state/mode.json"
MODE=$(jq -r '.mode // "dev"' "$MODE_FILE" 2>/dev/null || echo "dev")
COMMAND=$(echo "$INPUT" | jq -r '.command // ""')

if [ -z "$COMMAND" ]; then
  deny '{"permission":"deny","user_message":"No command","agent_message":"Shell command field missing or empty."}'
fi

has_dangerous_chars() {
  local cmd="$1"
  echo "$cmd" | grep -qE '\$\(' && return 0
  echo "$cmd" | grep -q '`' && return 0
  echo "$cmd" | grep -qE '[;&|]' && return 0
  echo "$cmd" | grep -qE '[<>]' && return 0
  [[ "$cmd" == *$'\n'* ]] && return 0
  [[ "$cmd" == *$'\r'* ]] && return 0
  echo "$cmd" | grep -qiE '^(sh|bash|zsh|dash|ksh|fish|cmd|powershell)\s+(-c|-Command)' && return 0
  echo "$cmd" | grep -qE '^\s*eval\s+' && return 0
  return 1
}

if has_dangerous_chars "$COMMAND"; then
  deny '{"permission":"deny","user_message":"Blocked: shell operators","agent_message":"Shell chaining/redirection/subshell not allowed. Plain $VAR is OK."}'
fi

COMMAND_NORM="$(printf '%s' "$COMMAND" | sed -e 's/^[[:space:]]\+//' -e 's/[[:space:]]\+$//')"

is_blocked() {
  local cmd="$1"
  echo "$cmd" | grep -qE '^npm\s+(install|i|ci|add|remove|uninstall)' && return 0
  echo "$cmd" | grep -qE '^yarn\s+(add|install|remove)' && return 0
  echo "$cmd" | grep -qE '^pnpm\s+(add|install|remove)' && return 0
  echo "$cmd" | grep -qE '^npx\s+' && ! echo "$cmd" | grep -qE '^npx\s+(--yes\s+)?vsce\s+package' && return 0
  echo "$cmd" | grep -qE '^git\s+(checkout|reset|clean|push|commit|rebase|merge|stash|cherry-pick)' && return 0
  echo "$cmd" | grep -qE '(rm\s+-rf|sudo|mkfs|dd\s+.*of=|chmod\s+777)' && return 0
  return 1
}

is_allowed() {
  local cmd="$1"
  echo "$cmd" | grep -qE '^npm\s+(test|run\s+test)(\s|$)' && return 0
  echo "$cmd" | grep -qE '^npx\s+(--yes\s+)?vsce\s+package' && return 0
  echo "$cmd" | grep -qE '^git\s+(status|log|diff|branch|show|blame|ls-files|remote)(\s|$)' && return 0
  echo "$cmd" | grep -qE '^(ls|cat|head|tail|wc|file|stat|pwd|echo|which|type)(\s|$)' && return 0
  echo "$cmd" | grep -qE '^(grep|rg|find|fd|ag)(\s|$)' && return 0
  return 1
}

if [ "$MODE" = "dev" ]; then
  is_blocked "$COMMAND_NORM" && deny '{"permission":"deny","user_message":"DEV: Blocked","agent_message":"DEV: Command blocked."}'
  is_allowed "$COMMAND_NORM" && { echo '{"permission":"allow"}'; exit 0; }
  deny '{"permission":"deny","user_message":"DEV: Not allowed","agent_message":"DEV: Not in allowlist."}'
fi

if [ "$MODE" = "vibe" ]; then
  echo "$COMMAND_NORM" | grep -qE '(rm\s+-rf\s+/|sudo\s+rm|mkfs\.)' && deny '{"permission":"deny","user_message":"Catastrophic"}'
  echo '{"permission":"allow"}'
  exit 0
fi

deny '{"permission":"deny","user_message":"Unknown mode","agent_message":"Unknown mode, defaulting to deny."}'
