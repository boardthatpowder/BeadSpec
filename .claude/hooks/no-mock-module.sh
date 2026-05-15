#!/bin/bash
# PreToolUse hook: Blocks Write/Edit that introduce mock.module() usage.
# The codebase uses dependency injection for testability — see CLAUDE.md.

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name')

if [ "$TOOL" = "Write" ]; then
  CONTENT=$(echo "$INPUT" | jq -r '.tool_input.content // empty')
elif [ "$TOOL" = "Edit" ]; then
  CONTENT=$(echo "$INPUT" | jq -r '.tool_input.new_string // empty')
else
  exit 0
fi

if echo "$CONTENT" | grep -qF 'mock.module('; then
  cat >&2 <<'EOF'
BLOCKED: mock.module() is banned in this codebase. Use dependency injection instead.
See CLAUDE.md "Testing Pattern: Use DI, NOT mock.module" for the correct approach.
Inject mocks via a deps parameter (e.g. HandlerDeps) rather than stubbing modules.
EOF
  exit 2
fi

exit 0
