#!/usr/bin/env bash
# scripts/openspec-beads/tasks.sh
# tasks.md checkbox management for the openspec-beads skill suite.
# Source this file; do not execute it directly.
#
# Exports:
#   obws_tick_task <change-id> <task-ref>   tick one checkbox in tasks.md (idempotent)

# Tick the checkbox for a task in openspec/changes/<change-id>/tasks.md.
# The task-ref is the N.M prefix (e.g. "1.3") stored in the Beads issue's metadata.task_ref.
# Works on both macOS (BSD sed) and Linux (GNU sed).
# Usage: obws_tick_task <change-id> <task-ref>
obws_tick_task() {
  local change_id="$1"
  local task_ref="$2"

  if [ -z "$change_id" ] || [ -z "$task_ref" ]; then
    echo "[obws] ERROR: obws_tick_task requires change-id and task-ref" >&2
    return 1
  fi

  local repo_root tasks_file
  repo_root="$(git rev-parse --show-toplevel 2>/dev/null)"
  tasks_file="${repo_root}/openspec/changes/${change_id}/tasks.md"

  if [ ! -f "$tasks_file" ]; then
    echo "[obws] ERROR: tasks.md not found: ${tasks_file}" >&2
    return 1
  fi

  # Escape regex metachars + the substitution delimiter `/` in task-ref so sed treats them
  # as literals (e.g. "1.3" → "1\.3"). Order matters: backslash first, then `/`, then the rest.
  local safe_ref
  safe_ref=$(printf '%s' "$task_ref" | sed -e 's/[][\\/.^$*+?(){}|]/\\&/g')

  # Detect sed flavour: BSD sed requires -i '' (macOS); GNU sed accepts -i '' or -i.
  if sed --version > /dev/null 2>&1; then
    # GNU sed
    sed -i "s/^- \[ \][[:space:]]*${safe_ref}\([[:space:]]\|$\)/- [x] ${safe_ref} /" "$tasks_file"
  else
    # BSD sed (macOS)
    sed -i '' "s/^- \[ \][[:space:]]*${safe_ref}\([[:space:]]\|$\)/- [x] ${safe_ref} /" "$tasks_file"
  fi

  # Verify the tick landed.
  if grep -qE "^- \[x\][[:space:]]*${task_ref}([[:space:]]|$)" "$tasks_file" 2>/dev/null; then
    echo "[obws] Ticked checkbox for task ${task_ref} in ${tasks_file}" >&2
  else
    echo "[obws] WARN: checkbox for task_ref '${task_ref}' not found in ${tasks_file} — verify manually" >&2
    return 1
  fi
}
