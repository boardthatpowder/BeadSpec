#!/bin/bash
# PreToolUse(Agent): Model-tier routing via ruflo intelligence.
# Advisory mode (default): writes a stderr line for Claude to act on.
# Enforcement mode: set RUFLO_ROUTE_ENFORCE=1 in env to have the hook rewrite
# tool_input.model before the Agent call executes.
# Non-blocking — always exits 0.

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)
case "$TOOL" in
  Agent|spawn_agent|functions.spawn_agent|mcp__functions__spawn_agent) ;;
  *) exit 0 ;;
esac

PROMPT=$(echo "$INPUT" | jq -r '.tool_input.prompt // .tool_input.message // empty' 2>/dev/null)
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

# Read caller-supplied model before writing cache (enforcement skips if already set)
EXISTING_MODEL=$(echo "$INPUT" | jq -r '.tool_input.model // empty' 2>/dev/null)

if command -v shasum >/dev/null 2>&1; then
  CACHE_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}/.swarm"
  CACHE_FILE="${CACHE_DIR}/ruflo-model-route-cache.tsv"
  CACHE_KEY=$(printf '%s' "$TASK" | shasum -a 256 | awk '{print $1}')
  if [ -n "$CACHE_KEY" ] && mkdir -p "$CACHE_DIR" 2>/dev/null; then
    printf '%s\t%s\t%s\n' "$CACHE_KEY" "$MODEL" "$(date +%s)" >> "$CACHE_FILE" 2>/dev/null || true
    if [ -f "$CACHE_FILE" ] && [ "$(wc -l < "$CACHE_FILE" | tr -d '[:space:]')" -gt 200 ]; then
      tail -n 200 "$CACHE_FILE" > "${CACHE_FILE}.tmp" 2>/dev/null && mv "${CACHE_FILE}.tmp" "$CACHE_FILE" 2>/dev/null || true
    fi
  fi
fi

ENFORCE="${RUFLO_ROUTE_ENFORCE:-0}"
MIN_CONF="${RUFLO_ROUTE_MIN_CONFIDENCE:-0.5}"

if [ "$ENFORCE" = "1" ] \
   && [ -z "$EXISTING_MODEL" ] \
   && [ "$MODEL" != "inherit" ] \
   && awk -v c="$CONFIDENCE" -v m="$MIN_CONF" 'BEGIN{exit !(c+0 >= m+0)}' 2>/dev/null; then
  printf '%s\n' "[RUFLO ROUTE] enforced model=${MODEL} (complexity=${COMPLEXITY}, conf=${CONFIDENCE})" >&2
  jq -cn --arg m "$MODEL" \
    '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"allow",updatedInput:{model:$m}}}'
  exit 0
fi

echo "[RUFLO ROUTE] complexity=${COMPLEXITY} recommend model=${MODEL} (confidence=${CONFIDENCE})" >&2

exit 0
