---
name: openspec-beads-scope-change
description: Handle a spec gap discovered mid-implementation. Updates OpenSpec artifacts first via openspec-continue-change or openspec-sync-specs, validates, then creates and links Beads issues for the new work. Use when implementation reveals missing, contradictory, or changed behavior that must be reflected in OpenSpec before coding continues.
license: MIT
compatibility: Requires openspec CLI and bd (beads) CLI.
metadata:
  author: openspec
  version: "1.1"
  generatedBy: "1.1.1"
---

Handle a scope change discovered during implementation. OpenSpec is updated first, then Beads.

**Source-of-truth rule:** OpenSpec owns the spec. Scope changes go to OpenSpec first. Never update only Beads for a behavior change.

**When to use this skill:**
- Public API response shape needs to change
- Acceptance criteria need to change
- New user-visible behavior is discovered as required
- Data model or infrastructure changes are required
- Security or tenancy behavior changes
- Any spec artifact (proposal, design, spec delta) needs updating

**When NOT to use this skill:**
- A bug is found within existing, already-specified scope → use **openspec-beads-followup** instead
- A follow-up idea is discovered that doesn't affect the current spec → use **openspec-beads-followup** instead

**Large scope threshold** — escalate to user for explicit approval when the gap:
- Touches more than one capability spec file, OR
- Introduces a `breaking:` modifier to any spec delta (backward-incompatible change)

**Input**: A description of the spec gap and the affected OpenSpec change ID.

**Setup** — source the helper library:

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
. "${REPO_ROOT}/scripts/openspec-beads/context.sh"
. "${REPO_ROOT}/scripts/openspec-beads/memory.sh"
. "${REPO_ROOT}/scripts/openspec-beads/gates.sh"
obws_resolve_prefix
```

**Steps**

1. **Pause the current Beads issue**

   Do not close it. Update with notes and write a memory entry so the pause reason survives session boundaries:
   ```bash
   bd update <current-issue-id> --notes="Paused: discovered spec gap — <brief description>. Updating OpenSpec before continuing."
   obws_mem_write "<change-id>" "<current-issue-id>" "paused" "spec-gap" \
     "Paused: <description of spec gap>. Will resume after OpenSpec update and re-validation."
   ```

2. **Update OpenSpec artifacts**

   Check whether this qualifies as a large scope change (see threshold above). If yes, present
   the impact to the user and get explicit approval before invoking.

   Use the built-in **openspec-continue-change** skill to add or revise artifacts:
   > Invoke: `openspec-continue-change` with the change-id

   Or if the gap is a delta spec update to an existing capability spec file:
   > Invoke: `openspec-sync-specs` for the affected capability

   These skills handle the artifact update workflow. Do not reproduce their steps inline.

3. **Validate**

   ```bash
   obws_gate_validate <change-id>
   ```

   Do not proceed if validation fails.

4. **Create Beads issues for the new work**

   ```bash
   bd create \
     --title="<scope change title>" \
     --description="Scope update from openspec/changes/<change-id>. <Original task context>. Acceptance: <updated criteria from spec artifact>." \
     --type=task \
     --priority=2 \
     --json
   # Record the returned ID as <new-issue-id>
   ```

   Tag immediately (MANDATORY — every new issue must carry all four labels):
   ```bash
   obws_tag_context <new-issue-id>
   obws_tag_change  <new-issue-id> <change-id>
   ```

5. **Link dependencies**

   If the scope change blocks currently in-flight issues:
   ```bash
   bd dep add <blocked-issue-id> <new-issue-id>
   ```

   If the paused issue now depends on this scope issue:
   ```bash
   bd dep add <current-issue-id> <new-issue-id>
   ```

6. **Resume or hand off**

   ```bash
   bd ready
   ```

   Report the new work created, the updated dependency graph, and which issue is now the next
   ready item.

   When you are ready to resume the paused issue, use the **openspec-beads-resume** skill to
   re-validate, re-claim, and continue from where you left off.

**Guardrails**
- NEVER update only Beads for a behavior change — OpenSpec must be updated first
- NEVER implement new behavior before `obws_gate_validate` passes (step 3)
- NEVER skip the context tagging step — use `obws_tag_context` + `obws_tag_change` (two calls, one for each concern)
- Always pause the current issue before starting the scope update (step 1) and write the memory entry so context is recoverable
- Treat openspec-continue-change and openspec-sync-specs as black boxes — invoke them, don't reproduce their steps
- For large scope changes (threshold above), surface to the user before invoking artifact-update skills
