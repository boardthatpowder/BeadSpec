#!/usr/bin/env bash
# scripts/openspec-beads/branch.sh
# Resolves the integration base branch for this repository.
# Source this file; do not execute it directly.
#
# Exports:
#   obws_base_branch  -> prints the base branch name (main / master / develop / ...)

obws_base_branch() {
  # 1. Try the canonical remote HEAD pointer.
  local base
  base=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||')
  if [ -n "$base" ]; then
    printf '%s' "$base"
    return 0
  fi

  # 2. Fall back to well-known branch names in preference order.
  for candidate in main master develop; do
    if git show-ref --verify --quiet "refs/remotes/origin/${candidate}" 2>/dev/null; then
      printf '%s' "$candidate"
      return 0
    fi
    if git show-ref --verify --quiet "refs/heads/${candidate}" 2>/dev/null; then
      printf '%s' "$candidate"
      return 0
    fi
  done

  # 3. Last resort: use HEAD (detached or unknown).
  echo "[obws] WARN: could not determine base branch; defaulting to 'main'" >&2
  printf 'main'
}
