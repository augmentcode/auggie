#!/bin/bash
# Hook script for Auggie PreToolUse event
# Detects when Auggie is waiting for user input (ask-user tool) and sends
# a "permission_request" so Warp shows the stop sign / blocked indicator.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "$SCRIPT_DIR/should-use-structured.sh"

# No legacy equivalent for this hook
if ! should_use_structured; then
    exit 0
fi

source "$SCRIPT_DIR/build-payload.sh"

# Read hook input from stdin
INPUT=$(cat)

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)

# ask-user means the agent is waiting for input (plan mode / permission).
# Send "permission_request" so Warp shows the stop sign instead of "in progress".
if [ "$TOOL_NAME" = "ask-user" ]; then
    BODY=$(build_payload "$INPUT" "permission_request" \
        --arg tool_name "$TOOL_NAME")
    "$SCRIPT_DIR/warp-notify.sh" "warp://cli-agent" "$BODY"
fi
