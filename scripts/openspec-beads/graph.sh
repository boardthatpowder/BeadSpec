#!/usr/bin/env sh
# scripts/openspec-beads/graph.sh
# Atomic graph import for openspec-beads-import.
# Source this file; do not execute it directly.
#
# Exports:
#   obws_import_graph <change-id>
#     Atomically imports a pre-built graph JSON file into Beads, then tags all
#     resulting issues with context labels. Idempotent: re-running on an already-
#     imported change is a no-op (dedup mode).
#
# The graph JSON file must be authored by Claude (cognitive work) and written to:
#   openspec/changes/<change-id>/.bd-graph.json
#
# Graph JSON schema (bd create --graph format):
#   {
#     "issues": [
#       {
#         "ref": "epic",                         // local reference for dep wiring
#         "title": "OpenSpec: <change-id>",
#         "type": "feature",
#         "priority": 2,
#         "labels": ["openspec:<change-id>", "epic"],
#         "description": "...",
#         "metadata": {"openspec_change": "<change-id>"}
#       },
#       {
#         "ref": "task-1-1",
#         "title": "N.M: ...",
#         "type": "task",
#         "priority": 2,
#         "labels": ["openspec:<change-id>"],
#         "description": "...",
#         "metadata": {"openspec_change": "<change-id>", "task_ref": "N.M"},
#         "dependencies": [
#           {"ref": "epic", "type": "parent-child"},
#           {"ref": "task-0-1", "type": "blocks"}
#         ]
#       }
#     ]
#   }
# NOTE: "ref" is a local alias for dep wiring within the file.
#       Beads resolves refs to real IDs after atomic creation.

obws_import_graph() {
  local change_id="$1"
  if [ -z "$change_id" ]; then
    echo "[obws] ERROR: obws_import_graph requires a change-id" >&2
    return 1
  fi

  local graph_file
  graph_file="$(git rev-parse --show-toplevel 2>/dev/null)/openspec/changes/${change_id}/.bd-graph.json"

  if [ ! -f "$graph_file" ]; then
    echo "[obws] ERROR: graph file not found: ${graph_file}" >&2
    echo "[obws] Build it first: Claude reads tasks.md, infers deps, writes .bd-graph.json using the schema in graph.sh" >&2
    return 1
  fi

  # Load context helpers.
  local repo_root
  repo_root="$(git rev-parse --show-toplevel 2>/dev/null)"
  # shellcheck source=scripts/openspec-beads/context.sh
  . "${repo_root}/scripts/openspec-beads/context.sh"
  obws_resolve_prefix || return 1

  # Idempotency check: if the epic already exists, use dedup import mode.
  local existing_epic
  existing_epic=$(bd query "label=openspec:${change_id} AND type=feature" --json 2>/dev/null | \
    grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4 2>/dev/null)

  if [ -n "$existing_epic" ]; then
    echo "[obws] Epic '${existing_epic}' already exists for '${change_id}'; running dedup import..." >&2
    bd import "$graph_file" --dedup --json || {
      echo "[obws] ERROR: bd import --dedup failed" >&2
      return 1
    }
  else
    echo "[obws] Creating atomic graph for change '${change_id}'..." >&2
    bd create --graph "$graph_file" --json || {
      echo "[obws] ERROR: bd create --graph failed" >&2
      return 1
    }
  fi

  # Tag all issues in this change with context labels.
  echo "[obws] Applying context tags to all '${change_id}' issues..." >&2
  local ids
  ids=$(bd query "label=openspec:${change_id}" --json 2>/dev/null | \
    grep -o '"id":"[^"]*"' | cut -d'"' -f4 2>/dev/null)

  if [ -z "$ids" ]; then
    echo "[obws] WARN: no issues found with label openspec:${change_id} after import" >&2
  else
    for id in $ids; do
      obws_tag_context "$id"
    done
    echo "[obws] Context tags applied to $(printf '%s\n' "$ids" | wc -l | tr -d ' ') issues." >&2
  fi
}
