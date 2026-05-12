---
name: openspec-beads-scope-change
description: Handle a spec gap discovered mid-implementation. Updates OpenSpec artifacts first via openspec-continue-change or openspec-sync-specs, validates, then creates and links Beads issues for the new work. Use when implementation reveals missing, contradictory, or changed behavior that must be reflected in OpenSpec before coding continues.
license: MIT
compatibility: Requires openspec CLI and bd (beads) CLI.
metadata:
  author: openspec
  version: "1.0"
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

**Input**: A description of the spec gap and the affected OpenSpec change ID.

**Steps**

1. **Pause the current Beads issue**

   Do not close it. Update with notes:
   ```bash
   bd update <current-issue-id> --notes="Paused: discovered spec gap — <brief description>. Updating OpenSpec before continuing."
   ```

2. **Update OpenSpec artifacts**

   Use the built-in **openspec-continue-change** skill to add or revise artifacts:
   > Invoke: `openspec-continue-change` with the change-id

   Or if the gap is a delta spec update to an existing capability spec file:
   > Invoke: `openspec-sync-specs` for the affected capability

   These skills handle the artifact update workflow. Do not reproduce their steps inline.

   If the scope change is large or affects agreed design decisions, surface it to the user and get explicit approval before invoking.

3. **Validate**

   ```bash
   openspec validate <change-id>
   ```

   Do not proceed if validation fails.

4. **Create Beads issues for the new work**

   ```bash
   bd create \
     --title="<scope change title>" \
     --description="Scope update from openspec/changes/<change-id>. <Original task context>. Acceptance: <updated criteria from spec artifact>." \
     --type=task \
     --priority=2
   ```

   **Then tag with the standard context labels (MANDATORY).** Every Beads issue must carry `branch:<name>`, `worktree:<name>`, `repo:<name>`, plus `openspec:<change-id>`:

   ```bash
   source ~/.claude/ruflo/lib/tags.sh
   PREFIX=$(ruflo_key_prefix)
   BRANCH_LABEL=$(echo "$PREFIX"   | awk -F'|' '{print $1}')
   WORKTREE_LABEL=$(echo "$PREFIX" | awk -F'|' '{print $2}')
   REPO_LABEL=$(echo "$PREFIX"     | awk -F'|' '{print $3}')

   bd tag <new-issue-id> "$BRANCH_LABEL"
   bd tag <new-issue-id> "$WORKTREE_LABEL"
   bd tag <new-issue-id> "$REPO_LABEL"
   bd tag <new-issue-id> "openspec:<change-id>"
   ```

5. **Link dependencies**

   If the scope change blocks currently in-flight issues:
   ```bash
   bd dep add <blocked-issue-id> <new-scope-issue-id>
   ```

   If the paused issue now depends on this scope issue:
   ```bash
   bd dep add <current-issue-id> <new-scope-issue-id>
   ```

6. **Resume or hand off**

   ```bash
   bd ready
   ```

   Report the new work created, the updated dependency graph, and which issue is now the next ready item.

**Guardrails**
- NEVER update only Beads for a behavior change — OpenSpec must be updated first
- NEVER implement new behavior before `openspec validate` passes (step 3)
- NEVER skip the context tagging step — `branch:<name>`, `worktree:<name>`, `repo:<name>` labels are required on every issue
- Always pause the current issue before starting the scope update (step 1)
- Treat openspec-continue-change and openspec-sync-specs as black boxes — invoke them, don't reproduce their steps
