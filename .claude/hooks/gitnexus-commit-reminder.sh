#!/bin/bash
# PreToolUse(Bash): Enforce gitnexus detect_changes before git commit.
# Emits permissionDecision=ask so the agent must acknowledge the rule.
# Non-blocking only when mcp__gitnexus__detect_changes was recently called this session
# (tracked via the gitnexus-detect-ack marker written by gitnexus-impact-ack.sh).

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)
[ "$TOOL" = "Bash" ] || exit 0

COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)
echo "$COMMAND" | grep -qE '\bgit[[:space:]]+commit\b' || exit 0

ACK_MARKER="${CLAUDE_PROJECT_DIR:-$PWD}/.claude/cache/gitnexus-detect-ack"

# Pass through if a fresh ack marker exists (mtime < 5 min — matches the user-facing message)
if [ -f "$ACK_MARKER" ]; then
  if [ -n "$(find "$ACK_MARKER" -mmin -5 -type f 2>/dev/null)" ]; then
    exit 0
  fi
fi

printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"CLAUDE.md MUST: call mcp__gitnexus__detect_changes() before committing to verify only expected symbols changed. (A detect_changes call refreshes the check for 5 min.)"}}\n'
exit 0
