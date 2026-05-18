#!/usr/bin/env bash
# scripts/openspec-beads/init.sh
# One-line setup for openspec-beads skills. Source this file; do not execute it directly.
#
# Usage in skills:
#   . "$(git rev-parse --show-toplevel)/scripts/openspec-beads/init.sh"
#   obws_init <skill-name> || return 1
#
# All helpers are sourced immediately on `. init.sh` — every obws_* function is available
# after sourcing, even without calling obws_init.
# obws_init resolves the branch/worktree/repo prefix (required before using $OBWS_*_LABEL vars).

_OBWS_INIT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
if [ -z "$_OBWS_INIT_ROOT" ]; then
  echo "[obws] ERROR: not inside a git repository; cannot source openspec-beads helpers" >&2
  return 1
fi
_d="${_OBWS_INIT_ROOT}/scripts/openspec-beads"
# Note: _OBWS_INIT_ROOT is intentionally not exported — it is used only during sourcing.

# shellcheck source=scripts/openspec-beads/context.sh
. "${_d}/context.sh" || { echo "[obws] ERROR: cannot source context.sh" >&2; return 1; }
. "${_d}/memory.sh"  || { echo "[obws] ERROR: cannot source memory.sh"  >&2; return 1; }
. "${_d}/gates.sh"   || { echo "[obws] ERROR: cannot source gates.sh"   >&2; return 1; }
. "${_d}/graph.sh"   || { echo "[obws] ERROR: cannot source graph.sh"   >&2; return 1; }
. "${_d}/branch.sh"  || { echo "[obws] ERROR: cannot source branch.sh"  >&2; return 1; }
. "${_d}/tasks.sh"   || { echo "[obws] ERROR: cannot source tasks.sh"   >&2; return 1; }
. "${_d}/dup.sh"     || { echo "[obws] ERROR: cannot source dup.sh"     >&2; return 1; }
unset _d _OBWS_INIT_ROOT

obws_init() {
  local skill="${1:-unknown}"
  obws_resolve_prefix || return 1
  echo "[obws] skill: ${skill}" >&2
}
