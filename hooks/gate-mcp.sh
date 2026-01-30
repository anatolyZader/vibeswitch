#!/bin/bash
set -euo pipefail
IFS=$'\n\t'

deny() { echo "$1"; exit 2; }

command -v jq >/dev/null 2>&1 || deny '{"permission":"deny","user_message":"Missing jq","agent_message":"jq is required for capability gating."}'

INPUT=$(cat)
MODE_FILE="$HOME/.vibeswitch/state/mode.json"
MODE=$(jq -r '.mode // "dev"' "$MODE_FILE" 2>/dev/null || echo "dev")
MCP_SERVER_FILE="$HOME/.vibeswitch/state/mcp-server.json"
TOOL=$(echo "$INPUT" | jq -r '.tool_name // ""')
SERVER=$(echo "$INPUT" | jq -r '.command // ""')

if [ "$MODE" = "dev" ]; then
  if [ ! -f "$MCP_SERVER_FILE" ]; then
    deny '{"permission":"deny","user_message":"DEV: MCP config missing","agent_message":"DEV: mcp-server.json not found. Cannot verify server identity."}'
  fi
  EXPECTED_SERVER=$(jq -r '.serverName // ""' "$MCP_SERVER_FILE" 2>/dev/null || true)
  if [ -z "$EXPECTED_SERVER" ]; then
    deny '{"permission":"deny","user_message":"DEV: MCP config incomplete","agent_message":"DEV: mcp-server.json has no serverName configured."}'
  fi
  case "$TOOL" in
    mcp__vibeswitch__*)
      if [ "$SERVER" = "$EXPECTED_SERVER" ]; then
        echo '{"permission":"allow"}'
        exit 0
      else
        deny '{"permission":"deny","user_message":"DEV: MCP identity mismatch","agent_message":"DEV: Server identity mismatch"}'
      fi
      ;;
    *)
      deny '{"permission":"deny","user_message":"DEV: MCP blocked","agent_message":"DEV: Only vibeswitch MCP allowed"}'
      ;;
  esac
fi

echo '{"permission":"allow"}'
exit 0
