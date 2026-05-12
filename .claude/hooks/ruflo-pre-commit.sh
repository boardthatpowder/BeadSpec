#!/bin/bash
# PreToolUse: Run ruflo diff risk assessment before git commit.
# Surfaces high-risk changes (large scope, deleted tests, security-sensitive files)
# before they're committed. Non-blocking — exits 0 even if ruflo unavailable.

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name')
[ "$TOOL" = "Bash" ] || exit 0

COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
echo "$COMMAND" | grep -q "git commit" || exit 0

echo "▶ ruflo diff risk assessment..." >&2
ruflo analyze diff --risk 2>/dev/null || true

# If an openspec change is active, validate spec delta before committing
ACTIVE=$(openspec list --format json 2>/dev/null | jq -r 'if type == "array" then .[0].id else empty end' 2>/dev/null || true)
if [ -n "$ACTIVE" ]; then
  echo "▶ openspec validate $ACTIVE..." >&2
  openspec validate "$ACTIVE" 2>/dev/null || {
    echo "✗ openspec validate failed for $ACTIVE — fix spec delta before committing" >&2
    exit 1
  }
fi

exit 0
