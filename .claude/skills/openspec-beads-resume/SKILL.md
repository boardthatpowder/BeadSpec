---
name: openspec-beads-resume
description: Resume a paused Beads issue or recover from a partial import. Re-validates the change, recovers pause context from memory, re-claims the issue, and hands off to openspec-beads-work. Use when picking up a paused issue (notes contain "Paused:") or when a previous openspec-beads-import was interrupted.
license: MIT
compatibility: Requires openspec CLI and bd (beads) CLI.
metadata:
  author: openspec
  version: "1.2"
  generatedBy: "1.1.1"
---

Resume a paused issue or repair a partial import, then continue with `openspec-beads-work`.

Use when an issue has `Paused:` notes (set by `openspec-beads-scope-change`), or when a previous `openspec-beads-import` was interrupted. For blocked (not paused) issues, use `bd show` to understand the blocker and resolve it, then claim normally.

**Input**: A Beads issue ID (paused issues) or an OpenSpec change ID (partial import recovery). If omitted, query by the structured `openspec:paused` label (more reliable than scanning notes).

**Setup**

```bash
. "$(git rev-parse --show-toplevel)/scripts/openspec-beads/init.sh"
obws_init resume || return 1
```

**Steps**

1. **Sync and locate paused work**

   ```bash
   bd dolt pull || echo "[resume] WARN: bd dolt pull failed; continuing with local state"
   ```

   If no issue ID was provided, query by the `openspec:paused` label. If that returns nothing (empty or no output), fall back to in-progress status:
   ```bash
   _paused_out=$(bd list --label "openspec:paused" --json 2>/dev/null | jq -r '.[] | "\(.id) \(.title)"' 2>/dev/null)
   if [ -z "$_paused_out" ]; then
     echo "[resume] No paused issues found by label; showing in-progress:"
     bd list --status=in_progress
   else
     printf '%s\n' "$_paused_out"
   fi
   bd show <issue-id>
   ```

   Extract: the OpenSpec change ID (from `openspec:<change-id>` label), the pause reason (from `notes`), and whether this is a scope-change pause or interrupted import.

2. **Recover pause context from memory**

   ```bash
   obws_mem_search_issue <issue-id>
   obws_mem_search_change <change-id>
   bd history <issue-id> --limit 10
   ```

   Report to the user what context was found before continuing. If no memory entries AND no history, ask the user for the pause reason rather than assuming it from Beads notes alone.

3. **Re-validate the change** (non-strict — spec may still be in-flight)

   ```bash
   obws_gate_validate <change-id>   # non-strict: spec may still be in draft state mid-flow
   ```

   If validation fails, the spec was left broken by the prior scope-change. Stop and invoke **openspec-continue-change** or **openspec-sync-specs** to repair the spec before resuming.

4. **Repair partial imports (if applicable)**

   If the pause was caused by an interrupted import:
   ```bash
   obws_import_graph <change-id>
   bd children <epic-id> --pretty
   ```
   `obws_import_graph` is idempotent — safe to re-run on an already-complete import.

5. **Verify worktree match, then re-claim the issue**

   Confirm the issue's `worktree:*` label matches the current context before claiming.
   `bd show --json` returns an array root — use `.[0]` to access the first element:
   ```bash
   _issue_worktree=$(bd show <issue-id> --json 2>/dev/null | jq -r '.[0].labels[]? | select(startswith("worktree:"))' 2>/dev/null | head -1)
   # Re-use $OBWS_WORKTREE_LABEL set by obws_init above (avoids duplicate prefix resolution)
   _current_worktree="${OBWS_WORKTREE_LABEL}"
   if [ -n "$_issue_worktree" ] && [ "$_issue_worktree" != "$_current_worktree" ]; then
     echo "[resume] ERROR: issue is tagged '${_issue_worktree}' but current worktree is '${_current_worktree}'." >&2
     echo "[resume] Switch to the correct worktree or use 'bd update <issue-id> --label' to retag if the worktree was renamed." >&2
     exit 1
   fi
   # Resolve any open human gates that may have been created by openspec-beads-scope-change:
   _open_gates=$(bd gate list --json 2>/dev/null | jq -r --arg id "<issue-id>" '.[] | select(.blocks == $id and .status == "open") | .id' 2>/dev/null)
   for _gate_id in $_open_gates; do
     bd gate resolve "$_gate_id" 2>/dev/null || echo "[resume] WARN: could not resolve gate ${_gate_id} — check manually"
   done
   obws_assert_claimable <issue-id> || exit 1   # aborts if held by another user
   bd update <issue-id> --claim
   bd update <issue-id> --remove-label "openspec:paused"
   bd update <issue-id> --append-notes="Resumed: <brief reason resume is safe — spec validated, blockers resolved>."
   ```

6. **Hand off to openspec-beads-work**

   > Invoke: **openspec-beads-work** with `<issue-id>`. Skip step 1 (`bd ready`) and step 2 (claim — already done above). Start at step 3 (re-read OpenSpec source).

**Non-obvious traps**
- Never skip step 3 (`obws_gate_validate`) — the spec may have changed during the pause
- Do NOT call `openspec-beads-sync` before this skill — that's a different session-start ritual
- `obws_import_graph` on a partial import fills gaps; calling it on a complete import is a no-op
- If the issue's `worktree:*` label doesn't match the current context, the worktree-guard above halts with a clear error — switch worktrees rather than bypassing the guard
- If `openspec-beads-scope-change` was previously invoked, open human gates must be resolved before the issue re-enters `bd ready`; the gate-resolution step above handles this automatically
