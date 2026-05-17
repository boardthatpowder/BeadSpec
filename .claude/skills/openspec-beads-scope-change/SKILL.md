---
name: openspec-beads-scope-change
description: Handle a spec gap discovered mid-implementation. Updates OpenSpec artifacts first via openspec-continue-change or openspec-sync-specs, validates, then creates and links Beads issues for the new work. Use when implementation reveals missing, contradictory, or changed behavior that must be reflected in OpenSpec before coding continues.
license: MIT
compatibility: Requires openspec CLI and bd (beads) CLI.
metadata:
  author: openspec
  version: "1.2"
  generatedBy: "1.1.1"
---

Handle a scope change discovered during implementation. OpenSpec is updated first, then Beads.

**Source-of-truth rule:** OpenSpec owns the spec. Scope changes go to OpenSpec first. Never update only Beads for a behavior change.

Use when public API shape, acceptance criteria, user-visible behavior, data model, or security/tenancy semantics need to change. For bugs within existing scope or follow-up ideas that don't affect the spec, use **openspec-beads-followup** instead.

Escalate to user for explicit approval when the gap touches more than one capability spec file, or introduces a `breaking:` modifier to any spec delta.

**Input**: A description of the spec gap and the affected OpenSpec change ID.

**Setup**

```bash
. "$(git rev-parse --show-toplevel)/scripts/openspec-beads/init.sh"
obws_init scope-change || return 1
```

**Steps**

1. **Pause the current Beads issue and surface the decision**

   Do not close it. Update with notes and write a memory entry so the pause reason survives session boundaries:
   ```bash
   bd update <current-issue-id> --append-notes="Paused: discovered spec gap — <brief description>. Updating OpenSpec before continuing."
   bd set-state <current-issue-id> openspec=paused --reason "spec gap: <brief description>"
   obws_mem_write "<change-id>" "<current-issue-id>" "paused" "spec-gap" \
     "Paused: <description of spec gap>. Will resume after OpenSpec update and re-validation."
   ```

   For large scope changes or binary decisions, create a human gate:
   ```bash
   bd gate create --type=human --blocks <current-issue-id> --reason "spec gap: <description>" --json
   ```
   Resolved via `bd gate resolve <gate-id>`. For decisions needing a comment response instead of a binary gate, see the traps section below.

2. **Update OpenSpec artifacts**

   Fetch the canonical artifact template so edits stay structurally valid:
   ```bash
   openspec instructions tasks --change <change-id> 2>/dev/null || true
   ```

   Use **openspec-continue-change** to add or revise artifacts, or **openspec-sync-specs** for delta spec updates to existing capability spec files. Treat them as black boxes — invoke them, don't reproduce their steps.

   If an existing issue was made obsolete by this scope change, supersede it:
   ```bash
   bd supersede <obsoleted-issue-id> --with <new-issue-id>
   ```

3. **Validate** (non-strict — spec may still be in-flight)

   ```bash
   obws_gate_validate <change-id>   # non-strict mid-flow
   ```

   Do not proceed if validation fails. If `openspec-sync-specs` was invoked, also validate main capability specs:
   ```bash
   obws_validate_main_specs
   ```

4. **Create Beads issues for the new work**

   ```bash
   _acceptance="<updated acceptance criterion from the revised spec artifact>"
   _new_issue_id=$(bd create \
     --title="<scope change title>" \
     --description="Scope update from openspec/changes/<change-id>. <Original task context>. Acceptance: <updated criteria from spec artifact>." \
     --type=task \
     --priority=2 \
     --acceptance="$_acceptance" \
     --spec-id="openspec/changes/<change-id>/proposal.md" \
     --labels "openspec:<change-id>,$OBWS_BRANCH_LABEL,$OBWS_WORKTREE_LABEL,$OBWS_REPO_LABEL" \
     --validate \
     --json | jq -r '.id // empty' 2>/dev/null)
   ```

   Confirm labels (# safety net: explicit tag in case --labels was empty):
   ```bash
   obws_tag_context "$_new_issue_id"
   obws_tag_change  "$_new_issue_id" <change-id>
   ```

5. **Link dependencies**

   ```bash
   # in-flight issues blocked by the scope change:
   bd dep add <blocked-issue-id> <new-issue-id> --type=caused-by
   # paused issue now depends on the scope issue:
   bd dep add <current-issue-id> <new-issue-id>
   # if a previously open issue was made obsolete:
   bd supersede <obsoleted-issue-id> --with <new-issue-id>
   ```

6. **Resume or hand off**

   ```bash
   bd ready
   ```

   Report the new work created, the updated dependency graph, and the next ready item. Use **openspec-beads-resume** when ready to pick up the paused issue.

**Non-obvious traps**
- OpenSpec update MUST land and validate before any Beads issue is created — never update only Beads for a behavior change
- `bd gate create --type=human` vs human bead: use gate for binary proceed/stop decisions (`bd gate resolve <id>` to unblock). When a comment response is needed instead: `bd q "HUMAN: spec gap in <change-id> — <decision needed>" --type=task --priority=1 --labels "human,openspec:<change-id>,..."`, then `bd update <id> --description="..."`, user responds via `bd human respond <id>` or `bd human dismiss <id>`
- Use `--type=caused-by` on dep edges that link the scope issue to the gap that caused it
