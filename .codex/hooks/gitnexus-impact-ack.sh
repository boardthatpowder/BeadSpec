#!/bin/bash
# PostToolUse: Write ack markers when gitnexus MCP tools are called.
# gitnexus-impact-ack  → refreshes the impact gate (5-min window; -mmin -5 in reminder)
# gitnexus-detect-ack  → refreshes the commit gate (5-min window; -mmin -5 in reminder)
# Both markers are read by gitnexus-impact-reminder.sh and gitnexus-commit-reminder.sh.

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)

CACHE_DIR="${CLAUDE_PROJECT_DIR:-$PWD}/.claude/cache"
mkdir -p "$CACHE_DIR" 2>/dev/null

case "$TOOL" in
  mcp__gitnexus__impact)
    touch "$CACHE_DIR/gitnexus-impact-ack"
    ;;
  mcp__gitnexus__detect_changes)
    touch "$CACHE_DIR/gitnexus-detect-ack"
    ;;
esac

exit 0
