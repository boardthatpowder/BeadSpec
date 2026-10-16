#!/bin/bash
# PreToolUse(Agent): Advisory model-tier recommendation via ruflo intelligence routing.
# Writes a single stderr line so Claude can factor the recommendation into subsequent spawns.
# Non-blocking — always exits 0.

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)
[ "$TOOL" = "Agent" ] || exit 0

PROMPT=$(echo "$INPUT" | jq -r '.tool_input.prompt // empty' 2>/dev/null)
[ -z "$PROMPT" ] && exit 0

# Skip trivially short prompts (one-shot calls not worth routing overhead)
PROMPT_LEN=${#PROMPT}
[ "$PROMPT_LEN" -lt 50 ] && exit 0

# Truncate to 500 chars to keep CLI call manageable
TASK="${PROMPT:0:500}"

# Guard: skip if ruflo is not installed
command -v ruflo >/dev/null 2>&1 || exit 0

# Portable timeout shim — macOS has neither `timeout` nor `gtimeout` without coreutils.
TIMEOUT_BIN=$(command -v gtimeout 2>/dev/null || command -v timeout 2>/dev/null || echo "")

# Call ruflo model router with a hard 5s timeout to avoid stalling every Agent spawn.
if [ -n "$TIMEOUT_BIN" ]; then
  ROUTE_JSON=$("$TIMEOUT_BIN" 5 ruflo hooks model-route -t "$TASK" --format json 2>/dev/null \
    | grep -v '^\[INFO\]')
else
  ROUTE_JSON=$(ruflo hooks model-route -t "$TASK" --format json 2>/dev/null \
    | grep -v '^\[INFO\]')
fi

MODEL=$(echo "$ROUTE_JSON" | jq -r '.model // empty' 2>/dev/null)
CONFIDENCE=$(echo "$ROUTE_JSON" | jq -r '.confidence // empty' 2>/dev/null)
COMPLEXITY=$(echo "$ROUTE_JSON" | jq -r '.complexity // empty' 2>/dev/null)

[ -z "$MODEL" ] && exit 0

echo "[RUFLO ROUTE] complexity=${COMPLEXITY} recommend model=${MODEL} (confidence=${CONFIDENCE})" >&2

exit 0
