#!/bin/bash
# Hook script for Auggie SessionStart event
# Shows welcome message and Warp detection status

# Opt-in debug logging (set AUGGIE_WARP_DEBUG=1)
if [ -n "${AUGGIE_WARP_DEBUG:-}" ]; then
    _LOG="${AUGGIE_WARP_DEBUG_LOG:-/tmp/auggie-warp-debug.log}"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $(basename "$0") pid=$$ TERM_PROGRAM=${TERM_PROGRAM:-} WARP_PROTO=${WARP_CLI_AGENT_PROTOCOL_VERSION:-} WARP_VER=${WARP_CLIENT_VERSION:-}" >> "$_LOG"
fi

# Check if running in Warp terminal
if [ "$TERM_PROGRAM" = "WarpTerminal" ]; then
    # Running in Warp - notifications will work
    cat << 'EOF'
{
  "systemMessage": "🔔 Warp plugin active. You'll receive native Warp notifications when tasks complete or input is needed."
}
EOF
else
    exit 0
fi
