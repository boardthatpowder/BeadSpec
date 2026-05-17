#!/usr/bin/env sh
# scripts/openspec-beads/dup.sh
# Duplicate detection helper for the openspec-beads skill suite.
# Source this file; do not execute it directly.
#
# Exports:
#   obws_find_dups <title>   check for near-duplicate open issues before creating
#
# Environment:
#   OBWS_DUP_METHOD   "mechanical" (default, fast) | "ai" (semantic, requires ANTHROPIC_API_KEY)

# Check for near-duplicate open issues matching the given title.
# Prints matching pairs one per line: "<id-a> / <id-b>: <title-a> [score:<n>]"
# Returns 0 always (caller decides whether to gate on duplicates).
# Usage: obws_find_dups "<proposed title>"
obws_find_dups() {
  local title="$1"
  if [ -z "$title" ]; then
    echo "[obws] ERROR: obws_find_dups requires a title string" >&2
    return 1
  fi

  local method="${OBWS_DUP_METHOD:-mechanical}"

  if ! command -v jq > /dev/null 2>&1; then
    echo "[obws] WARN: jq not available; skipping duplicate check" >&2
    return 0
  fi

  if [ "$method" = "ai" ]; then
    if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
      echo "[obws] WARN: OBWS_DUP_METHOD=ai requires ANTHROPIC_API_KEY; falling back to mechanical" >&2
      method="mechanical"
    else
      echo "[obws] Running AI-based semantic duplicate detection (costs tokens)..." >&2
    fi
  fi

  bd find-duplicates --status open \
    --method "$method" \
    --threshold 0.45 \
    --json \
    --limit 5 2>/dev/null | \
    jq -r '.pairs[]? |
      "  \(.issue_a_id) / \(.issue_b_id): \(.issue_a_title) [score:\(.similarity | . * 100 | round / 100)]"' \
    2>/dev/null || true
}
