---
name: openspec-beads-complete
description: Change-wide completion workflow. Verify no open or in-progress required Beads issues, run openspec validate and quality gates, close the epic, invoke openspec-archive-change, then follow the session-close protocol. Use when all implementation issues for an OpenSpec change are done.
license: MIT
compatibility: Requires openspec CLI and bd (beads) CLI.
metadata:
  author: openspec
  version: "1.2"
  generatedBy: "1.1.1"
---

Complete and archive an OpenSpec change after all implementation is done.

**Source-of-truth rule:** OpenSpec owns the spec. Archive only after Beads shows no remaining required work and OpenSpec validates.

**Input**: An OpenSpec change ID. If omitted, infer from conversation context or run `openspec list` and ask.

**Setup**

```bash
. "$(git rev-parse --show-toplevel)/scripts/openspec-beads/init.sh"
obws_init complete || return 1
```

**Steps**

1. **Confirm Beads state is clean**

   Every required issue carries `openspec:<change-id>`. Pure follow-ups (priority=4) deliberately omit it.

   First, extract the change ID from the current conversation context or `openspec list`.
   Then derive the epic ID:
   ```bash
   _change_id="<your-change-id>"
   _epic_id=$(bd query "label=openspec:${_change_id} AND type=epic" --json | jq -r '.[0].id // empty')
   [ -z "$_epic_id" ] && { echo "[complete] ERROR: no epic found for change ${_change_id}"; exit 1; }
   ```

   ```bash
   # Required, non-epic work that is not yet closed — must return zero rows.
   # --limit 0 avoids the default 50-row truncation for large changes.
   _open_count=$(bd query "label=openspec:${_change_id} AND status!=closed AND (type=task OR type=bug)" \
     --json --limit 0 | jq -r 'length // 0')

   # Human-readable tree of the whole change
   bd children "$_epic_id" --pretty
   ```

   `_open_count` must be `0`. If rows remain: defer (`bd defer <id> --until=<date>`) or supersede (`bd supersede <id> --with=<new-id>`) before proceeding. Never close the epic over open required work.

   > If the query returns more issues than `bd children` reports, parent-child wiring is incomplete — re-run `obws_import_graph <change-id>` to repair.

2. **Confirm tasks.md is fully checked**

   Read `openspec/changes/<change-id>/tasks.md`. Every task must have `- [x]`. If any are unchecked:
   - If done in code (verify via `openspec-verify-change`): tick the boxes now before continuing.
   - If not done: stop and surface the gap to the user.

3. **Confirm OpenSpec state** (strict — bookend gate)

   ```bash
   obws_gate_validate <change-id> strict   # strict: catches missing scenarios at the completion gate
   obws_gate_status <change-id>
   ```

   Both must pass. Stop and surface specific errors if either fails.

4. **Run quality gates**

   ```bash
   obws_gate_unit_tests
   obws_gate_guidance_gates "$(git diff "$(obws_base_branch)"...HEAD)"
   obws_gate_lint --change <change-id>
   ```

   Then run the GitNexus symbol-scope check (MCP tool call — `{}` syntax):
   ```bash
   obws_gate_detect_changes
   ```
   Claude: call `mcp__gitnexus__detect_changes({scope: "compare", base_ref: "<base-branch from obws_base_branch>"})` as instructed by the output. Unexpected symbols → investigate before archiving.

   For a machine-readable list of which execution processes were touched:
   ```bash
   obws_affected_processes <change-id>
   ```
   Claude: call `mcp__gitnexus__cypher(...)` as printed by the output. Use the returned process names in the retrospective entry (step 6).

   ```bash
   obws_gate_orphans <change-id>
   obws_gate_preflight
   ```
   Go-toolchain failures are suppressed by default (`OBWS_SKIP_NONGO_PREFLIGHT=1`). "No beads pollution" is the actionable signal.

   Do not run integration tests without explicit user approval.

5. **Close the epic**

   ```bash
   # _epic_id was already resolved in step 1; re-verify it is eligible:
   bd epic close-eligible --dry-run --json | \
     jq -e --arg id "$_epic_id" '.[] | select(.id == $id)' >/dev/null || {
       echo "[complete] Epic ${_epic_id} not eligible — children still open:"
       bd children "$_epic_id" --pretty
       exit 1
     }
   ```

   ```bash
   bd close "$_epic_id" --reason="All required Beads issues closed; openspec validates (strict); unit tests pass; gitnexus detect_changes confirms scope."
   ```

6. **Write change retrospective to memory**

   Use the process list from `obws_affected_processes` / `mcp__gitnexus__cypher` (step 4) as the "affected flows" section:
   ```bash
   obws_mem_write "${_change_id}" "" "retrospective" "archived" \
     "Change ${_change_id} archived. Summary: <what shipped>. Affected flows: <process list from mcp__gitnexus__cypher in step 4>. What worked: <observations>. Surprises: <unexpected complexity or gaps>."
   obws_mem_consolidate "${_change_id}"
   ruflo neural patterns 2>/dev/null || true
   ```

7. **Archive the OpenSpec change**

   > Invoke: `openspec-archive-change` with the change-id.

   If this workspace uses a review gate:
   > Invoke: `openspec-verify-change` first, then `openspec-archive-change`.

   Note: `openspec archive` is non-interactive in agent contexts only if called with `--no-validate -y`. The skills above handle this — do not reproduce their steps.

8. **Session close**

   Acquire the merge slot first (serialises concurrent completions):
   ```bash
   bd merge-slot acquire --holder "openspec:<change-id>" --wait 2>/dev/null || true
   ```

   Stage and commit, then delegate the rest to the helper:
   ```bash
   git add <changed files>
   git commit -m "<summary of what shipped>"
   obws_session_close "${_change_id}" "$_epic_id"
   # obws_session_close behaviour:
   #   - bd dolt commit/push (skipped when no Dolt remote is configured)
   #   - git push (skipped when no upstream is configured for the current branch)
   #   - git status
   #   - merge-slot release
   #   - optional gh:run CI gate (only when GITHUB_RUN_ID is set)
   ```

   If a git remote exists: `git status` output must show "up to date with origin". Work is NOT done until pushed.
   If no remote yet: set up `origin` with `git remote add origin <url> && git push -u origin HEAD` first.

**Non-obvious traps**
- Merge-slot acquire/release must pair — if the session crashes between them, the slot hangs; run `bd merge-slot release` manually on next session
- Do NOT close the epic until it appears in `bd epic close-eligible --dry-run --json`
- `obws_gate_preflight` is advisory for Go-toolchain checks (expected failures in this TypeScript repo)
- `git push` failure is not complete — resolve the conflict and retry; work is NOT done until pushed
