#!/bin/bash
# PostToolUse(Agent): Record agent spawn outcome into ruflo's learning loop.
# Trains hooks_model-route so future routing improves over time.
# Fire-and-forget — always exits 0.

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)
[ "$TOOL" = "Agent" ] || exit 0

PROMPT=$(echo "$INPUT" | jq -r '.tool_input.prompt // empty' 2>/dev/null)
[ -z "$PROMPT" ] && exit 0

# Guard: skip if ruflo is not installed
command -v ruflo >/dev/null 2>&1 || exit 0

# Truncate to 500 chars to match what ruflo-agent-route.sh sent
TASK="${PROMPT:0:500}"

# Model that was actually used. Claude Code Agent PreToolUse stdin currently does NOT
# include the spawned subagent's model in tool_input, so we read tool_input.model if
# present (forward-compat), then fall back to RUFLO_AGENT_MODEL env override, then sonnet.
MODEL=$(echo "$INPUT" | jq -r '.tool_input.model // empty' 2>/dev/null)
[ -z "$MODEL" ] && MODEL="${RUFLO_AGENT_MODEL:-sonnet}"

# Determine outcome from tool response
IS_ERROR=$(echo "$INPUT" | jq -r '.tool_response.is_error // false' 2>/dev/null)
if [ "$IS_ERROR" = "true" ]; then
  OUTCOME="failure"
else
  OUTCOME="success"
fi

# Fire-and-forget — never blocks the next tool call
(ruflo hooks model-outcome --task "$TASK" --model "$MODEL" --outcome "$OUTCOME" 2>/dev/null) &
disown $! 2>/dev/null

exit 0
