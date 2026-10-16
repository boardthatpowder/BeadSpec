#!/bin/bash
# PostToolUse: Re-index the GitNexus knowledge graph after git push.
# Fires asynchronously (backgrounded below) so it never blocks the tool call.

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

LOCK_DIR="$GIT_ROOT/.gitnexus/analyze.lock.d"

# Portable timeout shim: macOS has neither `timeout` nor `gtimeout` out of the box.
# Falls through with no timeout wrapper if neither is installed; gtimeout is provided by
# `brew install coreutils`. Documented in CLAUDE.md prerequisites.
TIMEOUT_BIN=$(command -v gtimeout 2>/dev/null || command -v timeout 2>/dev/null || echo "")
run_with_timeout() {
  local secs="$1"; shift
  if [ -n "$TIMEOUT_BIN" ]; then
    "$TIMEOUT_BIN" "$secs" "$@"
  else
    "$@"
  fi
}

(
  # Portable atomic lock via mkdir — prevents concurrent indexing on back-to-back pushes.
  if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    exit 0
  fi
  trap 'rm -rf "$LOCK_DIR"; wait' EXIT INT TERM
  cd "$GIT_ROOT" && { command -v gitnexus > /dev/null 2>&1 && run_with_timeout 300 gitnexus analyze || run_with_timeout 300 npx gitnexus analyze; } >"${TMPDIR:-/tmp}/gitnexus-$$.log" 2>&1
  echo "[gitnexus] index updated after push" >> "${TMPDIR:-/tmp}/gitnexus-$$.log"
  # Keep db readable+writable for the MCP server (macOS sandbox needs to create FTS indexes).
  # 664 (group-writable) is safer than 666 (world-writable) on multi-user hosts.
  find "$GIT_ROOT/.gitnexus" -name "*.db" -exec chmod 664 {} \; 2>/dev/null || true
) &
disown $! 2>/dev/null
