#!/bin/bash
# PreToolUse hook: Blocks Write/Edit that introduce TypeScript `any` usage.
# Use specific types, generics, `unknown` with type guards, or discriminated unions instead.
#
# STACK: TypeScript
# Delete this hook (and remove it from .claude/settings.json) if your project doesn't use TypeScript.
# See README.md "Quality Hook Customization" for the wiring snippet.

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name')

if [ "$TOOL" = "Write" ]; then
  CONTENT=$(echo "$INPUT" | jq -r '.tool_input.content // empty')
  FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
elif [ "$TOOL" = "Edit" ]; then
  CONTENT=$(echo "$INPUT" | jq -r '.tool_input.new_string // empty')
  FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
else
  exit 0
fi

# Only check TypeScript/TSX files
case "$FILE_PATH" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac

# Skip test files — test factories sometimes need `as any` for partial mocks
case "$FILE_PATH" in
  *.test.ts|*.test.tsx|*.spec.ts|*.spec.tsx|*__tests__*) exit 0 ;;
esac

# Check for TypeScript `any` type patterns (avoids matching words like "company", "many").
# Strip comment lines before scanning so `// type: any` or `* @param {any}` don't false-trigger.
# Patterns: `: any`, `as any`, `<any>`, `<any,`, `any[]`, `any;`, `any)`, `any |`, `any&`
CLEAN=$(printf '%s' "$CONTENT" | sed '/^[[:space:]]*\/\//d; /^[[:space:]]*\*/d')
if printf '%s' "$CLEAN" | grep -qE ':\s*any\b|as\s+any\b|\bany\s*[\[\];\),\|&>]|\bany$|<\s*any\s*[,>]'; then
  cat >&2 <<'EOF'
BLOCKED: Use of `any` type is not allowed in non-test TypeScript files.
Instead use:
  - Specific types or interfaces
  - Generics with constraints (e.g. <T extends Record<string, unknown>>)
  - `unknown` with type guards for truly unknown data
  - Discriminated unions for polymorphic types
EOF
  exit 2
fi

exit 0
