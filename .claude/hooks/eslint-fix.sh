#!/bin/bash
# PostToolUse hook: auto-fix TS/TSX/JS/JSX files with eslint after Claude writes or edits them.
# Keeps the working tree lint-clean without a separate "run lint:fix" turn.

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // empty')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

case "$TOOL" in
  Write|Edit) ;;
  *) exit 0 ;;
esac

case "$FILE_PATH" in
  *.ts|*.tsx|*.js|*.jsx) ;;
  *) exit 0 ;;
esac

[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0

bunx eslint --fix "$FILE_PATH" >/dev/null 2>&1 || true
exit 0
