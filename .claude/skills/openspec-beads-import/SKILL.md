---
name: openspec-beads-import
description: Import an approved OpenSpec change into Beads. Creates one epic, one Beads issue per tasks.md entry, infers task-level dependencies by reading each task description, then shows bd ready snapshot. Use after OpenSpec artifacts are approved and before coding starts.
license: MIT
compatibility: Requires openspec CLI and bd (beads) CLI.
metadata:
  author: openspec
  version: "1.1"
  generatedBy: "1.1.1"
---

Import an approved OpenSpec change into Beads as an executable task graph.

**Source-of-truth rule:** OpenSpec owns the spec. Beads owns the task graph. Never start coding directly from tasks.md — import first, then work from `bd ready`.

**Input**: A change name (kebab-case). If omitted, infer from conversation context or run `openspec list` and ask.

**Setup** — source the helper library:

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
. "${REPO_ROOT}/scripts/openspec-beads/context.sh"
. "${REPO_ROOT}/scripts/openspec-beads/gates.sh"
. "${REPO_ROOT}/scripts/openspec-beads/graph.sh"
obws_resolve_prefix
```

**Steps**

1. **Confirm the change exists and is validated**

   ```bash
   obws_gate_validate <change-id>
   ```

   This runs `openspec validate <change-id> --json` and parses the result. Hard-stop on failure.
   Also confirm artifact completeness:
   ```bash
   obws_gate_status <change-id>
   ```

2. **Read the tasks file**

   ```bash
   cat openspec/changes/<change-id>/tasks.md
   ```

   Extract:
   - All section headers (e.g., `## 1. Infrastructure`, `## 2. Lambda Handler`)
   - All task items (`- [ ] N.M description`) with their section membership
   - Any inline file/module references, named artifacts, or cross-task mentions in task descriptions

3. **Build the dependency graph (cognitive step)**

   Read every task description and infer dependencies. For each task, look for:

   - **Explicit task references**: mentions of "task N.M", "the Lambda from 2.1", "N.M's repository method" — create an edge from the referencing task to the referenced task
   - **Named artifact references**: if task B names a specific function, table, or file that task A is defined to create, infer B depends on A
   - **Logical chains within a section**: if tasks form a clear implementation chain, infer linear deps within that chain

   Report the inferred edges and reasoning to the user.

4. **Write the graph JSON file**

   Write `openspec/changes/<change-id>/.bd-graph.json` using the schema documented in
   `scripts/openspec-beads/graph.sh`. Key rules:

   - Every issue MUST include `"labels": ["openspec:<change-id>"]`
   - Every issue MUST include `"metadata": {"openspec_change": "<change-id>", "task_ref": "N.M"}`
   - The epic uses `"type": "feature"` and `"labels": ["openspec:<change-id>", "epic"]`
   - Use `"ref"` aliases for dep wiring within the file (Beads resolves refs to real IDs atomically)
   - Parent-child links from each task to the epic use `"type": "parent-child"`
   - Task-to-task blocking edges use `"type": "blocks"`

   Example structure:
   ```json
   {
     "issues": [
       {
         "ref": "epic",
         "title": "OpenSpec: <change-id>",
         "type": "feature",
         "priority": 2,
         "labels": ["openspec:<change-id>", "epic"],
         "description": "Execution tracker for openspec/changes/<change-id>.",
         "metadata": {"openspec_change": "<change-id>"}
       },
       {
         "ref": "task-1-1",
         "title": "1.1: <task title>",
         "type": "task",
         "priority": 2,
         "labels": ["openspec:<change-id>"],
         "description": "openspec/changes/<change-id>/tasks.md §1.1. <verbatim task>",
         "metadata": {"openspec_change": "<change-id>", "task_ref": "1.1"},
         "dependencies": [{"ref": "epic", "type": "parent-child"}]
       }
     ]
   }
   ```

   If a task description is ambiguous, embed the ambiguity in the issue `"notes"` field rather than guessing.

5. **Import atomically and tag**

   ```bash
   obws_import_graph <change-id>
   ```

   This helper:
   - Detects re-imports (existing epic) and switches to `--dedup` mode automatically
   - Runs `bd create --graph .bd-graph.json --json` for atomic creation on first import
   - Applies `obws_tag_context` (branch/worktree/repo labels) to all created issues
   - The `openspec:<change-id>` label is embedded in the graph JSON (step 4), so it lands atomically

   Check `.bd-graph.json` into git alongside the OpenSpec change so re-imports after `tasks.md` edits are reproducible.

6. **Verify the dependency graph landed**

   ```bash
   bd children <epic-id> --pretty
   ```

   Confirm: epic + correct child count, dep edges visible, all issues labeled.
   Verify on one issue with `bd show <issue-id>` — the LABELS line must show:
   `branch:<name>`, `worktree:<name>`, `repo:<name>`, `openspec:<change-id>`.

7. **Show final state**

   ```bash
   bd children <epic-id> --pretty
   bd ready --explain --json | head -40
   ```

   Report:
   - Epic ID and child issue count
   - Dependency graph summary (which tasks depend on which)
   - Current `bd ready` output — this is the first safe work to pick up

**Guardrails**
- Do NOT start implementation — this skill is import only
- Do NOT use JSONL + `bd batch dep add` (Pattern B) — use `bd create --graph` for atomic creation
- Every imported record MUST carry the `openspec:<change-id>` label so **openspec-beads-complete** can find the change later
- `obws_import_graph` handles dedup on re-import — do not run `bd import` manually without the helper
- If `obws_gate_validate` fails at step 1, stop immediately — do not import from a broken spec
- **Tagging is non-negotiable.** `obws_import_graph` applies context labels automatically. Verify with `bd show` on at least one issue before declaring import complete.
