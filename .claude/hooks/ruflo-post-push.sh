#!/bin/bash
# PostToolUse: Train ruflo neural patterns after a successful git push.
# Runs in the background — never blocks the push result.

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name')
[ "$TOOL" = "Bash" ] || exit 0

COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
echo "$COMMAND" | grep -q "git push" || exit 0

# Throttle: skip if trained within the last hour (cross-platform mtime: BSD -f %m, GNU -c %Y)
LAST_TRAIN=~/.claude/ruflo/.last-train
if [ -f "$LAST_TRAIN" ]; then
  MTIME=$(stat -f %m "$LAST_TRAIN" 2>/dev/null || stat -c %Y "$LAST_TRAIN" 2>/dev/null || echo 0)
  if [ "$(( $(date +%s) - MTIME ))" -lt 3600 ]; then
    exit 0
  fi
fi

# Background train — takes a few seconds, doesn't need to block.
# Throttle marker is bumped only on success so a failed train doesn't suppress retries.
(ruflo neural train 2>/dev/null \
  && touch "$LAST_TRAIN" 2>/dev/null \
  && echo "[ruflo] neural patterns updated" >&2) &
disown $! 2>/dev/null

exit 0
