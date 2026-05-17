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
#   obws_mem_write_trajectory <change-id> <issue-id> <status>
#   obws_mem_search_change <change-id>
#   obws_mem_search_issue <issue-id>
#   obws_mem_consolidate <change-id>

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

# Probe whether ruflo memory search supports --mode hybrid without making a real query.
# Uses `--help` output inspection to avoid polluting the memory store with probe queries.
# Result is cached in _OBWS_MEM_ENHANCED for the shell session lifetime.
_obws_probe_mem_flags() {
  if [ "${_OBWS_MEM_ENHANCED+set}" = set ]; then
    return 0  # already probed this session
  fi
  _OBWS_MEM_ENHANCED=0
  if command -v ruflo > /dev/null 2>&1; then
    # Check for --mode flag by running a deliberately wrong query and inspecting error message.
    # This avoids inserting a real memory entry just to probe capability.
    local probe_err
    probe_err=$(ruflo memory search 2>&1 || true)
    if printf '%s' "$probe_err" | grep -q "mode\|hybrid"; then
      _OBWS_MEM_ENHANCED=1
    fi
  fi
  export _OBWS_MEM_ENHANCED
}

# Internal: invoke ruflo memory search with hybrid+MMR if supported, plain -q otherwise.
_obws_mem_search() {
  local query="$1"
  _obws_probe_mem_flags
  if [ "$_OBWS_MEM_ENHANCED" = "1" ]; then
    ruflo memory search -q "$query" --mode hybrid --rerank mmr 2>/dev/null | head -60 || true
  else
    ruflo memory search -q "$query" 2>/dev/null | head -40 || true
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
    _obws_mem_search "openspec:${change_id}"
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
    _obws_mem_search "issue:${issue_id}"
  else
    echo "[obws] WARN: ruflo not found; cannot search memory" >&2
  fi
}

# Consolidate and compress memory entries for a completed change.
# Usage: obws_mem_consolidate <change-id>
# Runs ruflo memory cleanup + compress to merge N trajectory entries into one synthesis.
# Call this at archive time after writing the retrospective.
obws_mem_consolidate() {
  local change_id="$1"
  if [ -z "$change_id" ]; then
    echo "[obws] ERROR: obws_mem_consolidate requires change-id" >&2
    return 1
  fi
  if ! command -v ruflo > /dev/null 2>&1; then
    echo "[obws] WARN: ruflo not found; skipping memory consolidation" >&2
    return 0
  fi
  echo "[obws] Consolidating memory for completed change: ${change_id}..." >&2
  ruflo memory cleanup 2>/dev/null && echo "[obws] ruflo memory cleanup done." >&2 || \
    echo "[obws] WARN: ruflo memory cleanup failed." >&2
  ruflo memory compress 2>/dev/null && echo "[obws] ruflo memory compress done." >&2 || \
    echo "[obws] WARN: ruflo memory compress failed." >&2
}

# Write a trajectory entry for a completed (or blocked) issue.
# Assembles the body from issue metadata + commit info automatically.
# Usage: obws_mem_write_trajectory <change-id> <issue-id> <status>
#   status: "closed" | "blocked"
obws_mem_write_trajectory() {
  local change_id="$1"
  local issue_id="$2"
  local status="${3:-closed}"

  if [ -z "$change_id" ] || [ -z "$issue_id" ]; then
    echo "[obws] ERROR: obws_mem_write_trajectory requires change-id and issue-id" >&2
    return 1
  fi

  local title desc files commit body
  title=$(bd show "$issue_id" --json 2>/dev/null | jq -r '.[].title // empty' 2>/dev/null)
  desc=$(bd show "$issue_id" --json 2>/dev/null | jq -r '.[].description // empty' 2>/dev/null | head -5)
  files=$(git diff --name-only HEAD~1..HEAD 2>/dev/null | tr '\n' ',' | sed 's/,$//')
  commit=$(git rev-parse HEAD 2>/dev/null)

  body="# ${title}
${desc}
files: ${files}
commit: ${commit}
status: ${status}"

  obws_mem_write "$change_id" "$issue_id" "trajectory" "$status" "$body"
}
