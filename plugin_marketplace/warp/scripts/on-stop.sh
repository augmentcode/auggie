#!/bin/bash
# Hook script for Auggie Stop event
# Sends a structured Warp notification when Auggie completes a task

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "$SCRIPT_DIR/should-use-structured.sh"

# Legacy fallback for old Warp versions
if ! should_use_structured; then
    [ "$TERM_PROGRAM" = "WarpTerminal" ] && exec "$SCRIPT_DIR/legacy/on-stop.sh"
    exit 0
fi

source "$SCRIPT_DIR/build-payload.sh"

# Read hook input from stdin
INPUT=$(cat)

QUERY=$(echo "$INPUT" | jq -r '._exchange.exchange.request_message // ""' 2>/dev/null)
RESPONSE=$(echo "$INPUT" | jq -r '._exchange.exchange.response_text // ""' 2>/dev/null)

# Truncate for notification display
if [ -n "$QUERY" ] && [ ${#QUERY} -gt 200 ]; then
    QUERY="${QUERY:0:197}..."
fi
if [ -n "$RESPONSE" ] && [ ${#RESPONSE} -gt 200 ]; then
    RESPONSE="${RESPONSE:0:197}..."
fi

BODY=$(build_payload "$INPUT" "stop" \
    --arg query "$QUERY" \
    --arg response "$RESPONSE")
"$SCRIPT_DIR/warp-notify.sh" "warp://cli-agent" "$BODY"
