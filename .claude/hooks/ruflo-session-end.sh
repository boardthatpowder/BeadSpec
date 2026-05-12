#!/bin/bash
# Stop hook: Persist ruflo session state and record session-end patterns.
# Runs in background so it doesn't delay Claude stopping.

(
  ruflo hooks session-end 2>/dev/null || true
  ruflo session save -n "auto-$(date +%Y%m%d-%H%M)" 2>/dev/null || true
) &
disown $! 2>/dev/null

exit 0
