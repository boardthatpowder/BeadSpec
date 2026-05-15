#!/usr/bin/env sh
# scripts/openspec-beads/context.sh
# Single owner of the branch/worktree/repo context-tagging contract.
# Source this file; do not execute it directly.
#
# Exports:
#   obws_resolve_prefix   -> sets OBWS_BRANCH_LABEL, OBWS_WORKTREE_LABEL, OBWS_REPO_LABEL
#   obws_tag_context <id> -> applies the three context labels (idempotent)
#   obws_tag_change <id> <change-id> -> applies openspec:<change-id> label

# Resolve RUFLO_HOME consistently with the rest of the stack.
_OBWS_RUFLO_HOME="${RUFLO_HOME:-${HOME}/.claude/ruflo}"

obws_resolve_prefix() {
  local tags_script="${_OBWS_RUFLO_HOME}/lib/tags.sh"

  if [ -f "$tags_script" ]; then
    # shellcheck source=/dev/null
    . "$tags_script"
    local prefix
    prefix=$(ruflo_key_prefix 2>/dev/null)
    if [ -z "$prefix" ]; then
      echo "[obws] WARN: ruflo_key_prefix returned empty; falling back to git-derived prefix" >&2
      prefix="$(_obws_git_prefix)"
    fi
  else
    echo "[obws] WARN: tags.sh not found at ${tags_script}; deriving prefix from git" >&2
    prefix="$(_obws_git_prefix)"
  fi

  OBWS_BRANCH_LABEL=$(printf '%s' "$prefix" | awk -F'|' '{print $1}')
  OBWS_WORKTREE_LABEL=$(printf '%s' "$prefix" | awk -F'|' '{print $2}')
  OBWS_REPO_LABEL=$(printf '%s' "$prefix" | awk -F'|' '{print $3}')

  if [ -z "$OBWS_BRANCH_LABEL" ] || [ -z "$OBWS_WORKTREE_LABEL" ] || [ -z "$OBWS_REPO_LABEL" ]; then
    echo "[obws] ERROR: could not resolve one or more context labels (branch/worktree/repo). Tagging will be incomplete." >&2
    return 1
  fi

  export OBWS_BRANCH_LABEL OBWS_WORKTREE_LABEL OBWS_REPO_LABEL
}

# Derive a fallback prefix from git when ruflo tags.sh is unavailable.
_obws_git_prefix() {
  local branch worktree repo
  branch="branch:$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
  worktree="worktree:$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || echo unknown)"
  repo="repo:$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || echo unknown)"
  printf '%s|%s|%s' "$branch" "$worktree" "$repo"
}

# Apply the three context labels to a Beads issue (idempotent).
# Usage: obws_tag_context <issue-id>
obws_tag_context() {
  local id="$1"
  if [ -z "$id" ]; then
    echo "[obws] ERROR: obws_tag_context requires an issue ID" >&2
    return 1
  fi

  # Resolve labels if not yet set.
  if [ -z "$OBWS_BRANCH_LABEL" ]; then
    obws_resolve_prefix || return 1
  fi

  _obws_apply_tag "$id" "$OBWS_BRANCH_LABEL"
  _obws_apply_tag "$id" "$OBWS_WORKTREE_LABEL"
  _obws_apply_tag "$id" "$OBWS_REPO_LABEL"
}

# Apply openspec:<change-id> label and store openspec_change in metadata.
# Usage: obws_tag_change <issue-id> <change-id>
obws_tag_change() {
  local id="$1"
  local change_id="$2"
  if [ -z "$id" ] || [ -z "$change_id" ]; then
    echo "[obws] ERROR: obws_tag_change requires issue-id and change-id" >&2
    return 1
  fi
  _obws_apply_tag "$id" "openspec:${change_id}"
}

# Idempotent tag helper: skips if the label is already present.
_obws_apply_tag() {
  local id="$1"
  local label="$2"
  if bd show "$id" --json 2>/dev/null | grep -qF "\"${label}\""; then
    return 0  # already tagged
  fi
  bd tag "$id" "$label" || echo "[obws] WARN: bd tag ${id} ${label} failed" >&2
}
