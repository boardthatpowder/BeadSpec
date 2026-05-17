---
name: openspec-beads-work
description: Single-issue agent execution loop for OpenSpec-backed Beads work. Claim one ready issue, re-read the referenced OpenSpec artifacts, run GitNexus impact analysis before editing, implement scoped changes, run unit tests and openspec validate, then close or update with blockers. Self-contained — no runbook needed.
license: MIT
compatibility: Requires openspec CLI and bd (beads) CLI.
metadata:
  author: openspec
  version: "1.2"
  generatedBy: "1.1.1"
---

Work one Beads issue from claim to completion.

**Source-of-truth rule:** OpenSpec owns the spec. Beads owns the task graph. All scope decisions defer to OpenSpec artifacts. If scope is unclear, re-read the spec — do not invent behavior.

**(MCP-tool blocks use `{}` syntax; shell blocks use `$`.)**

**Input**: A Beads issue ID. If omitted, run `bd ready` and pick the top-ranked issue.

## Parallelism rule (MANDATORY)

After closing this issue, always check how many tasks are now ready and spawn concurrent agents:

```bash
bd ready --mol <epic-id> --json --limit 20 | jq '[.[] | select(.issue_type != "epic")] | length'
```

**If ≥ 2 ready tasks exist after closing:** spawn one `Agent` per task in a single message (all tool calls in one response), each running `openspec-beads-work <issue-id>`.

**Parallelism decision rule** (from `ruflo-swarm-dispatch`):
- **Independent tasks** (different file paths, no shared state) → built-in `Agent` tool, parallel calls. This is the default.
- **Tasks editing overlapping files or requiring consensus** → `ruflo swarm` escalation.
- **Single remaining task** → continue sequentially in the current conversation.

Never grind tasks one-at-a-time when `bd ready` shows a group with multiple entries. Parallelism = the group size shown by `bd ready --mol <epic-id>`.

**Setup**

```bash
. "$(git rev-parse --show-toplevel)/scripts/openspec-beads/init.sh"
obws_init work || return 1
. "$(git rev-parse --show-toplevel)/scripts/openspec-beads/tasks.sh"
```

**Steps**

1. **Refresh session state**

   ```bash
   bd dolt pull
   bd ready
   ```

   If no issues are ready, report that to the user and stop.

2. **Inspect and claim the issue**

   ```bash
   bd show <issue-id>
   obws_assert_claimable <issue-id> || exit 1   # aborts if held by another user
   bd update <issue-id> --claim
   ```

   From the issue, extract: the OpenSpec change path, the original task wording, acceptance criteria, the validation command, and the likely file/module boundary.

   Surface past memory for this change and issue:
   ```bash
   obws_mem_search_change <change-id> | head -20
   obws_mem_search_issue <issue-id> | head -20
   ```

3. **Re-read the OpenSpec source + surface task-relevant CLAUDE.md guidance**

   Read OpenSpec artifacts before touching any code. Focused acceptance-criteria view:
   ```bash
   openspec show <change-id> --type=change --requirements --no-scenarios --json 2>/dev/null || {
     openspec show <change-id> --type=change --json 2>/dev/null || {
       cat openspec/changes/<change-id>/proposal.md
       cat openspec/changes/<change-id>/design.md
       cat openspec/changes/<change-id>/tasks.md
     }
   }
   ```

   Fetch task-relevant policy shards (requires prior `ruflo guidance compile`):
   ```bash
   _issue_title=$(bd show <issue-id> --json | jq -r '.[].title' 2>/dev/null)
   if ruflo guidance status 2>/dev/null | grep -q 'compiled\|policy'; then
     ruflo guidance retrieve --task "$_issue_title" 2>/dev/null || true
   else
     cat CLAUDE.md 2>/dev/null || true
   fi
   ```

   State a short implementation plan (files, tests, validation command, primary symbols) before editing.

4. **GitNexus impact analysis (MANDATORY before editing)**

   Verify GitNexus index freshness first. For each primary symbol you plan to modify:

   ```bash
   obws_gate_impact "<SymbolName>"
   ```

   Call both MCP tools (context before impact):
   ```
   gitnexus_context({name: "<SymbolName>"})
   gitnexus_impact({target: "<SymbolName>", direction: "upstream", maxDepth: 3})
   ```

   `gitnexus_context` surfaces process membership — tells you if the change is single-touch or cuts across a flow.

   - `riskLevel: HIGH` or `CRITICAL` → halt, present blast radius and affected processes to the user, require explicit confirmation
   - `riskLevel: LOW` or `MEDIUM` → proceed; record affected caller count in issue notes

   Skip only for brand-new symbols with no existing callers.

5. **Implement — scoped to this issue only**

   Allowed: files and modules named in the issue and its OpenSpec task.
   Not allowed: route wiring, frontend changes, unrelated refactors, schema changes not named in this issue.

   Follow TDD: write or update failing tests first, then implement.

   Discovered extra work → **openspec-beads-followup** (bug or out-of-scope follow-up).
   Discovered spec gap → **openspec-beads-scope-change** (OpenSpec update first, then Beads).

6. **Validate**

   ```bash
   obws_gate_unit_tests
   obws_gate_validate <change-id>   # non-strict: spec may still be in draft mid-flow
   ```

   Narrow changes — run the focused test file:
   ```bash
   OBWS_UNIT_TEST_CMD="bun test <path-to-test>.test.ts" obws_gate_unit_tests
   ```

   Before committing — run guidance gates on the staged diff:
   ```bash
   git add <changed-files>
   obws_gate_guidance_gates "$(git diff --cached)"
   ```

   Before closing — run symbol-scope check:
   ```bash
   obws_gate_detect_changes
   ```
   Claude: call `gitnexus_detect_changes({scope: "compare", base_ref: "<base-branch>"})`. Every changed symbol must fall within this issue's scope.

   Do not run integration tests without explicit user approval.

7. **Tick the tasks.md checkbox (MANDATORY)**

   Tick `- [x]` in tasks.md before calling `bd close` — `openspec-beads-complete`'s clean-state check reads this file.

   ```bash
   TASK_REF=$(bd show <issue-id> --json | jq -r '.[].metadata.task_ref // empty')
   obws_tick_task <change-id> "$TASK_REF"
   ```

   Stage the tasks.md change alongside the implementation files.

8. **Close or update**

   If complete:
   ```bash
   bd close <issue-id> \
     --reason="<what was implemented, what tests were added, validation passes>" \
     --suggest-next
   ```
   `--suggest-next` surfaces newly unblocked issues immediately after close.

   Commit and write a trajectory entry:
   ```bash
   git add <changed-files>
   git commit -m "<short summary of what was implemented>"
   obws_mem_write_trajectory "<change-id>" "<issue-id>" "closed"
   ```

   If blocked:
   ```bash
   bd update <issue-id> --append-notes="Blocked: <reason>. Created <blocker-id> to resolve."
   obws_mem_write_trajectory "<change-id>" "<issue-id>" "blocked"
   bd ready
   ```

**Non-obvious traps**
- Never edit a symbol without running `gitnexus_context` + `gitnexus_impact` first (step 4)
- Checkbox tick is required for `openspec-beads-complete`'s clean-state check — skipping leaves tasks.md permanently stale
- Use `OBWS_UNIT_TEST_CMD` env var for subdirectory tests, not `cd backend` inline
