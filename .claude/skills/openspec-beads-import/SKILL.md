---
name: openspec-beads-import
description: Import an approved OpenSpec change into Beads. Creates one epic, one Beads issue per tasks.md entry, infers task-level dependencies by reading each task description, then shows bd ready snapshot. Use after OpenSpec artifacts are approved and before coding starts.
license: MIT
compatibility: Requires openspec CLI and bd (beads) CLI.
metadata:
  author: openspec
  version: "1.0"
  generatedBy: "1.1.1"
---

Import an approved OpenSpec change into Beads as an executable task graph.

**Source-of-truth rule:** OpenSpec owns the spec. Beads owns the task graph. Never start coding directly from tasks.md — import first, then work from `bd ready`.

**Input**: A change name (kebab-case). If omitted, infer from conversation context or run `openspec list` and ask.

**Steps**

1. **Confirm the change exists and is validated**

   ```bash
   openspec status --change "<change-id>"
   openspec validate <change-id>
   ```

   If validation fails, stop and ask the user to fix the spec before importing.

2. **Read the tasks file**

   ```bash
   cat openspec/changes/<change-id>/tasks.md
   ```

   Extract:
   - All section headers (e.g., `## 1. Infrastructure`, `## 2. Lambda Handler`)
   - All task items (`- [ ] N.M description`) with their section membership
   - Any inline file/module references, named artifacts, or cross-task mentions in task descriptions

3. **Create one Beads epic for the change**

   ```bash
   bd create \
     --title="OpenSpec: <change-id>" \
     --description="Execution tracker for openspec/changes/<change-id>. Scope, requirements, and acceptance criteria live in OpenSpec. Beads tracks implementation status, dependencies, blockers, and ownership. Do not start implementation until bd ready shows work." \
     --type=feature \
     --priority=2
   ```

   Record the epic ID as `<epic-id>`.

   Immediately tag the epic with the OpenSpec label **and** the standard branch/worktree/repo context labels (mandatory — see step 5b for the exact set):
   ```bash
   bd tag <epic-id> "openspec:<change-id>"
   # Plus the three context labels — see step 5b
   ```

4. **Infer task-level dependency graph by reading each task description**

   Read every task description and infer dependencies between specific tasks. For each task, look for:

   - **Explicit task references**: mentions of "task N.M", "the Lambda from 2.1", "N.M's repository method" — create an edge from the referencing task to the referenced task
   - **Named artifact references**: if task B names a specific function, table, or file that task A is defined to create, infer B depends on A
   - **Logical chains within a section**: if tasks in a section form a clear implementation chain (e.g., 2.1 creates a module, 2.2 adds the first method, 2.3 calls 2.2's output), infer linear deps within that chain

   Build the full dep graph from this analysis. Report the inferred edges and reasoning to the user. Apply the graph automatically after child issues are created — do not block for confirmation.

5. **Create child issues in parallel batches of 10**

   Create all Beads child issues using parallel subagent dispatch.

   **CRITICAL: dispatch 10 `bd create` calls per subagent message — never serialize one-by-one.**

   Example: in a single subagent message, issue all of these simultaneously:
   ```bash
   bd create --title="<task-1-title>" --description="<task-1-desc>" --type=task --priority=2
   bd create --title="<task-2-title>" --description="<task-2-desc>" --type=task --priority=2
   # ... up to 10 per message
   ```

   Each Beads issue description **MUST** include:
   - The OpenSpec change path: `openspec/changes/<change-id>/`
   - The original task wording from tasks.md verbatim
   - Relevant acceptance criteria (from the task description or nearby spec artifacts)
   - Likely file or module boundary when mentioned in the task
   - Expected validation command: `openspec validate <change-id>` plus a narrowed test command when clear

   Record the mapping: task number → Beads issue ID (needed for dep edges in step 6).

   After all child issues are created, tag each one with the OpenSpec label and the context labels (5b):
   ```bash
   for id in <all-child-issue-ids>; do
     bd tag $id "openspec:<change-id>"
   done
   ```

   This enables filtering all issues for a proposal with `bd list --label "openspec:<change-id>"`.

5b. **Tag every issue with the standard branch/worktree/repo context labels (MANDATORY)**

   Every Beads issue (epic + every child) must carry the three context labels so future sessions can filter by branch and a worktree's work doesn't leak across siblings.

   Resolve the labels once via the helper that already exists in this stack:
   ```bash
   source ~/.claude/ruflo/lib/tags.sh
   PREFIX=$(ruflo_key_prefix)
   # PREFIX format: branch:<name>|worktree:<name>|repo:<name>
   BRANCH_LABEL=$(echo "$PREFIX"   | awk -F'|' '{print $1}')
   WORKTREE_LABEL=$(echo "$PREFIX" | awk -F'|' '{print $2}')
   REPO_LABEL=$(echo "$PREFIX"     | awk -F'|' '{print $3}')
   ```

   Then for the epic and every child issue:
   ```bash
   bd tag <id> "$BRANCH_LABEL"
   bd tag <id> "$WORKTREE_LABEL"
   bd tag <id> "$REPO_LABEL"
   ```

   Verify on at least one issue with `bd show <id>` — the LABELS line must include all three plus `openspec:<change-id>`. If any are missing, re-tag — do not proceed to dep wiring until tagging is complete.

6. **Link dependency edges**

   For each inferred dependency edge, issue:
   ```bash
   bd dep add <blocked-issue-id> <blocking-issue-id>
   ```

   These can be issued in batches in parallel if independent of each other.

7. **Show final state**

   ```bash
   bd show <epic-id>
   bd ready
   ```

   Report:
   - Epic ID and child issue count
   - Dependency graph summary (which tasks depend on which)
   - Current `bd ready` output — this is the first safe work to pick up

**Guardrails**
- Do NOT start implementation — this skill is import only
- Do NOT serialize `bd create` calls — batch them 10 per message using parallel dispatch
- If a task description is ambiguous, embed the ambiguity as a note in the Beads issue description rather than guessing
- If `openspec validate` fails at step 1, stop immediately — do not import from a broken spec
- If a dependency inference feels uncertain, add a note in the child issue description rather than omitting the edge
- **Tagging is non-negotiable.** Every created issue (epic + every child) must carry `branch:<name>`, `worktree:<name>`, `repo:<name>`, and `openspec:<change-id>` labels. Verify with `bd show` on at least one issue before declaring import complete.
