#!/bin/bash
# Stop hook: Persist ruflo session state and push when conditions are met.
# Push conditions: remote configured + working tree clean + unpushed commits exist.
# Background ruflo work so it doesn't delay Claude stopping.

(
  ruflo hooks session-end 2>/dev/null || echo "[ruflo] session-end hook failed" >&2
  ruflo session save -n "auto-$(date +%Y%m%d-%H%M%S)" 2>/dev/null || echo "[ruflo] session-save failed" >&2
) &
disown $! 2>/dev/null

# Conditional push: only fires when RUFLO_AUTO_PUSH=1 and there's something to push.
# Opt-in only — auto-push without user confirmation can ship WIP.
# Set RUFLO_AUTO_PUSH=1 in your shell profile or run `RUFLO_AUTO_PUSH=1 claude` to enable.
# NOTE: this hook does NOT rebase. A non-fast-forward push fails safely; resolve manually.
if [ "${RUFLO_AUTO_PUSH:-0}" = "1" ] && git remote -v 2>/dev/null | grep -q .; then
  if [ -z "$(git status --porcelain 2>/dev/null)" ] && \
     [ -n "$(git log --branches --not --remotes --oneline 2>/dev/null)" ]; then
    echo "[session-end] Unpushed commits detected — pushing (no rebase)..." >&2
    bd dolt push 2>&1 | sed 's/^/[session-end] /' >&2 || true
    git push 2>&1 | sed 's/^/[session-end] /' >&2 || true
  fi
fi

exit 0
