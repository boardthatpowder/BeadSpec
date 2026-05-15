---
name: openspec-beads-sync
description: Session-start sync ritual. Pulls latest Beads state, lists active OpenSpec changes, shows ready and blocked work, and outputs a one-paragraph state summary. Use at the start of any session before picking up OpenSpec-backed Beads work.
license: MIT
compatibility: Requires openspec CLI and bd (beads) CLI.
metadata:
  author: openspec
  version: "1.1"
  generatedBy: "1.1.1"
---

Sync Beads and OpenSpec state at session start.

**Input**: None.

**Setup** — source the helper library once at the start of each session:

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
. "${REPO_ROOT}/scripts/openspec-beads/context.sh"
. "${REPO_ROOT}/scripts/openspec-beads/gates.sh"
obws_resolve_prefix  # warn (not error) if context labels can't be resolved
```

**Steps**

1. **Repair worktree Beads runtime**

   ```bash
   if [ -x scripts/setup-worktree-beads.sh ]; then
     scripts/setup-worktree-beads.sh || echo "[sync] WARN: setup-worktree-beads.sh exited non-zero; continuing"
   fi
   ```

   Repairs ignored worktree Beads runtime symlinks. Not fatal if missing or failing.

2. **Pull latest Beads state**

   ```bash
   bd prime || { echo "[sync] ERROR: bd prime failed — check Beads installation"; exit 1; }
   bd dolt pull || echo "[sync] WARN: bd dolt pull failed (no remote?); continuing with local state"
   ```

   `bd prime` failure is fatal — stop here. `bd dolt pull` failure is a warning only.

3. **Show active OpenSpec changes**

   ```bash
   openspec list
   ```

4. **Advisory preflight check**

   Run as a warm-up scan; surface issues but do not abort:

   ```bash
   obws_gate_preflight
   ```

   Note any stale issues or orphans in the session summary for user attention.

5. **Show ready and blocked work**

   ```bash
   bd ready --explain --json | head -60
   bd blocked
   ```

   The `--explain --json` flag includes structured blocker detail — surface which
   issues are blocked and what's blocking them.

6. **Write state summary**

   Output one paragraph covering:
   - How many OpenSpec changes are active and how many have Beads issues not yet imported
   - How many Beads issues are ready to work, in progress, and blocked
   - Which change has the most ready work (if any)
   - Any preflight warnings needing user attention
   - Any blockers that need user attention before work can resume

**Guardrails**
- This skill is read-only for Beads issue state — the setup step may repair ignored local runtime symlinks
- If `bd ready` returns nothing, surface that explicitly so the user knows no work is available
- If `bd dolt pull` fails, note it in the summary and continue — do not stop
- If preflight reports stale or orphaned issues, surface them — do not silently discard
