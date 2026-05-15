#!/bin/bash
# PostToolUse hook: Runs tsc --noEmit after any git commit that touches TypeScript files.
# Catches exhaustiveness gaps, missing union members, unused imports, and other build-time
# errors that don't surface at edit time.

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name')

[ "$TOOL" = "Bash" ] || exit 0

COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

echo "$COMMAND" | grep -q "git commit" || exit 0

CHANGED=$(git diff --name-only HEAD~1 HEAD 2>/dev/null | grep -E '\.(ts|tsx)$')
[ -n "$CHANGED" ] || exit 0

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null)}"
[ -d "$PROJECT_DIR" ] || exit 0

TS_COUNT=$(echo "$CHANGED" | wc -l | tr -d ' ')
echo "▶ Running tsc --noEmit ($TS_COUNT .ts/.tsx files changed)..." >&2

cd "$PROJECT_DIR" && bun run typecheck 2>&1
EXIT=$?

if [ $EXIT -ne 0 ]; then
  cat >&2 <<'EOF'

❌ TypeScript errors detected post-commit. Fix the errors above before pushing.
Common causes:
  - Discriminated union missing a new variant
  - Unused import after a type was removed
  - Missing required prop on a component
EOF
  exit 2
fi

echo "✓ tsc clean." >&2
exit 0
