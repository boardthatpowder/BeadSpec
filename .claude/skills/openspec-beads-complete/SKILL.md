---
name: openspec-beads-complete
description: Change-wide completion workflow. Verify no open or in-progress required Beads issues, run openspec validate and quality gates, close the epic, invoke openspec-archive-change, then follow the session-close protocol. Use when all implementation issues for an OpenSpec change are done.
license: MIT
compatibility: Requires openspec CLI and bd (beads) CLI.
metadata:
  author: openspec
  version: "1.1"
  generatedBy: "1.1.1"
---

Complete and archive an OpenSpec change after all implementation is done.

**Source-of-truth rule:** OpenSpec owns the spec. Archive only after Beads shows no remaining required work and OpenSpec validates.

**Input**: An OpenSpec change ID. If omitted, infer from conversation context or run `openspec list` and ask.

**Setup** — source the helper library:

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
. "${REPO_ROOT}/scripts/openspec-beads/context.sh"
. "${REPO_ROOT}/scripts/openspec-beads/memory.sh"
. "${REPO_ROOT}/scripts/openspec-beads/gates.sh"
. "${REPO_ROOT}/scripts/openspec-beads/branch.sh"
obws_resolve_prefix
```

**Steps**

1. **Confirm Beads state is clean**

   Every required issue created via **openspec-beads-import** or **openspec-beads-followup** carries
   the `openspec:<change-id>` label; pure follow-ups (priority=4) deliberately omit it. Two queries
   cover the check:

   ```bash
   # Required, non-epic work that is not yet closed — must return zero rows
   bd query "label=openspec:<change-id> AND status!=closed AND (type=task OR type=bug)"

   # Human-readable tree of the whole change
   bd children <epic-id> --pretty
   ```

   The first query must return zero rows. If any rows remain:
   - Out-of-scope follow-ups (priority=4, unlabeled) do **not** appear here and do **not** block completion
   - If any required implementation issue is still open, stop and ask the user whether to complete it or explicitly defer it before proceeding

2. **Confirm tasks.md is fully checked**

   Read `openspec/changes/<change-id>/tasks.md` and verify every task has `- [x]` (not `- [ ]`).

   If any unchecked tasks remain:
   - Check whether the work is actually done in code (via `openspec-verify-change`)
   - If done: update the checkboxes now before continuing
   - If not done: stop and surface the gap to the user

3. **Confirm OpenSpec state**

   ```bash
   obws_gate_validate <change-id>
   obws_gate_status <change-id>
   ```

   Both must pass. If either fails, stop and surface the specific errors to the user.

4. **Run quality gates**

   For code changes:
   ```bash
   obws_gate_unit_tests
   ```

   Then run the GitNexus symbol-scope check. This is a **MCP tool call** (not a shell command):
   ```bash
   obws_gate_detect_changes
   ```
   Claude: call the MCP tool as printed by the above:
   ```
   gitnexus_detect_changes({scope: "compare", base_ref: "<base-branch from obws_base_branch>"})
   ```
   Review the output: changed symbols and affected processes must match the expected scope of this
   OpenSpec change. If unexpected symbols appear, investigate before archiving.

   Run preflight to catch stale/orphan issues before epic close:
   ```bash
   obws_gate_preflight
   ```
   Treat preflight failures as hard stops here (unlike session-start where they are advisory).

   For docs-only changes, replace the above with:
   ```bash
   git diff --check
   ```

   Do not run integration tests without explicit user approval in this thread.

5. **Close the epic**

   Locate the parent epic (set at import time):
   ```bash
   bd query "label=openspec:<change-id> AND type=feature"
   ```

   This should return exactly one row. If it returns zero or more than one, investigate before continuing.

   Verify the epic is close-eligible using a structured query (not free-text grep):
   ```bash
   # This must return zero rows — i.e., no open children remain
   bd query "label=openspec:<change-id> AND status!=closed AND (type=task OR type=bug)"
   ```

   If that query returns any rows, `bd epic close-eligible --dry-run` will not list the epic.
   Stop, surface the open children, and do not proceed.

   When clean:
   ```bash
   bd close <epic-id> --reason="All required Beads implementation issues closed; openspec validates; unit tests pass; gitnexus detect_changes confirms scope."
   ```

6. **Write change retrospective to memory** (if ruflo is installed)

   ```bash
   obws_mem_write "<change-id>" "" "retrospective" "archived" \
     "Change <change-id> archived. Summary: <what shipped>. What worked: <observations>. Surprises: <unexpected complexity or gaps>."
   ```

7. **Archive the OpenSpec change**

   Use the built-in **openspec-archive-change** skill:
   > Invoke: `openspec-archive-change` with the change-id

   If this workspace uses a review gate before archiving:
   > Invoke: `openspec-verify-change` first, then `openspec-archive-change`

   Treat these as black boxes — invoke them, don't reproduce their steps.

8. **Session close**

   Follow the `bd prime` session-close protocol:
   ```bash
   git status
   bd dolt pull || echo "[complete] WARN: bd dolt pull failed; Dolt state may be behind"
   git add <changed files>
   git commit -m "<summary of what shipped>"
   bd dolt push
   git push
   git status  # must show "up to date with origin"
   ```

   **Important asymmetry**: if `bd dolt push` succeeds but `git push` fails, do NOT roll back
   Dolt. Record the asymmetry in handoff notes; `openspec-beads-sync` will re-run `bd dolt pull`
   at the next session start.

   If `git push` fails: resolve the conflict and retry. Do not stop before pushing — work is
   NOT complete until `git push` succeeds.

**Guardrails**
- Do NOT archive until `obws_gate_validate` passes (step 3)
- Do NOT close the epic until the clean-state `bd query` in step 5 returns zero rows
- Do NOT use free-text grep of `bd epic close-eligible --dry-run` — use the structured `bd query` check
- Do NOT run integration tests without explicit user approval
- Work is NOT complete until `git push` succeeds — never stop before pushing
- If push fails, resolve and retry
- `obws_gate_preflight` in step 4 is a hard stop here, not advisory
