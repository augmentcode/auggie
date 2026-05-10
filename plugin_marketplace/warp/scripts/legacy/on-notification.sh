#!/bin/bash
# Hook script for Auggie Notification event
# Sends a Warp notification when Auggie needs user input

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Opt-in debug logging (set AUGGIE_WARP_DEBUG=1)
if [ -n "${AUGGIE_WARP_DEBUG:-}" ]; then
    _LOG="${AUGGIE_WARP_DEBUG_LOG:-/tmp/auggie-warp-debug.log}"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $(basename "$0") pid=$$ TERM_PROGRAM=${TERM_PROGRAM:-} WARP_PROTO=${WARP_CLI_AGENT_PROTOCOL_VERSION:-} WARP_VER=${WARP_CLIENT_VERSION:-}" >> "$_LOG"
fi

# Read hook input from stdin
INPUT=$(cat)
[ -n "${AUGGIE_WARP_DEBUG:-}" ] && echo "[stdin] $INPUT" >> "${AUGGIE_WARP_DEBUG_LOG:-/tmp/auggie-warp-debug.log}"

# Extract the notification message
MSG=$(echo "$INPUT" | jq -r '.message // "Input needed"' 2>/dev/null)
[ -z "$MSG" ] && MSG="Input needed"

"$SCRIPT_DIR/warp-notify.sh" "Auggie" "$MSG"
