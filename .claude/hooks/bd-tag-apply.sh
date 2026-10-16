#!/bin/sh
# PostToolUse(Bash): Auto-apply branch/worktree/repo context labels to any Beads issue
# created via ad-hoc `bd create` or `bd q` outside the openspec-beads skill suite.
# Skills handle this themselves; this hook closes the gap for manual agent `bd create` calls.
#
# Soft-applier — NOT an enforcer. The hook idempotently calls obws_tag_context but
# never blocks if tagging fails. The 3-label invariant in CLAUDE.md remains the
# authoritative rule; this hook only reduces the chance of accidental omissions.
# Always exits 0.

INPUT=$(cat)
TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)
[ "$TOOL" = "Bash" ] || exit 0

CMD=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)
# Only run when bd create or bd q was actually called
printf '%s' "$CMD" | grep -qE '(^|;|&&|\|)[[:space:]]*bd[[:space:]]+(create|q)\b' || exit 0

OUT=$(printf '%s' "$INPUT" | jq -r '.tool_response.stdout // empty' 2>/dev/null)
[ -z "$OUT" ] && exit 0

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
INIT_SCRIPT="${REPO_ROOT}/scripts/openspec-beads/init.sh"
[ -f "$INIT_SCRIPT" ] || exit 0

# Extract issue IDs: use the first detected prefix (e.g. "bd") to anchor the pattern,
# avoiding false-positive matches on tokens like "node-v18" or "utf-8" in tool stdout.
ID_PREFIX=$(printf '%s' "$OUT" | grep -oE '\b[a-z]{2,8}-[a-z0-9]{5,}\b' | head -1 | cut -d- -f1)
if [ -n "$ID_PREFIX" ]; then
  IDS=$(printf '%s' "$OUT" | grep -oE "\b${ID_PREFIX}-[a-z0-9]{5,}\b" | sort -u)
else
  IDS=""
fi
[ -z "$IDS" ] && exit 0

# Source helpers in a subshell to avoid polluting the hook environment
(
  # shellcheck source=/dev/null
  . "$INIT_SCRIPT" 2>/dev/null || exit 0
  obws_resolve_prefix 2>/dev/null || exit 0
  for id in $IDS; do
    obws_tag_context "$id" 2>/dev/null
  done
)

exit 0
