#!/bin/bash
# PreToolUse: Record edit intent in ruflo learning system (non-blocking, background).
# Feeds ruflo hooks pre-edit so pattern learning knows which files are being touched.

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

# Fire-and-forget — never blocks the edit
(ruflo hooks pre-edit -f "$FILE" 2>/dev/null) &
disown $! 2>/dev/null

exit 0
