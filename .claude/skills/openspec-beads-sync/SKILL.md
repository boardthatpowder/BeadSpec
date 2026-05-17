---
name: openspec-beads-sync
description: Session-start sync ritual. Pulls latest Beads state, lists active OpenSpec changes, shows ready and blocked work, and outputs a one-paragraph state summary. Use at the start of any session before picking up OpenSpec-backed Beads work.
license: MIT
compatibility: Requires openspec CLI and bd (beads) CLI.
metadata:
  author: openspec
  version: "1.2"
  generatedBy: "1.1.1"
---

Sync Beads and OpenSpec state at session start.

**Input**: None.

**Setup**

```bash
. "$(git rev-parse --show-toplevel)/scripts/openspec-beads/init.sh"
obws_init sync || return 1
```

**Steps**

1. **Repair worktree Beads runtime + warm up embeddings**

   ```bash
   REPO_ROOT=$(git rev-parse --show-toplevel)
   if [ -x "${REPO_ROOT}/scripts/setup-worktree-beads.sh" ]; then
     "${REPO_ROOT}/scripts/setup-worktree-beads.sh" || echo "[sync] WARN: setup-worktree-beads.sh exited non-zero; continuing"
   fi
   chmod 700 "${REPO_ROOT}/.beads" 2>/dev/null || true
   ruflo embeddings warmup 2>/dev/null || echo "[sync] WARN: ruflo embeddings warmup failed. Run \`ruflo embeddings init\` once to enable semantic memory search."
   ```

   Advisory health check using agent-facing structured output:
   ```bash
   bd doctor --agent --json 2>/dev/null | jq -r '.checks[]? | select(.severity == "error" or .severity == "warning") | "  [doctor:\(.severity)] \(.name): \(.message)"' 2>/dev/null || \
     bd doctor 2>/dev/null | grep -i "error\|warning" | head -10 || true
   ```

2. **Pull latest Beads state**

   ```bash
   bd prime || { echo "[sync] ERROR: bd prime failed — check Beads installation"; exit 1; }
   bd dolt pull || echo "[sync] WARN: bd dolt pull failed (no remote?); continuing with local state"
   ```

   `bd prime` failure is fatal — stop here. `bd dolt pull` failure is a warning only.

3. **Check GitNexus index freshness + show active OpenSpec changes**

   Resolve the repo name and read the GitNexus context MCP resource:
   ```bash
   _gitnexus_repo=$(basename "$(git rev-parse --show-toplevel)")
   echo "[sync] GitNexus URI: gitnexus://repo/${_gitnexus_repo}/context"
   ```
   Read MCP resource at the URI printed above (use the literal value of `_gitnexus_repo`, not the shell expression).

   Check the indexed-at timestamp against HEAD. If the index is older than the last few commits, emit:
   ```
   [sync] WARN: GitNexus index may be stale. Run `npx gitnexus analyze` before relying on gitnexus_impact, gitnexus_context, or gitnexus_query results.
   ```

   Validate all active OpenSpec changes in one pass:
   ```bash
   openspec validate --all --strict --json --no-interactive --concurrency 6 2>/dev/null | \
     jq -r '.[] | select(.valid == false) | "  FAIL: \(.changeId) — \(.errors[0].message)"' || true
   ```

   Show active changes:
   ```bash
   openspec list
   ```

4. **Advisory preflight check + worker findings**

   ```bash
   obws_gate_preflight
   ```

   Surface any open issues filed by background workers (security-audit, test-gap-detector):
   ```bash
   _worker_count=$(bd list --status open --json 2>/dev/null | \
     jq '[.[] | select(.labels[]? | startswith("ruflo:"))] | length' 2>/dev/null || echo 0)
   [ "$_worker_count" -gt 0 ] && \
     echo "[sync] ${_worker_count} open worker-filed issue(s) — triage with openspec-beads-followup"
   ```

5. **Show ready and blocked work**

   ```bash
   bd ready --explain --json
   bd blocked
   ```

6. **Write state summary**

   Output one paragraph covering:
   - How many OpenSpec changes are active and how many have Beads issues not yet imported
   - Whether `openspec validate --all` found any failing changes (by name)
   - GitNexus index freshness status
   - How many Beads issues are ready to work, in progress, and blocked
   - Which change has the most ready work (if any)
   - Any preflight warnings or blockers needing user attention

**Non-obvious traps**
- This skill is read-only for Beads issue state — the setup step may repair ignored local runtime symlinks
- `bd doctor --agent --json` is preferred over parsing raw `bd doctor` output — it emits observed/expected/commands per check
- If `bd ready` returns nothing, surface that explicitly so the user knows no work is available
