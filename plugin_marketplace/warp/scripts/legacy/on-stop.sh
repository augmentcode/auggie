#!/bin/bash
# Hook script for Auggie Stop event
# Sends a Warp notification when Auggie completes a task

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Opt-in debug logging (set AUGGIE_WARP_DEBUG=1)
if [ -n "${AUGGIE_WARP_DEBUG:-}" ]; then
    _LOG="${AUGGIE_WARP_DEBUG_LOG:-/tmp/auggie-warp-debug.log}"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $(basename "$0") pid=$$ TERM_PROGRAM=${TERM_PROGRAM:-} WARP_PROTO=${WARP_CLI_AGENT_PROTOCOL_VERSION:-} WARP_VER=${WARP_CLIENT_VERSION:-}" >> "$_LOG"
fi

# Read hook input from stdin
INPUT=$(cat)
[ -n "${AUGGIE_WARP_DEBUG:-}" ] && echo "[stdin] $INPUT" >> "${AUGGIE_WARP_DEBUG_LOG:-/tmp/auggie-warp-debug.log}"

# Extract transcript path from the hook input
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // empty' 2>/dev/null)

# Default message
MSG="Task completed"

# Try to extract prompt and response from the transcript (JSONL format)
if [ -n "$TRANSCRIPT_PATH" ] && [ -f "$TRANSCRIPT_PATH" ]; then
    # Get the first user prompt
    PROMPT=$(jq -rs '
        [.[] | select(.type == "user")] | first | .message.content // empty
    ' "$TRANSCRIPT_PATH" 2>/dev/null)
    
    # Get the last assistant response
    RESPONSE=$(jq -rs '
        [.[] | select(.type == "assistant" and .message.content)] | last |
        [.message.content[] | select(.type == "text") | .text] | join(" ")
    ' "$TRANSCRIPT_PATH" 2>/dev/null)
    
    if [ -n "$PROMPT" ] && [ -n "$RESPONSE" ]; then
        # Truncate prompt to 50 chars
        if [ ${#PROMPT} -gt 50 ]; then
            PROMPT="${PROMPT:0:47}..."
        fi
        # Truncate response to 120 chars
        if [ ${#RESPONSE} -gt 120 ]; then
            RESPONSE="${RESPONSE:0:117}..."
        fi
        MSG="\"${PROMPT}\" → ${RESPONSE}"
    elif [ -n "$RESPONSE" ]; then
        # Fallback to just response if no prompt found
        if [ ${#RESPONSE} -gt 175 ]; then
            RESPONSE="${RESPONSE:0:172}..."
        fi
        MSG="$RESPONSE"
    fi
fi

"$SCRIPT_DIR/warp-notify.sh" "Auggie" "$MSG"
