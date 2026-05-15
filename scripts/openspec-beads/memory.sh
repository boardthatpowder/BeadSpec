#!/usr/bin/env sh
# scripts/openspec-beads/memory.sh
# Single owner of the canonical ruflo memory key schema for openspec-beads.
# Source this file; do not execute it directly.
#
# Canonical key schema:
#   <branch|worktree|repo>|openspec:<change-id>|issue:<issue-id>|type:<type>|outcome:<outcome>|ts:<unix>
#
# Allowed type values: trajectory, retrospective, followup-triage, scope-change, paused
#
# Exports:
#   obws_mem_write <change-id> <issue-id> <type> <outcome> <body>
#   obws_mem_search_change <change-id>
#   obws_mem_search_issue <issue-id>

# Resolve RUFLO_HOME consistently.
_OBWS_RUFLO_HOME="${RUFLO_HOME:-${HOME}/.claude/ruflo}"

# Source context helpers if not already loaded.
_obws_ensure_context() {
  if [ -z "$OBWS_BRANCH_LABEL" ]; then
    local ctx_script
    ctx_script="$(git rev-parse --show-toplevel 2>/dev/null)/scripts/openspec-beads/context.sh"
    if [ -f "$ctx_script" ]; then
      # shellcheck source=scripts/openspec-beads/context.sh
      . "$ctx_script"
      obws_resolve_prefix
    else
      echo "[obws] WARN: context.sh not found; memory key prefix will be incomplete" >&2
    fi
  fi
}

# Write a memory entry using the canonical schema.
# Usage: obws_mem_write <change-id> <issue-id> <type> <outcome> <body>
#   <issue-id> may be "" when writing change-level entries (e.g. retrospectives)
obws_mem_write() {
  local change_id="$1"
  local issue_id="$2"
  local entry_type="$3"
  local outcome="$4"
  local body="$5"

  if [ -z "$change_id" ] || [ -z "$entry_type" ] || [ -z "$outcome" ]; then
    echo "[obws] ERROR: obws_mem_write requires change-id, type, outcome" >&2
    return 1
  fi

  _obws_ensure_context

  local prefix="${OBWS_BRANCH_LABEL}|${OBWS_WORKTREE_LABEL}|${OBWS_REPO_LABEL}"
  local issue_segment=""
  if [ -n "$issue_id" ]; then
    issue_segment="|issue:${issue_id}"
  fi
  local key="${prefix}|openspec:${change_id}${issue_segment}|type:${entry_type}|outcome:${outcome}|ts:$(date +%s)"

  if command -v ruflo > /dev/null 2>&1; then
    if ! ruflo memory store -k "$key" -v "$body" 2>&1; then
      echo "[obws] WARN: ruflo memory store failed for key ${key}" >&2
    fi
  else
    echo "[obws] WARN: ruflo not found; skipping memory write for ${entry_type}" >&2
  fi
}

# Search memory for all entries related to a change.
# Usage: obws_mem_search_change <change-id>
obws_mem_search_change() {
  local change_id="$1"
  if [ -z "$change_id" ]; then
    echo "[obws] ERROR: obws_mem_search_change requires change-id" >&2
    return 1
  fi
  if command -v ruflo > /dev/null 2>&1; then
    ruflo memory search -q "openspec:${change_id}" 2>/dev/null | head -40 || true
  else
    echo "[obws] WARN: ruflo not found; cannot search memory" >&2
  fi
}

# Search memory for all entries related to a specific issue.
# Usage: obws_mem_search_issue <issue-id>
obws_mem_search_issue() {
  local issue_id="$1"
  if [ -z "$issue_id" ]; then
    echo "[obws] ERROR: obws_mem_search_issue requires issue-id" >&2
    return 1
  fi
  if command -v ruflo > /dev/null 2>&1; then
    ruflo memory search -q "issue:${issue_id}" 2>/dev/null | head -40 || true
  else
    echo "[obws] WARN: ruflo not found; cannot search memory" >&2
  fi
}
