#!/usr/bin/env sh
# scripts/openspec-beads/graph.sh
# Atomic graph import for openspec-beads-import.
# Source this file; do not execute it directly.
#
# Exports:
#   obws_import_graph <change-id>
#     Atomically imports a pre-built graph JSON file into Beads, then tags all
#     resulting issues with context labels, then wires all parent-child and
#     task-to-task blocking edges declared in the graph. Idempotent: re-running
#     on an already-imported change skips node creation and re-applies wiring only.
#
# The graph JSON file must be authored by Claude (cognitive work) and written to:
#   openspec/changes/<change-id>/.bd-graph.json
#
# Requires: jq (for dep wiring and safe JSON parsing)
#
# Graph JSON schema (bd create --graph format):
#
# IMPORTANT — actual field names differ from casual expectation:
#   Root key : "nodes"   (NOT "issues" — the CLI rejects "issues" with "plan has no nodes")
#   Node key : "key"     (NOT "ref"   — the CLI rejects "ref" with "empty key")
#   Dep  key : "key"     (NOT "ref"   — dep entries also use "key", not "ref")
#
# IMPORTANT — dep edges are NOT wired by bd create --graph:
#   The CLI creates nodes but ignores "type": "parent-child" and "type": "blocks"
#   entries in the JSON. obws_import_graph wires them automatically post-create using
#   metadata.local_key to map JSON keys to real Beads IDs:
#     parent-child → bd update <child-id> --parent=<epic-id>
#     blocks       → bd dep add <blocked-id> <blocker-id>
#     other types  → bd dep add <a> <b> --type=<type>
#
# IMPORTANT — use "type": "epic" (not "feature") for the parent node:
#   bd create --type accepts bug|feature|task|epic|chore|decision. Using the native
#   epic type lets bd epic close-eligible and bd epic status work correctly.
#   The separate "epic" label is not needed when the type is already "epic".
#
#   {
#     "nodes": [
#       {
#         "key": "epic",                         // local alias for dep wiring within file
#         "title": "OpenSpec: <change-id>",
#         "type": "epic",
#         "priority": 2,
#         "labels": ["openspec:<change-id>"],      // type=epic is sufficient; no separate "epic" label needed
#         "description": "...",
#         "metadata": {"openspec_change": "<change-id>", "local_key": "epic"}
#       },
#       {
#         "key": "task-1-1",
#         "title": "1.1: ...",
#         "type": "task",
#         "priority": 2,
#         "labels": ["openspec:<change-id>"],
#         "description": "...",
#         "metadata": {
#           "openspec_change": "<change-id>",
#           "task_ref": "1.1",
#           "local_key": "task-1-1"
#         },
#         "dependencies": [
#           {"key": "epic",     "type": "parent-child"},
#           {"key": "task-0-1", "type": "blocks"}
#         ]
#       }
#     ]
#   }
#
# NOTE: "key" is a local alias resolved by the wiring step after atomic creation.
#       metadata.local_key must mirror the "key" value so the wiring step can look
#       up real Beads IDs from bd query output after creation.
#
# STANDALONE (non-OpenSpec) graphs:
#   For review/audit graphs not tied to an OpenSpec change:
#   1. Create the graph directory manually:  mkdir -p openspec/changes/<review-slug>/
#   2. Write the graph JSON to:              openspec/changes/<review-slug>/.bd-graph.json
#   3. Import:  bd create --graph openspec/changes/<review-slug>/.bd-graph.json
#   4. Tag:     source context.sh && obws_resolve_prefix && <loop> obws_tag_context <id>
#   5. Wire:    call _obws_wire_graph_deps "<review-slug>" <graph-file> manually

obws_import_graph() {
  local change_id="$1"
  if [ -z "$change_id" ]; then
    echo "[obws] ERROR: obws_import_graph requires a change-id" >&2
    return 1
  fi

  if ! command -v jq > /dev/null 2>&1; then
    echo "[obws] ERROR: jq is required for dep wiring and JSON parsing; install it and re-run" >&2
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

  # Idempotency check: if the epic already exists, skip node creation and re-wire only.
  # Query uses type=epic (not type=feature) — the graph schema mandates "type": "epic" so that
  # bd epic close-eligible and bd epic status work natively.
  local existing_epic
  existing_epic=$(bd query "label=openspec:${change_id} AND type=epic" --json 2>/dev/null | \
    jq -r '.[0].id // empty' 2>/dev/null)

  if [ -n "$existing_epic" ]; then
    echo "[obws] Epic '${existing_epic}' already exists for '${change_id}'; checking for new nodes in .bd-graph.json..." >&2
    _obws_create_missing_nodes "$change_id" "$graph_file"
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
  ids=$(bd query "label=openspec:${change_id}" --json --limit 0 2>/dev/null | \
    jq -r '.[].id' 2>/dev/null)

  if [ -z "$ids" ]; then
    echo "[obws] WARN: no issues found with label openspec:${change_id} after import" >&2
  else
    for id in $ids; do
      obws_tag_context "$id"
    done
    echo "[obws] Context tags applied to $(printf '%s\n' "$ids" | wc -l | tr -d ' ') issues." >&2
  fi

  # Wire parent-child and task-to-task dep edges declared in the graph JSON.
  # bd create --graph creates nodes but ignores dep edge types.
  _obws_wire_graph_deps "$change_id" "$graph_file"

  # F1: Register the epic as a bd swarm molecule so the change is discoverable
  # via `bd swarm list` and filterable via `bd ready --mol <epic-id>`.
  # NOTE: this is a passive label/structure primitive inside Beads — it does NOT
  # spawn agents, coordinate work, or do consensus. It is NOT the same as
  # `ruflo swarm init` and does NOT replace the ruflo-swarm-dispatch rule.
  local epic_id
  epic_id=$(bd query "label=openspec:${change_id} AND type=epic" --json 2>/dev/null | \
    jq -r '.[0].id // empty' 2>/dev/null)
  if [ -n "$epic_id" ]; then
    bd swarm create "$epic_id" 2>/dev/null && \
      echo "[obws] Swarm molecule registered for epic '${epic_id}' (enables bd ready --mol)." >&2 || \
      echo "[obws] WARN: bd swarm create failed (non-fatal; continue without molecule)." >&2
  fi
}

# Wire declared dep edges from the graph JSON to real Beads dep relationships.
# Called internally by obws_import_graph after node creation and tagging.
#
# Dep edge semantics (arg ordering for bd commands):
#   bd dep add <issue-id> <depends-on-id>  →  issue-id depends on (is blocked by) depends-on-id
#   parent-child: from=child, to=parent    → bd update <from-id> --parent=<to-id>
#   blocks:       from=blocked, to=blocker → bd dep add <blocked-id> <blocker-id>
#   other types:  from=dependent, to=dep   → bd dep add <dependent-id> <dep-id> --type=<type>
#
# F2: bd batch fast path — `bd batch` grammar supports `dep add <from> <to> [type]` but
# NOT `update <id> parent=<parent>` (only status/priority/title/assignee). So parent-child
# wiring still uses per-call `bd update --parent`; blocks/other wiring is batched.
_obws_wire_graph_deps() {
  local change_id="$1"
  local graph_file="$2"

  # Write node JSONL to a temp file for iteration (avoids subshell variable loss).
  local tmpdir
  tmpdir=$(mktemp -d 2>/dev/null) || {
    echo "[obws] WARN: mktemp failed; skipping dep wiring" >&2
    return 0
  }

  jq -c '.nodes[] | select((.dependencies // []) | length > 0)' \
    "$graph_file" 2>/dev/null > "${tmpdir}/nodes.jsonl"

  if [ ! -s "${tmpdir}/nodes.jsonl" ]; then
    echo "[obws] No dependency edges declared in graph; nothing to wire." >&2
    rm -rf "$tmpdir"
    return 0
  fi

  echo "[obws] Wiring dependency edges for '${change_id}'..." >&2

  # Fetch all Beads issues for this change once (avoids repeated bd query calls).
  # --limit 0 = unlimited; default is 50 which silently truncates large changes.
  local id_json
  id_json=$(bd query "label=openspec:${change_id}" --json --limit 0 2>/dev/null)

  if [ -z "$id_json" ] || [ "$id_json" = "[]" ]; then
    echo "[obws] WARN: no issues found for dep wiring lookup; skipping" >&2
    rm -rf "$tmpdir"
    return 0
  fi

  local wired=0 skipped=0
  # Collect non-parent-child dep-add lines for batching.
  > "${tmpdir}/batch.lines"

  while IFS= read -r node_json; do
    local from_key from_id from_title
    from_key=$(printf '%s' "$node_json" | jq -r '.key // empty')

    # Resolve key → real id: prefer metadata.local_key match, fall back to title.
    from_id=$(printf '%s' "$id_json" | \
      jq -r --arg k "$from_key" \
        '.[] | select(.metadata.local_key == $k) | .id' 2>/dev/null | head -1)

    if [ -z "$from_id" ]; then
      from_title=$(printf '%s' "$node_json" | jq -r '.title // empty')
      from_id=$(printf '%s' "$id_json" | \
        jq -r --arg t "$from_title" '.[] | select(.title == $t) | .id' 2>/dev/null | head -1)
    fi

    if [ -z "$from_id" ]; then
      echo "[obws] WARN: cannot resolve Beads id for key '${from_key}'; skipping its dep edges" >&2
      skipped=$((skipped + 1))
      continue
    fi

    # Write deps to a temp file so the inner loop runs in the same shell (no subshell).
    printf '%s' "$node_json" | jq -c '.dependencies[]' 2>/dev/null > "${tmpdir}/deps.jsonl"

    while IFS= read -r dep; do
      local to_key to_id dep_type to_title
      to_key=$(printf '%s' "$dep" | jq -r '.key // empty')
      dep_type=$(printf '%s' "$dep" | jq -r '.type // "blocks"')

      # Resolve dep target key → real id.
      to_id=$(printf '%s' "$id_json" | \
        jq -r --arg k "$to_key" \
          '.[] | select(.metadata.local_key == $k) | .id' 2>/dev/null | head -1)

      if [ -z "$to_id" ]; then
        to_title=$(jq -r --arg k "$to_key" \
          '.nodes[] | select(.key == $k) | .title' "$graph_file" 2>/dev/null)
        to_id=$(printf '%s' "$id_json" | \
          jq -r --arg t "$to_title" '.[] | select(.title == $t) | .id' 2>/dev/null | head -1)
      fi

      if [ -z "$to_id" ]; then
        echo "[obws] WARN: cannot resolve id for dep key '${to_key}'; skipping edge '${from_key}'→'${to_key}'" >&2
        skipped=$((skipped + 1))
        continue
      fi

      case "$dep_type" in
        parent-child)
          # bd batch does not support parent= key; must use per-call bd update --parent.
          if bd update "$from_id" --parent="$to_id" 2>/dev/null; then
            wired=$((wired + 1))
          else
            echo "[obws] WARN: --parent failed: '${from_key}'(${from_id}) → '${to_key}'(${to_id})" >&2
          fi
          ;;
        blocks|*)
          # Queue for bd batch commit (faster: one Dolt transaction for all edges).
          # wired is incremented after batch succeeds, not here.
          printf 'dep add %s %s %s\n' "$from_id" "$to_id" "$dep_type" >> "${tmpdir}/batch.lines"
          ;;
      esac
    done < "${tmpdir}/deps.jsonl"

  done < "${tmpdir}/nodes.jsonl"

  # F2: Commit all queued dep-add lines in a single bd batch transaction.
  if [ -s "${tmpdir}/batch.lines" ]; then
    local batch_count
    batch_count=$(wc -l < "${tmpdir}/batch.lines" | tr -d ' ')
    echo "[obws] Committing ${batch_count} dep-add edge(s) via bd batch..." >&2
    if bd batch < "${tmpdir}/batch.lines" 2>&1; then
      wired=$((wired + batch_count))
    else
      echo "[obws] WARN: bd batch failed; falling back to per-call dep add" >&2
      local _fb_wired=0
      while IFS= read -r line; do
        # line format: dep add <from> <to> [type]
        # Extract fields individually to avoid passing an empty --type= arg
        _from=$(printf '%s' "$line" | awk '{print $3}')
        _to=$(printf '%s' "$line" | awk '{print $4}')
        _type=$(printf '%s' "$line" | awk 'NF>=5 {print "--type=" $5}')
        # shellcheck disable=SC2086
        if bd dep add "$_from" "$_to" $_type 2>/dev/null; then
          _fb_wired=$((_fb_wired + 1))
        else
          echo "[obws] WARN: fallback dep add failed: ${line}" >&2
        fi
      done < "${tmpdir}/batch.lines"
      wired=$((wired + _fb_wired))
    fi
  fi

  rm -rf "$tmpdir"
  echo "[obws] Dep wiring complete: ${wired} edges applied, ${skipped} skipped." >&2

  # Detect circular dependencies introduced by this wiring pass.
  _obws_check_dep_cycles
}

# Check for circular dependencies after wiring. Fails (returns 1) if cycles found.
_obws_check_dep_cycles() {
  local cycles
  if cycles=$(bd dep cycles --json 2>/dev/null); then
    if [ -z "$cycles" ] || [ "$cycles" = "[]" ] || [ "$cycles" = "null" ]; then
      echo "[obws] No dependency cycles detected." >&2
      return 0
    fi
    echo "[obws] ERROR: circular dependencies detected in the Beads graph!" >&2
    printf '%s\n' "$cycles" | jq -r '.[]? | "  Cycle: \(. | join(" → "))"' 2>/dev/null || echo "$cycles" >&2
    echo "[obws] Fix the dependency edges in .bd-graph.json and re-run obws_import_graph." >&2
    return 1
  fi
  # bd dep cycles not available or failed — warn but don't abort
  echo "[obws] WARN: bd dep cycles check failed; skipping cycle detection." >&2
  return 0
}

# Create any nodes from .bd-graph.json that don't yet exist in Beads.
# Used on re-import when tasks.md has been updated after initial import.
_obws_create_missing_nodes() {
  local change_id="$1"
  local graph_file="$2"

  if ! command -v jq > /dev/null 2>&1; then
    echo "[obws] WARN: jq not available; skipping missing-node check" >&2
    return 0
  fi

  # Fetch existing local_key values already in Beads for this change.
  local existing_keys
  existing_keys=$(bd query "label=openspec:${change_id}" --json 2>/dev/null | \
    jq -r '.[].metadata.local_key // empty' 2>/dev/null)

  # For each node in .bd-graph.json, check if its key is already imported.
  local created=0 skipped=0
  while IFS= read -r node_json; do
    local node_key node_type
    node_key=$(printf '%s' "$node_json" | jq -r '.key // empty')
    node_type=$(printf '%s' "$node_json" | jq -r '.type // "task"')

    # Skip the epic node (already exists — that's what triggered re-import mode).
    if [ "$node_type" = "epic" ]; then
      skipped=$((skipped + 1))
      continue
    fi

    # Check if this key is already present.
    if printf '%s\n' "$existing_keys" | grep -qxF "$node_key" 2>/dev/null; then
      skipped=$((skipped + 1))
      continue
    fi

    # Node is new — create it individually.
    local title description labels priority meta
    title=$(printf '%s' "$node_json" | jq -r '.title // "Untitled"')
    description=$(printf '%s' "$node_json" | jq -r '.description // ""')
    priority=$(printf '%s' "$node_json" | jq -r '.priority // 2')
    labels=$(printf '%s' "$node_json" | jq -r '(.labels // []) | join(",")' 2>/dev/null)
    meta=$(printf '%s' "$node_json" | jq -c '.metadata // {}' 2>/dev/null)

    # B1 FIX: bd create --json returns a flat object, not an array. Use .id directly.
    local new_id
    new_id=$(bd create \
      --title "$title" \
      --description "$description" \
      --type "$node_type" \
      --priority "$priority" \
      --labels "$labels" \
      --metadata "$meta" \
      --json 2>/dev/null | jq -r '.id // empty' 2>/dev/null | head -1)

    if [ -n "$new_id" ]; then
      echo "[obws] Created missing node '${node_key}' as ${new_id}" >&2
      created=$((created + 1))
      obws_tag_context "$new_id"
    else
      echo "[obws] WARN: failed to create missing node '${node_key}'" >&2
    fi
  done <<EOF
$(jq -c '.nodes[]' "$graph_file" 2>/dev/null)
EOF

  echo "[obws] Re-import: ${created} new nodes created, ${skipped} already existed." >&2
}
