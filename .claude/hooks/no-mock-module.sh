#!/bin/bash
# PreToolUse hook: Blocks Write/Edit that introduce Bun's module-stubbing API.
# The recommended pattern is dependency injection — pass mocks via a deps/options parameter
# rather than stubbing modules at the import level.
#
# STACK: Bun test runner
# Delete this hook (and remove it from .claude/settings.json) if your project doesn't use Bun.
# See README.md "Quality Hook Customization" for the wiring snippet.

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name')

if [ "$TOOL" = "Write" ]; then
  CONTENT=$(echo "$INPUT" | jq -r '.tool_input.content // empty')
elif [ "$TOOL" = "Edit" ]; then
  CONTENT=$(echo "$INPUT" | jq -r '.tool_input.new_string // empty')
else
  exit 0
fi

BANNED_PATTERN='mock'"."'module('
if echo "$CONTENT" | grep -qF "$BANNED_PATTERN"; then
  cat >&2 <<'EOF'
BLOCKED: Bun module-stubbing is banned in this codebase. Use dependency injection instead.
Preferred pattern: inject mocks via a deps/options parameter rather than stubbing modules.
Update CLAUDE.md with your project's specific DI pattern.
EOF
  exit 2
fi

exit 0
