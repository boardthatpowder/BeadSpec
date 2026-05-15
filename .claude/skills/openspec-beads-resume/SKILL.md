---
name: openspec-beads-resume
description: Resume a paused Beads issue or recover from a partial import. Re-validates the change, recovers pause context from memory, re-claims the issue, and hands off to openspec-beads-work. Use when picking up a paused issue (notes contain "Paused:") or when a previous openspec-beads-import was interrupted.
license: MIT
compatibility: Requires openspec CLI and bd (beads) CLI.
metadata:
  author: openspec
  version: "1.0"
  generatedBy: "1.1.1"
---

Resume a paused issue or repair a partial import, then continue with `openspec-beads-work`.

**When to use this skill:**
- An issue has notes containing `Paused:` (set by `openspec-beads-scope-change`)
- A previous `openspec-beads-import` was interrupted (partial graph, some issues missing)
- You are starting a new session and want to pick up paused work cleanly

**When NOT to use this skill:**
- The issue is blocked (not paused) — use `bd show` to understand the blocker, resolve it, then claim normally
- You are starting fresh work — use `openspec-beads-work` directly

**Input**: A Beads issue ID (for paused issues) or an OpenSpec change ID (for partial import recovery). If omitted, run `bd list --status=in_progress` and look for `Paused:` notes.

**Setup** — source the helper library:

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
. "${REPO_ROOT}/scripts/openspec-beads/context.sh"
. "${REPO_ROOT}/scripts/openspec-beads/memory.sh"
. "${REPO_ROOT}/scripts/openspec-beads/gates.sh"
. "${REPO_ROOT}/scripts/openspec-beads/graph.sh"
obws_resolve_prefix
```

**Steps**

1. **Sync and locate paused work**

   ```bash
   bd dolt pull || echo "[resume] WARN: bd dolt pull failed; continuing with local state"
   ```

   If no issue ID was provided:
   ```bash
   bd list --status=in_progress
   # Look for issues with notes containing "Paused:"
   ```

   ```bash
   bd show <issue-id>
   ```

   Extract from the issue:
   - The OpenSpec change ID (from the `openspec:<change-id>` label or description)
   - The pause reason (from the `notes` field)
   - Whether this is a scope-change pause or an interrupted import

2. **Recover pause context from memory**

   ```bash
   obws_mem_search_issue <issue-id>
   obws_mem_search_change <change-id>
   ```

   Surface the pause reason and any prior trajectory entries. Report to the user what context
   was found before continuing.

3. **Re-validate the change**

   ```bash
   obws_gate_validate <change-id>
   ```

   If validation fails, the spec was left in a broken state from the prior scope-change. Stop
   and invoke **openspec-continue-change** or **openspec-sync-specs** to repair the spec before
   resuming implementation.

4. **Repair partial imports (if applicable)**

   If the pause was caused by an interrupted import (not a scope-change pause), re-run the
   graph import in dedup mode — it is a no-op for already-created issues:

   ```bash
   obws_import_graph <change-id>
   ```

   Verify the resulting graph is complete:
   ```bash
   bd children <epic-id> --pretty
   ```

   Confirm that all expected tasks are present and labeled.

5. **Re-claim the issue**

   If the issue is still claimed by you, proceed. If the claim expired or was released:
   ```bash
   bd update <issue-id> --claim
   ```

   Clear the `Paused:` notes now that you are resuming (replace with a resume note):
   ```bash
   bd update <issue-id> --notes="Resumed: <brief reason resume is safe — spec validated, blockers resolved>."
   ```

6. **Hand off to openspec-beads-work**

   You are now ready to continue implementation. All context has been recovered.

   > Invoke: **openspec-beads-work** with `<issue-id>`, starting at step 3 (re-read OpenSpec)
     since steps 1–2 (refresh + claim) have already been completed here.

**Guardrails**
- Never skip step 3 (`obws_gate_validate`) — the spec may have changed between pause and resume
- Never re-claim an issue that is still actively claimed by another session — check `bd show` for the assignee
- If memory returns no context for the pause reason, ask the user before resuming (the pause may have been caused by an unresolved decision)
- For partial imports, `obws_import_graph` is idempotent — calling it on an already-complete import is a no-op; calling it on a partial import fills in the gaps
