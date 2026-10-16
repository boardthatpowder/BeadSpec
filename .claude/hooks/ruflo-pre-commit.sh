#!/bin/bash
# PreToolUse: Run ruflo diff risk assessment before git commit.
# Surfaces high-risk changes (large scope, deleted tests, security-sensitive files).
# Non-blocking for ruflo analyze; BLOCKING when an active OpenSpec change fails validate.

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name')
[ "$TOOL" = "Bash" ] || exit 0

COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
echo "$COMMAND" | grep -q "git commit" || exit 0

echo "[ruflo] diff risk assessment..." >&2
ruflo analyze diff --risk 2>/dev/null || true

# Validate ONLY the openspec changes whose artifacts are touched by this commit.
# Previous behaviour validated `openspec list --json | .changes[0]` (most-recent change),
# which would block every unrelated commit any time any in-flight draft was invalid.
command -v openspec >/dev/null 2>&1 || exit 0
[ -n "$(command -v git)" ] || exit 0

STAGED_OPENSPEC=$(git diff --cached --name-only 2>/dev/null | grep '^openspec/changes/' || true)
[ -z "$STAGED_OPENSPEC" ] && exit 0

# Extract distinct change IDs from staged openspec paths: openspec/changes/<id>/...
CHANGE_IDS=$(printf '%s\n' "$STAGED_OPENSPEC" \
  | awk -F'/' '$1=="openspec" && $2=="changes" && $3!="archive" {print $3}' \
  | sort -u)
[ -z "$CHANGE_IDS" ] && exit 0

# Escape hatch for emergencies: OPENSPEC_SKIP_VALIDATE=1 git commit ...
if [ "${OPENSPEC_SKIP_VALIDATE:-0}" = "1" ]; then
  echo "[ruflo] OPENSPEC_SKIP_VALIDATE=1 — skipping spec validation for: $CHANGE_IDS" >&2
  exit 0
fi

FAILED=""
while IFS= read -r CID; do
  [ -z "$CID" ] && continue
  echo "[ruflo] openspec validate $CID..." >&2
  if ! openspec validate "$CID" --no-interactive --strict --json >/dev/null 2>&1; then
    FAILED="$FAILED $CID"
  fi
done <<< "$CHANGE_IDS"

if [ -n "$FAILED" ]; then
  echo "[ruflo] openspec validate failed for:$FAILED" >&2
  echo "[ruflo] Fix the spec delta(s), or set OPENSPEC_SKIP_VALIDATE=1 to bypass for an emergency commit." >&2
  exit 2
fi

exit 0
