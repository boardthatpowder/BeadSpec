#!/usr/bin/env sh
# scripts/openspec-beads/gates.sh
# Quality-gate wrappers for the openspec-beads skill suite.
# Source this file; do not execute it directly.
#
# Shell-native gates (executable via Bash):
#   obws_gate_validate <change-id>      openspec validate --json; aborts on failure
#   obws_gate_status <change-id>        openspec status --change --json; returns 0/1
#   obws_gate_unit_tests                runs ${OBWS_UNIT_TEST_CMD:-bun run test:unit}
#   obws_gate_preflight                 runs bd preflight; warns on failure
#
# GitNexus gates (MCP tool calls — cannot be run as shell; see NOTE below):
#   obws_gate_impact <symbol>           prints guidance; Claude must call MCP tool
#   obws_gate_detect_changes            prints guidance; Claude must call MCP tool
#
# NOTE: GitNexus `impact` and `detect_changes` are MCP tool calls, not shell commands.
# The two functions below print explicit instructions for Claude to invoke them.
# When a skill calls `obws_gate_impact "SymbolName"`, Claude reads the output and
# makes the corresponding MCP tool call before proceeding.

obws_gate_validate() {
  local change_id="$1"
  if [ -z "$change_id" ]; then
    echo "[obws] ERROR: obws_gate_validate requires a change-id" >&2
    return 1
  fi

  echo "[obws] Validating OpenSpec change: ${change_id}" >&2
  local output exit_code
  if output=$(openspec validate "$change_id" --json 2>&1); then
    exit_code=0
  else
    exit_code=$?
  fi

  printf '%s\n' "$output"

  if [ "$exit_code" -ne 0 ]; then
    echo "[obws] ERROR: openspec validate failed for '${change_id}'. Fix spec errors before proceeding." >&2
    return 1
  fi

  # Also check for 'valid: false' in JSON output even when exit code is 0.
  if printf '%s' "$output" | grep -q '"valid"\s*:\s*false'; then
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

obws_gate_unit_tests() {
  local cmd="${OBWS_UNIT_TEST_CMD:-bun run test:unit}"
  echo "[obws] Running unit tests: ${cmd}" >&2
  eval "$cmd"
}

obws_gate_preflight() {
  echo "[obws] Running bd preflight (lint + stale + orphans)..." >&2
  local output exit_code
  if output=$(bd preflight 2>&1); then
    exit_code=0
    echo "$output"
    echo "[obws] bd preflight passed." >&2
  else
    exit_code=$?
    echo "$output"
    echo "[obws] WARN: bd preflight reported issues (exit ${exit_code}). Review before proceeding." >&2
  fi
  return 0  # preflight is advisory at session-start; callers escalate to hard-stop as needed
}

# GitNexus impact analysis gate.
# This function prints instructions for the Claude agent to call the MCP tool.
# The agent MUST call gitnexus_impact({target: "<symbol>", direction: "upstream"})
# before proceeding with implementation if risk level is HIGH or CRITICAL.
#
# Usage: obws_gate_impact "SymbolName"
# Prints: explicit MCP call instruction with the symbol name substituted in.
obws_gate_impact() {
  local symbol="$1"
  if [ -z "$symbol" ]; then
    echo "[obws] ERROR: obws_gate_impact requires a symbol name" >&2
    return 1
  fi
  cat <<INSTRUCTION
[obws:impact-gate] Claude: before editing '${symbol}', call the GitNexus impact MCP tool:
  gitnexus_impact({target: "${symbol}", direction: "upstream", maxDepth: 3})
Rules (from CLAUDE.md):
  - If riskLevel == HIGH or CRITICAL → halt and present blast radius to user; require explicit confirmation
  - If riskLevel == LOW or MEDIUM    → proceed; note the affected callers in the issue notes
INSTRUCTION
}

# GitNexus detect-changes gate.
# The agent MUST call gitnexus_detect_changes() to verify symbol scope before closing.
obws_gate_detect_changes() {
  cat <<INSTRUCTION
[obws:detect-gate] Claude: call the GitNexus detect_changes MCP tool to verify scope:
  gitnexus_detect_changes({scope: "compare", base_ref: "$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|origin/||' || echo main)"})
Rules:
  - Every changed symbol must be within the OpenSpec change's stated scope
  - Unexpected symbols → investigate root cause before closing/archiving
  - Test-only symbols are expected; flag if non-test production symbols appear outside spec scope
INSTRUCTION
}
