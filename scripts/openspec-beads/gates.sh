#!/usr/bin/env bash
# scripts/openspec-beads/gates.sh
# Quality-gate wrappers for the openspec-beads skill suite.
# Source this file; do not execute it directly.
#
# Shell-native gates (executable via Bash):
#   obws_gate_validate <change-id> [strict]  openspec validate --json; aborts on failure
#   obws_gate_status <change-id>             openspec status --change --json
#   obws_gate_unit_tests                     runs ${OBWS_UNIT_TEST_CMD:-<your test command>}
#   obws_gate_preflight                      runs bd preflight --check; warns on failure
#   obws_gate_lint [--change <id>]           bd lint scoped to a change label or parent epic
#   obws_gate_orphans [<change-id>]          bd orphans --details; advisory
#   obws_gate_guidance_gates [<diff>]        ruflo guidance gates; aborts on policy violation
#   obws_affected_processes <change-id>      prints mcp__gitnexus__cypher MCP instruction with changed files
#   obws_validate_main_specs                 validates all main capability specs via openspec list --specs
#
# GitNexus gates (MCP tool calls — {} syntax; see NOTE below):
#   obws_gate_impact <symbol>           prints MCP instruction + CLI fallback
#   obws_gate_detect_changes            prints MCP instruction
#
# NOTE: GitNexus `impact` and `detect_changes` are MCP tool calls (use {} syntax, not $).
# The two functions below print instructions for Claude to invoke the MCP tools.
# When a skill calls `obws_gate_impact "SymbolName"`, Claude reads the output and
# makes the corresponding MCP tool call before proceeding.
#
# Strictness policy:
#   obws_gate_validate uses --strict at workflow bookends (import, complete) and non-strict
#   mid-flow (work, scope-change, resume) so spec edits don't block in-progress claims.
#   Pass "strict" as second arg to enable: obws_gate_validate <change-id> strict

obws_gate_validate() {
  local change_id="$1"
  local strict="${2:-}"  # pass "strict" as second arg to enable --strict mode
  if [ -z "$change_id" ]; then
    echo "[obws] ERROR: obws_gate_validate requires a change-id" >&2
    return 1
  fi

  local strict_flag=""
  if [ "$strict" = "strict" ]; then
    strict_flag="--strict"
    echo "[obws] Validating OpenSpec change (strict): ${change_id}" >&2
  else
    echo "[obws] Validating OpenSpec change: ${change_id}" >&2
  fi

  local output exit_code
  # shellcheck disable=SC2086
  if output=$(openspec validate "$change_id" --json --no-interactive $strict_flag 2>&1); then
    exit_code=0
  else
    exit_code=$?
  fi

  printf '%s\n' "$output"

  if [ "$exit_code" -ne 0 ]; then
    echo "[obws] ERROR: openspec validate failed for '${change_id}'. Fix spec errors before proceeding." >&2
    return 1
  fi

  # Also check for valid:false in items[] even when exit code is 0.
  # openspec validate --json shape: {items:[{valid:bool,...}], summary, version}
  # Root has no .valid field; iterate items[].valid.
  if printf '%s' "$output" | jq -e '[.items[]?.valid] | all | not' > /dev/null 2>&1; then
    echo "[obws] ERROR: openspec validate returned valid:false for '${change_id}'." >&2
    return 1
  fi
  echo "[obws] openspec validate passed." >&2
}

obws_gate_status() {
  local change_id="$1"
  if [ -z "$change_id" ]; then
    echo "[obws] ERROR: obws_gate_status requires a change-id" >&2
    return 1
  fi
  openspec status --change "$change_id" --json 2>&1
}

# TODO: Set OBWS_UNIT_TEST_CMD in your project environment to override the default test command.
# Example: export OBWS_UNIT_TEST_CMD="npm test" or "cargo test" or "go test ./..."
# Default "bun run test:unit" is correct for Bun/TypeScript projects; change it for your stack.
obws_gate_unit_tests() {
  local cmd="${OBWS_UNIT_TEST_CMD:-bun run test:unit}"
  echo "[obws] Running unit tests: ${cmd}" >&2
  eval "$cmd"
}

# B4 FIX: bd preflight --check --json actual schema:
#   { "checks": [{"name","passed","output","command","skipped"}], "passed", "summary" }
# The Go-toolchain checks (gofmt, golangci-lint, version sync) always fail in non-Go repos.
# Set OBWS_SKIP_NONGO_PREFLIGHT=1 to suppress them (default: 1).
obws_gate_preflight() {
  echo "[obws] Running bd preflight --check (beads + version checks)..." >&2
  local output exit_code
  if output=$(bd preflight --check --skip-lint --json 2>&1); then
    exit_code=0
  else
    exit_code=$?
  fi

  printf '%s\n' "$output"

  if command -v jq > /dev/null 2>&1; then
    # Extract human-readable failures. Actual schema uses .checks[], not .failures[].
    # Suppress Go-toolchain failures unless OBWS_SKIP_NONGO_PREFLIGHT is unset.
    local skip_nongo="${OBWS_SKIP_NONGO_PREFLIGHT:-1}"
    local filter
    if [ "$skip_nongo" = "1" ]; then
      # Skip checks whose command OR name references go-toolchain binaries.
      # Coerce missing fields to "" so the test() never receives null (which would skip the suppression).
      filter='.checks[] | select(.passed==false and (.skipped//false)==false)
        | select(((.command // .name // "")) | test("golangci-lint|gofmt|go test|version\\.go|go\\.sum"; "i") | not)
        | "  [FAIL] \(.name): \(.output // .command // "no detail")"'
    else
      filter='.checks[] | select(.passed==false and (.skipped//false)==false)
        | "  [FAIL] \(.name): \(.output // .command // "no detail")"'
    fi
    local failures
    failures=$(printf '%s' "$output" | jq -r "$filter" 2>/dev/null)
    if [ -n "$failures" ]; then
      echo "[obws] Preflight failures:" >&2
      printf '%s\n' "$failures" >&2
      echo "[obws] WARN: bd preflight reported actionable issues. Review before proceeding." >&2
    else
      echo "[obws] bd preflight --check passed (Go-toolchain checks suppressed in non-Go repo)." >&2
    fi
  else
    if [ "$exit_code" -ne 0 ]; then
      echo "[obws] WARN: bd preflight reported issues (exit ${exit_code}). Review before proceeding." >&2
    else
      echo "[obws] bd preflight --check passed." >&2
    fi
  fi
  return 0  # preflight is advisory at session-start; openspec-beads-complete does NOT hard-stop here
}

# B5 FIX: bd lint has no --label or --change flag.
# Filter by querying Beads for all IDs with the openspec:<change> label, then
# pass those IDs explicitly to bd lint <ids>.
#
# Lint Beads issues under a parent epic or a change label for structural completeness.
# Usage: obws_gate_lint [--parent <epic-id>] [--change <change-id>]
# Advisory: prints findings but does not abort.
obws_gate_lint() {
  local parent="" change=""
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --parent) parent="$2"; shift 2 ;;
      --change) change="$2"; shift 2 ;;
      *) shift ;;
    esac
  done
  echo "[obws] Running bd lint (structural completeness check)..." >&2

  if [ -n "$change" ] && command -v jq > /dev/null 2>&1; then
    # Resolve issue IDs for this change label and lint only those issues.
    local ids
    ids=$(bd query "label=openspec:${change}" --json 2>/dev/null \
          | jq -r '.[].id' 2>/dev/null | tr '\n' ' ')
    if [ -n "$ids" ]; then
      # shellcheck disable=SC2086
      bd lint $ids --status all 2>&1
    else
      echo "[obws] WARN: no issues found for openspec:${change}; running full lint" >&2
      bd lint 2>&1
    fi
  elif [ -n "$parent" ] && command -v jq > /dev/null 2>&1; then
    # Resolve children of the epic.
    local ids
    ids=$(bd children "$parent" --json 2>/dev/null \
          | jq -r '.[].id' 2>/dev/null | tr '\n' ' ')
    if [ -n "$ids" ]; then
      # shellcheck disable=SC2086
      bd lint $ids --status all 2>&1
    else
      bd lint 2>&1
    fi
  else
    bd lint 2>&1
  fi
  echo "[obws] bd lint complete. Review any WARN/ERROR entries above." >&2
}

# Check for Beads orphan issues after wiring or at completion.
# Usage: obws_gate_orphans [<change-id>]
# Runs bd orphans --details --json. Advisory by default.
obws_gate_orphans() {
  local change_id="${1:-}"
  echo "[obws] Checking for orphaned Beads issues..." >&2
  local output exit_code
  if output=$(bd orphans --details --json 2>&1); then
    exit_code=0
  else
    exit_code=$?
  fi
  if [ -z "$output" ] || [ "$output" = "[]" ] || [ "$output" = "null" ]; then
    echo "[obws] No orphaned issues detected." >&2
    return 0
  fi
  echo "$output"
  if [ -n "$change_id" ] && command -v jq > /dev/null 2>&1; then
    local change_orphans
    change_orphans=$(printf '%s' "$output" | jq -r --arg c "$change_id" \
      '.[] | select(.labels? // [] | index("openspec:" + $c)) | .id' 2>/dev/null)
    if [ -n "$change_orphans" ]; then
      echo "[obws] WARN: Orphaned issues in change ${change_id}: ${change_orphans}" >&2
      echo "[obws] Consider: bd orphans --fix to close issues whose commits already shipped." >&2
    fi
  else
    echo "[obws] WARN: bd orphans returned results. Review before archiving." >&2
  fi
  return 0  # advisory; callers decide whether to hard-stop
}

# Ruflo guidance gates: check that staged changes comply with CLAUDE.md policy rules.
# Usage: obws_gate_guidance_gates [<content-to-check>]
# Falls back gracefully if ruflo guidance compile has not been run.
#
# NOTE: ruflo guidance gates only accepts -c <content> (no stdin, no file flag).
# macOS ARG_MAX is ~256 KB; skip rather than overflow when content exceeds 200 KB.
obws_gate_guidance_gates() {
  local content="${1:-$(git diff --cached 2>/dev/null)}"
  if ! command -v ruflo > /dev/null 2>&1; then
    echo "[obws] WARN: ruflo not found; skipping guidance gates check" >&2
    return 0
  fi
  # Verify guidance compile has been run (produce a helpful error if not).
  if ! ruflo guidance status 2>/dev/null | grep -qE 'Constitution rules:[[:space:]]+[0-9]|Hash:[[:space:]]+[a-f0-9]{8,}'; then
    echo "[obws] WARN: ruflo guidance not compiled — run \`ruflo guidance compile\` once to enable pre-commit policy gates. Skipping." >&2
    return 0
  fi

  # Guard: skip when content exceeds the safe ARG_MAX threshold.
  local content_size
  content_size=$(printf '%s' "$content" | wc -c | tr -d '[:space:]')
  if [ "${content_size:-0}" -gt 200000 ]; then
    echo "[obws] WARN: diff too large (${content_size} bytes > 200 KB); skipping guidance gates to avoid ARG_MAX overflow." >&2
    return 0
  fi

  echo "[obws] Running ruflo guidance gates (CLAUDE.md policy check)..." >&2

  local gate_out exit_code
  if gate_out=$(ruflo guidance gates -c "$content" 2>&1); then
    exit_code=0
  else
    exit_code=$?
  fi

  printf '%s\n' "$gate_out"
  if [ "$exit_code" -ne 0 ]; then
    echo "[obws] ERROR: ruflo guidance gates detected a policy violation. Fix before committing." >&2
    return 1
  fi
  echo "[obws] ruflo guidance gates passed." >&2
  return 0
}

# GitNexus impact analysis gate.
# Prints MCP tool call instruction for Claude. Also emits the CLI command as a fallback
# for non-MCP contexts (e.g. when MCP server is unreachable).
#
# Usage: obws_gate_impact "SymbolName"
obws_gate_impact() {
  local symbol="$1"
  if [ -z "$symbol" ]; then
    echo "[obws] ERROR: obws_gate_impact requires a symbol name" >&2
    return 1
  fi
  cat <<INSTRUCTION
[obws:impact-gate] Claude: before editing '${symbol}', call the GitNexus impact MCP tool:
  mcp__gitnexus__impact({target: "${symbol}", direction: "upstream", maxDepth: 3})
Rules (from CLAUDE.md):
  - If riskLevel == HIGH or CRITICAL → halt and present blast radius to user; require explicit confirmation
  - If riskLevel == LOW or MEDIUM    → proceed; note the affected callers in the issue notes
For HIGH/CRITICAL: also call mcp__gitnexus__context({name: "${symbol}"}) to surface callers, callees, and process membership.
CLI fallback (when MCP unavailable): gitnexus impact ${symbol} --upstream --depth 3
INSTRUCTION
}

# Print the mcp__gitnexus__cypher MCP instruction to identify execution processes touched by this change.
# Used at completion time to populate the retrospective entry with deterministic process names.
# Usage: obws_affected_processes <change-id>
obws_affected_processes() {
  local change_id="$1"
  if [ -z "$change_id" ]; then
    echo "[obws] ERROR: obws_affected_processes requires a change-id" >&2
    return 1
  fi
  local base_ref repo_root changed_files
  repo_root="$(git rev-parse --show-toplevel 2>/dev/null)"
  if [ -f "${repo_root}/scripts/openspec-beads/branch.sh" ]; then
    . "${repo_root}/scripts/openspec-beads/branch.sh"
    base_ref=$(obws_base_branch)
  else
    base_ref="main"
  fi
  changed_files=$(git diff --name-only "${base_ref}...HEAD" 2>/dev/null | jq -Rsc 'split("\n") | map(select(length>0))' 2>/dev/null || echo '[]')
  cat <<INSTRUCTION
[obws:affected-processes] Claude: call the GitNexus cypher MCP tool to list execution processes touched by this change:
  mcp__gitnexus__cypher({
    query: "MATCH (f:Function)-[:STEP_IN_PROCESS]->(p:Process) WHERE f.filePath IN \$changedFiles RETURN DISTINCT p.name",
    params: {changedFiles: ${changed_files}}
  })
Use the returned process names in the retrospective memory entry — deterministic, not free text.
INSTRUCTION
}

# Validate all main capability specs (not change deltas) to catch corruption after openspec-sync-specs.
# Advisory: prints findings but does not abort. Hard-stops are the caller's decision.
# Usage: obws_validate_main_specs
obws_validate_main_specs() {
  echo "[obws] Validating main capability specs..." >&2
  local spec_ids any_fail=0
  # Use non-deprecated `openspec list --specs --json` (schema: {specs: [{id,...}]})
  # instead of the deprecated `openspec spec list`.
  # When no specs exist the CLI prints "No specs found." (non-JSON); jq ignores that gracefully.
  # Use per-element .id // .name (not root-level //) so each item uses its own fallback.
  spec_ids=$(openspec list --specs --json 2>/dev/null | jq -r '.specs[]? | (.id // .name)' 2>/dev/null)
  if [ -z "$spec_ids" ]; then
    echo "[obws] WARN: openspec list --specs returned no specs; skipping main spec validation" >&2
    return 0
  fi
  local sid result
  for sid in $spec_ids; do
    # Use non-deprecated `openspec validate --type spec --strict` (mirrors change-side policy).
    # openspec validate --json returns {items:[{valid:bool,issues:[{message}]}], summary, version}
    # Root has no .valid field — check .items[].valid instead.
    result=$(openspec validate "$sid" --type spec --json --no-interactive --strict 2>/dev/null)
    if printf '%s' "$result" | jq -e '[.items[]?.valid] | all | not' > /dev/null 2>&1; then
      local msg
      msg=$(printf '%s' "$result" | jq -r '.items[0].issues[0].message // "unknown error"' 2>/dev/null)
      echo "[obws] SPEC FAIL: ${sid}: ${msg}" >&2
      any_fail=1
    fi
  done
  if [ "$any_fail" -eq 0 ]; then
    echo "[obws] Main spec validation passed." >&2
  else
    echo "[obws] WARN: one or more main specs failed validation. Review before resuming implementation." >&2
  fi
  return 0  # advisory
}

# Session-close sequence for openspec-beads-complete.
# Handles dolt commit/push, git push with retry, merge-slot release, optional CI gate.
# Call AFTER git add + git commit are done.
# Usage: obws_session_close <change-id> [<epic-id>]
obws_session_close() {
  local change_id="$1" epic_id="${2:-}"
  if [ -z "$change_id" ]; then
    echo "[obws] ERROR: obws_session_close requires a change-id" >&2
    return 1
  fi
  bd dolt commit -m "archive: ${change_id}" || echo "[obws] WARN: bd dolt commit failed; Beads change history may be incomplete"

  # Push Beads only if a Dolt remote is configured. `bd dolt remote list` is non-empty when one exists.
  if bd dolt remote list 2>/dev/null | grep -qE '[a-zA-Z0-9]'; then
    if ! bd dolt push 2>&1; then
      echo "[obws] ERROR: bd dolt push failed — Beads state is not synced to remote. Resolve before proceeding." >&2
      return 1
    fi
  else
    echo "[obws] No Dolt remote configured — skipping bd dolt push (local-only mode)." >&2
  fi

  # Push git only if an upstream is configured for the current branch.
  if git rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null 2>&1; then
    git pull --rebase
    git push || { git pull --rebase && git push; } || {
      echo "[obws] ERROR: git push failed twice — resolve conflicts and push manually before continuing." >&2
      return 1
    }
  else
    echo "[obws] No git upstream configured for $(git rev-parse --abbrev-ref HEAD) — skipping git push (set upstream with 'git push -u origin HEAD' once a remote exists)." >&2
  fi

  git status
  bd merge-slot release --holder "openspec:${change_id}" 2>/dev/null || true
  if [ -n "$epic_id" ] && [ -n "${GITHUB_RUN_ID:-}" ]; then
    # Registers a gh:run gate on the epic so CI status is visible in bd show.
    # Skipped unless GITHUB_RUN_ID is set, since an unresolvable gate stays open forever.
    bd gate create --type=gh:run --blocks="$epic_id" --await-id "$GITHUB_RUN_ID" 2>/dev/null || true
  fi
}

# NOTE: bd ready --json returns an ARRAY []; bd ready --explain --json returns an OBJECT
# {ready, blocked, summary, schema_version}. These two shapes must not be mixed in jq pipelines:
# - skills that parse the list for parallelism use plain `bd ready --json` (array)
# - skills that display the output use `bd ready --explain --json` (object, just display it)

# GitNexus detect-changes gate.
# The agent MUST call mcp__gitnexus__detect_changes() to verify symbol scope before closing.
obws_gate_detect_changes() {
  # Resolve base branch via branch.sh (handles origin/HEAD missing + fallback chain).
  local base_ref repo_root
  repo_root="$(git rev-parse --show-toplevel 2>/dev/null)"
  if [ -f "${repo_root}/scripts/openspec-beads/branch.sh" ]; then
    # shellcheck source=scripts/openspec-beads/branch.sh
    . "${repo_root}/scripts/openspec-beads/branch.sh"
    base_ref=$(obws_base_branch)
  else
    base_ref="main"
    echo "[obws] WARN: branch.sh not found; defaulting base_ref to 'main'" >&2
  fi
  cat <<INSTRUCTION
[obws:detect-gate] Claude: call the GitNexus detect_changes MCP tool to verify scope:
  mcp__gitnexus__detect_changes({scope: "compare", base_ref: "${base_ref}"})
Rules:
  - Every changed symbol must be within the OpenSpec change's stated scope
  - Unexpected symbols → investigate root cause before closing/archiving
  - Test-only symbols are expected; flag if non-test production symbols appear outside spec scope
INSTRUCTION
}
