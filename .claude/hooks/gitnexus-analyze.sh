#!/bin/bash
# PostToolUse: Re-index the GitNexus knowledge graph after git push.
# Runs async (non-blocking). Skips if the index is already current.

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name')
[ "$TOOL" = "Bash" ] || exit 0

COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
echo "$COMMAND" | grep -q "git push" || exit 0

GIT_ROOT=$(git -C "${CLAUDE_PROJECT_DIR:-.}" rev-parse --show-toplevel 2>/dev/null)
[ -n "$GIT_ROOT" ] || exit 0

# Skip if already indexed at HEAD
GITNEXUS_META="$GIT_ROOT/.gitnexus/meta.json"
if [ -f "$GITNEXUS_META" ]; then
  CURRENT_HEAD=$(git -C "$GIT_ROOT" rev-parse HEAD 2>/dev/null)
  LAST_INDEXED=$(jq -r '.lastCommit // empty' "$GITNEXUS_META" 2>/dev/null)
  if [ -n "$CURRENT_HEAD" ] && [ "$CURRENT_HEAD" = "$LAST_INDEXED" ]; then
    exit 0
  fi
fi

cd "$GIT_ROOT" && npx gitnexus analyze 2>&1
echo "[gitnexus] index updated after push"
