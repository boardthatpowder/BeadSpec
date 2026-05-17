#!/usr/bin/env sh
# scripts/openspec-beads/context.sh
# Single owner of the branch/worktree/repo context-tagging contract.
# Source this file; do not execute it directly.
#
# Exports:
#   obws_resolve_prefix              -> sets OBWS_BRANCH_LABEL, OBWS_WORKTREE_LABEL, OBWS_REPO_LABEL
#   obws_tag_context <id>            -> applies the three context labels (idempotent)
#   obws_tag_change <id> <change-id> -> applies openspec:<change-id> label
#   obws_assert_claimable <id>       -> aborts if issue is held by another user

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

  # Reject sentinel 'unknown' values that _obws_git_prefix emits on git failure.
  # Non-empty 'unknown' segments would pass the length check above but produce
  # useless labels (branch:unknown) that silently break multi-worktree isolation.
  case "$OBWS_BRANCH_LABEL|$OBWS_WORKTREE_LABEL|$OBWS_REPO_LABEL" in
    *:unknown*|*:unknown|unknown:*)
      echo "[obws] ERROR: context labels contain 'unknown' — git context not available. Set RUFLO_HOME or ensure git is working." >&2
      return 1
      ;;
  esac

  export OBWS_BRANCH_LABEL OBWS_WORKTREE_LABEL OBWS_REPO_LABEL
}

# Derive a fallback prefix from git when ruflo tags.sh is unavailable.
# NOTE: in detached HEAD state, git rev-parse --abbrev-ref HEAD returns "HEAD" (not a branch name).
# obws_resolve_prefix will reject this because "HEAD" causes confusing labels — it's not "unknown"
# but it's not useful either. The sentinel check below catches it via the empty-or-unknown gate.
_obws_git_prefix() {
  local branch_name worktree repo
  branch_name=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)
  if [ "$branch_name" = "HEAD" ]; then
    echo "[obws] WARN: git is in detached HEAD state — branch label will be 'HEAD', which is not useful. Check out a branch." >&2
  fi
  worktree="worktree:$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || echo unknown)"
  repo="repo:$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || echo unknown)"
  printf 'branch:%s|%s|%s' "$branch_name" "$worktree" "$repo"
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

# Apply openspec:<change-id> label to a Beads issue (idempotent).
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

# Check that an issue is safe to claim by the current git user.
# Aborts (returns 1) if the issue is assigned to a different user.
# Usage: obws_assert_claimable <issue-id>
obws_assert_claimable() {
  local id="$1"
  if [ -z "$id" ]; then
    echo "[obws] ERROR: obws_assert_claimable requires an issue ID" >&2
    return 1
  fi
  local current_assignee git_user
  current_assignee=$(bd show "$id" --json 2>/dev/null | jq -r '.[].assignee // empty' 2>/dev/null)
  git_user=$(git config user.name 2>/dev/null || echo "${USER:-unknown}")
  if [ -n "$current_assignee" ] && [ "$current_assignee" != "$git_user" ]; then
    echo "[obws] Issue '${id}' is held by '${current_assignee}'. Do not claim — contact them or wait." >&2
    return 1
  fi
  return 0
}

# Idempotent tag helper: skips if the label is already present.
_obws_apply_tag() {
  local id="$1"
  local label="$2"

  if command -v jq > /dev/null 2>&1; then
    # Safe: match exact label string inside the labels JSON array.
    if bd show "$id" --json 2>/dev/null | \
        jq -e --arg L "$label" '.[].labels | index($L)' >/dev/null 2>&1; then
      return 0  # already tagged
    fi
  else
    # jq unavailable: fall back to grep (may false-positive on description text).
    if bd show "$id" --json 2>/dev/null | grep -qF "\"${label}\""; then
      return 0  # already tagged (best-effort)
    fi
  fi

  bd tag "$id" "$label" || echo "[obws] WARN: bd tag ${id} ${label} failed" >&2
}
