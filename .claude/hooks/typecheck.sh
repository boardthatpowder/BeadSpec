#!/bin/bash
# PreToolUse hook: Runs bun run typecheck BEFORE any git commit that touches
# TypeScript files. Blocks the commit (exit 2) if type errors exist, so the commit never lands
# with broken types. Moved from PostToolUse so exit 2 actually gates the commit.
#
# STACK: TypeScript/Bun (BeadSpec single-package — uses `bun run typecheck`)
# Delete this hook (and remove it from .claude/settings.json) if your project doesn't use TypeScript.

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name')

[ "$TOOL" = "Bash" ] || exit 0

COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

echo "$COMMAND" | grep -qE '\bgit[[:space:]]+commit\b' || exit 0

# Check staged (not yet committed) TypeScript files
CHANGED=$(git diff --name-only --cached 2>/dev/null | grep -E '\.(ts|tsx)$')
[ -n "$CHANGED" ] || exit 0

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null)}"
[ -d "$PROJECT_DIR" ] || exit 0

TS_COUNT=$(echo "$CHANGED" | wc -l | tr -d ' ')
echo "▶ Running bun run typecheck ($TS_COUNT .ts/.tsx files changed)..." >&2

(cd "$PROJECT_DIR" && bun run typecheck 2>&1)
EXIT=$?

if [ $EXIT -ne 0 ]; then
  cat >&2 <<'EOF'

TypeScript errors detected pre-commit. Fix the errors above before committing.
Common causes:
  - Missing union member in a Record type
  - Unused import after a type was removed
  - New union variant not handled by all consumers
EOF
  exit 2
fi

echo "✓ bun run typecheck clean." >&2
exit 0
