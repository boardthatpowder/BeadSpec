#!/bin/bash
# PostToolUse: Train ruflo neural patterns after a successful git push.
# Runs in the background — never blocks the push result.

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name')
[ "$TOOL" = "Bash" ] || exit 0

COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
echo "$COMMAND" | grep -q "git push" || exit 0

# Background train — takes a few seconds, doesn't need to block
(ruflo neural train 2>/dev/null && echo "[ruflo] neural patterns updated" >&2) &
disown $! 2>/dev/null

exit 0
