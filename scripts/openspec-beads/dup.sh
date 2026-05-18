#!/usr/bin/env bash
# scripts/openspec-beads/dup.sh
# Duplicate detection helper for the openspec-beads skill suite.
# Source this file; do not execute it directly.
#
# Exports:
#   obws_find_dups <title>   check for near-duplicate open issues before creating
#
# OBWS_DUP_METHOD: "mechanical" (default) or "ai" (requires ANTHROPIC_API_KEY).
#   mechanical — fast bd search on title text
#   ai         — bd find-duplicates --method ai (semantic; uses Claude API)

# Check for open issues with titles similar to the proposed title.
# Prints matching issues one per line: "  <id>: <title>"
# Returns 0 always (caller decides whether to gate on duplicates).
# Usage: obws_find_dups "<proposed title>"
obws_find_dups() {
  local title="$1"
  if [ -z "$title" ]; then
    echo "[obws] ERROR: obws_find_dups requires a title string" >&2
    return 1
  fi

  if ! command -v jq > /dev/null 2>&1; then
    echo "[obws] WARN: jq not available; skipping duplicate check" >&2
    return 0
  fi

  local method="${OBWS_DUP_METHOD:-mechanical}"

  if [ "$method" = "ai" ]; then
    if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
      echo "[obws] WARN: OBWS_DUP_METHOD=ai but ANTHROPIC_API_KEY is unset; falling back to mechanical." >&2
      method="mechanical"
    else
      # AI-powered semantic duplicate detection.
      # bd find-duplicates --method ai finds globally similar pairs among existing issues.
      # We surface pairs where either side's title shares keywords with the proposed title.
      local keywords
      # `\{0,3\}` is POSIX BRE (works on both macOS BSD grep and GNU grep).
      # `\{,3\}` is a GNU grep extension that fails on some macOS /usr/bin/grep versions.
      keywords=$(printf '%s' "$title" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '\n' \
        | grep -v '^.\{0,3\}$' | sort -u | tr '\n' '|' | sed 's/|$//')

      if [ -n "$keywords" ]; then
        local dup_out
        dup_out=$(bd find-duplicates --method ai --status open --json --limit 20 2>/dev/null || true)
        if [ -n "$dup_out" ]; then
          # pairs[].a and pairs[].b each have .id and .title
          local hits
          hits=$(printf '%s' "$dup_out" | \
            jq -r '.pairs[]? | (.a, .b) | "\(.id): \(.title)"' 2>/dev/null | \
            grep -iE "$keywords" | sed 's/^/  /' | sort -u)
          if [ -n "$hits" ]; then
            printf '%s\n' "$hits"
            return 0
          fi
        fi
      fi
      echo "[obws] WARN: AI duplicate check returned no matches; falling back to mechanical." >&2
      method="mechanical"
    fi
  fi

  # mechanical (default): fast text search on title
  bd search "$title" --status open --json --limit 5 2>/dev/null | \
    jq -r '.[]? | "  \(.id): \(.title)"' \
    2>/dev/null || true
}
