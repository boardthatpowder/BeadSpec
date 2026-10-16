#!/bin/bash
# PostToolUse: Record edit outcome in ruflo learning system (non-blocking, background).
# Feeds ruflo hooks post-edit so pattern learning can correlate edits with outcomes.

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name')

case "$TOOL" in
  Edit)  FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty') ;;
  Write) FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty') ;;
  *)     exit 0 ;;
esac

[ -n "$FILE" ] || exit 0

# Guard: skip if ruflo is not installed (avoids "command not found" zombie subshell)
command -v ruflo >/dev/null 2>&1 || exit 0

# Fire-and-forget — never blocks
(ruflo hooks post-edit -f "$FILE" 2>/dev/null) &
disown $! 2>/dev/null

exit 0
