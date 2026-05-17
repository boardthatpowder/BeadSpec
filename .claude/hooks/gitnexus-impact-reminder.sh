#!/bin/bash
# PreToolUse(Write|Edit): Enforce gitnexus impact analysis before editing code files.
# Emits permissionDecision=ask unless a fresh impact-ack marker exists (written by
# the gitnexus-impact-ack.sh PostToolUse hook when mcp__gitnexus__impact is called).
# Marker expires after 5 minutes to ensure analysis stays current per edit session.

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)
[ "$TOOL" = "Write" ] || [ "$TOOL" = "Edit" ] || exit 0

# Skip non-code files (docs, configs, lockfiles, images, stylesheets, markup).
# Shell scripts (.sh, .bash, .zsh) are intentionally NOT skipped — this repo's hooks
# and openspec-beads helpers are first-class shell code that benefits from impact analysis.
# File matching is lower-cased so .PNG/.MD/.JSON behave the same as their lower-case forms.
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
FILE_LC=$(printf '%s' "$FILE" | tr '[:upper:]' '[:lower:]')
case "$FILE_LC" in
  *.md|*.json|*.toml|*.yaml|*.yml|*.txt|*.lock|*.lockb|*.png|*.jpg|*.jpeg|*.gif|*.svg|*.ico) exit 0 ;;
  *.css|*.scss|*.html|*.htm) exit 0 ;;
esac

ACK_MARKER="${CLAUDE_PROJECT_DIR:-$PWD}/.claude/cache/gitnexus-impact-ack"

# Pass through if a fresh ack marker exists (mtime < 5 min — matches the user-facing message)
if [ -f "$ACK_MARKER" ]; then
  if [ -n "$(find "$ACK_MARKER" -mmin -5 -type f 2>/dev/null)" ]; then
    exit 0
  fi
fi

# No fresh ack — require explicit acknowledgement before proceeding
printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"CLAUDE.md MUST: call mcp__gitnexus__impact({target: \"<symbol>\", direction: \"upstream\"}) before editing. Report blast radius. Halt if HIGH/CRITICAL risk. (An impact call in this session refreshes the check for 5 min.)"}}\n'
exit 0
