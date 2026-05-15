#!/bin/bash
# PreToolUse hook: non-blocking nudge when Claude creates a new .ts source file
# under src/ without a matching test file.
# CLAUDE.md rule: TDD is non-negotiable.

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // empty')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Only fire on Write (new file). Edit of existing code isn't the trigger.
[ "$TOOL" = "Write" ] || exit 0

# Only .ts/.tsx source files
case "$FILE_PATH" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac

# Skip test files themselves, types-only files, and barrel files
case "$FILE_PATH" in
  *.test.ts|*.test.tsx|*.spec.ts|*.spec.tsx) exit 0 ;;
  *__tests__*|*__mocks__*|*test-utils*) exit 0 ;;
  *.d.ts) exit 0 ;;
  */types.ts|*/types/*|*/index.ts) exit 0 ;;
esac

# Only care about source under src/ (the React/TS frontend)
case "$FILE_PATH" in
  */src/*) ;;
  *) exit 0 ;;
esac

# Skip if the file already exists (Write can overwrite)
[ -f "$FILE_PATH" ] && exit 0

# Look for an adjacent test file in plausible locations
BASE=$(basename "$FILE_PATH" .ts)
BASE=$(basename "$BASE" .tsx)
DIR=$(dirname "$FILE_PATH")

FOUND=""
for candidate in \
  "$DIR/$BASE.test.ts" \
  "$DIR/$BASE.test.tsx" \
  "$DIR/__tests__/$BASE.test.ts" \
  "$DIR/__tests__/$BASE.test.tsx" \
  "$DIR/$BASE.unit.test.ts" \
  "$DIR/$BASE.integration.test.ts"; do
  if [ -f "$candidate" ]; then
    FOUND="$candidate"
    break
  fi
done

if [ -z "$FOUND" ]; then
  cat >&2 <<EOF
TDD nudge: creating $FILE_PATH without a matching test file.
CLAUDE.md says TDD is non-negotiable. Consider writing the test first.
(This is a warning, not a block — proceeding.)
EOF
fi

exit 0
