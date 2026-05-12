---
name: openspec-beads-sync
description: Session-start sync ritual. Pulls latest Beads state, lists active OpenSpec changes, shows ready and blocked work, and outputs a one-paragraph state summary. Use at the start of any session before picking up OpenSpec-backed Beads work.
license: MIT
compatibility: Requires openspec CLI and bd (beads) CLI.
metadata:
  author: openspec
  version: "1.0"
  generatedBy: "1.1.1"
---

Sync Beads and OpenSpec state at session start.

**Input**: None.

**Steps**

1. **Repair worktree Beads runtime**

   ```bash
   if [ -x scripts/setup-worktree-beads.sh ]; then
     scripts/setup-worktree-beads.sh
   fi
   ```

   This is local runtime setup only: it links ignored worktree Beads runtime files to the main checkout so all worktrees share the same Dolt database. If it reports that the main checkout is detected, continue.

2. **Pull latest Beads state**

   ```bash
   bd prime
   bd dolt pull
   ```

   If `bd dolt pull` reports no remote, continue with local state and note it in the summary.

3. **Show active OpenSpec changes**

   ```bash
   openspec list
   ```

4. **Show ready and blocked work**

   ```bash
   bd ready
   bd blocked
   ```

5. **Write state summary**

   Output one paragraph covering:
   - How many OpenSpec changes are active and how many have Beads issues not yet imported
   - How many Beads issues are ready to work, in progress, and blocked
   - Which change has the most ready work (if any)
   - Any blockers that need user attention before work can resume

**Guardrails**
- This skill is read-only for Beads issue state — the setup step may repair ignored local runtime symlinks
- If `bd ready` returns nothing, surface that explicitly so the user knows no work is available
- If `bd dolt pull` fails, note it in the summary and continue — do not stop
