---
name: openspec-beads-import
description: Import an approved OpenSpec change into Beads. Creates one epic, one Beads issue per tasks.md entry, infers task-level dependencies by reading each task description, then shows bd ready snapshot. Use after OpenSpec artifacts are approved and before coding starts.
license: MIT
compatibility: Requires openspec CLI and bd (beads) CLI.
metadata:
  author: openspec
  version: "1.2"
  generatedBy: "1.1.1"
---

Import an approved OpenSpec change into Beads as an executable task graph.

**Source-of-truth rule:** OpenSpec owns the spec. Beads owns the task graph. Never start coding directly from tasks.md — import first, then work from `bd ready`.

**Input**: A change name (kebab-case). If omitted, infer from conversation context or run `openspec list` and ask.

**Setup**

```bash
. "$(git rev-parse --show-toplevel)/scripts/openspec-beads/init.sh"
obws_init import || return 1
```

**Steps**

1. **Confirm the change exists and is validated** (strict — import bookend gate)

   ```bash
   obws_gate_validate <change-id> strict   # strict: catching missing scenarios here avoids a hard stop at archive
   obws_gate_status <change-id>
   ```

   Hard-stop on failure — do not import from a spec that fails strict validation.

2. **Read the tasks file**

   ```bash
   cat openspec/changes/<change-id>/tasks.md
   ```

   Extract all section headers and task items (`- [ ] N.M description`). **MANDATORY 1:1 rule:** every `- [ ] N.M` checkbox becomes exactly one Beads node — never group multiple checkboxes into one issue. The per-task `metadata.task_ref` (e.g. `"1.3"`) must match the exact N.M from the checkbox — this is how `openspec-beads-work` ticks it on close.

   **Task-ref format:** `obws_tick_task` handles any task_ref string via regex escaping. Two-level (`1.3`) and three-level (`1.3.1`) refs both work provided tasks.md uses them consistently. Ensure each `- [ ] N.M` or `- [ ] N.M.P` prefix is unique within the file.

3. **Build the dependency graph (cognitive step)**

   For each task, look for: explicit task references ("the repo from 2.1"), named artifact references (task B names a function task A creates), and logical chains within a section.

   Enrich with GitNexus execution-flow data for any capability name or service mentioned in a task (MCP tool call — `{}` syntax).
   Note: The `mcp__gitnexus__query` tool accepts a `query` string param for natural-language or concept lookups:
   ```
   mcp__gitnexus__query({query: "<capability or service name from task>"})
   ```
   If tasks A and B both appear in the same process, infer a dependency edge. Report the inferred edges and reasoning to the user.

4. **Write the graph JSON file**

   Write `openspec/changes/<change-id>/.bd-graph.json` using the schema in `scripts/openspec-beads/graph.sh`.

   Key rules:
   - Root key is `"nodes"` (NOT `"issues"` — the CLI rejects `"issues"` with "plan has no nodes")
   - Local alias field is `"key"` (NOT `"ref"` — rejects `"ref"` with "empty key")
   - Every node must include `"labels": ["openspec:<change-id>"]`
   - Every node must include `"metadata": {"openspec_change": "<change-id>", "task_ref": "N.M", "local_key": "<key>"}`
   - Epic uses `"type": "epic"` so `bd epic close-eligible` and `bd epic status` work natively
   - Parent-child links: `"type": "parent-child"` — task-to-task blocking: `"type": "blocks"`

   Example structure:
   ```json
   {
     "nodes": [
       {
         "key": "epic",
         "title": "OpenSpec: <change-id>",
         "type": "epic",
         "priority": 2,
         "labels": ["openspec:<change-id>"],
         "description": "Execution tracker for openspec/changes/<change-id>.",
         "metadata": {"openspec_change": "<change-id>", "local_key": "epic"}
       },
       {
         "key": "task-1-1",
         "title": "1.1: <task title>",
         "type": "task",
         "priority": 2,
         "labels": ["openspec:<change-id>"],
         "description": "openspec/changes/<change-id>/tasks.md §1.1. <verbatim task>",
         "metadata": {"openspec_change": "<change-id>", "task_ref": "1.1", "local_key": "task-1-1"},
         "dependencies": [{"key": "epic", "type": "parent-child"}]
       }
     ]
   }
   ```

5. **Import atomically and tag**

   ```bash
   obws_import_graph <change-id>
   ```

   This helper: runs `bd create --graph` on first import; on re-import diffs against existing `metadata.local_key` and creates only new nodes; wires parent-child and blocking edges post-create; applies `obws_tag_context` to all issues; checks for dependency cycles.

   Check `.bd-graph.json` into git. Re-running after `tasks.md` edits is safe.

6. **Verify the dependency graph landed**

   ```bash
   bd children <epic-id> --pretty
   bd show <issue-id> --json | jq '.[].labels'
   ```

   All issues (including the epic) must carry `branch:<name>`, `worktree:<name>`, `repo:<name>`, `openspec:<change-id>`. The epic uses `type=epic`; the `openspec-beads-complete` query adds `AND (type=task OR type=bug)` to exclude it from the required-work count.

   Run a structural lint on the imported issues:
   ```bash
   obws_gate_lint --change <change-id>
   ```
   Fix any WARN/ERROR with `bd update <id> --acceptance "..."` before proceeding.

7. **Show final state**

   ```bash
   bd children <epic-id> --pretty
   # NOTE: bd ready --explain --json returns an OBJECT {ready,blocked,summary,schema_version}
   # NOT an array — display only, do not pipe to jq '.[]'
   bd ready --explain --json
   bd graph --html <epic-id> > /tmp/<change-id>.html 2>/dev/null && \
     echo "[import] Dep graph written to /tmp/<change-id>.html (open in browser to verify)" || true
   ```

   Report: epic ID and child count, dependency graph summary, current `bd ready` output.

8. **Register as swarm molecule** (optional — verification step)

   `obws_import_graph` already calls `bd swarm create <epic-id>` internally. This step is a verification-only check:
   ```bash
   bd swarm list | head -5
   ```

   If the epic does not appear, run `bd swarm create <epic-id>` manually. Passive label/structure primitive — enables `bd ready --mol <epic-id>` for scope-filtered ready work. **Not** `ruflo swarm init`. Does not spawn agents or coordinate work.

**Non-obvious traps**
- `obws_gate_validate <change-id> strict` is required at import — strict failures caught here avoid a harder stop at archive
- `obws_import_graph` handles incremental re-import; calling it on an already-complete import is safe
- The epic carries `openspec:<change-id>` for filterability; `openspec-beads-complete`'s query adds `AND (type=task OR type=bug)` to exclude it from the required-work count
- Dep cycles detected by `obws_import_graph` must be fixed in `.bd-graph.json` before proceeding

## Post-import parallelism (MANDATORY)

After import completes, immediately spawn concurrent agents for ALL ready tasks — never start one at a time.

```bash
READY=$(bd ready --mol <epic-id> --json --limit 20 | jq '[.[] | select(.issue_type != "epic") | {id, title}]')
echo "$READY"
```

**Spawn rule:**
- ≥ 2 ready tasks → the `ruflo-agent-route.sh` PreToolUse hook writes a model-tier advisory to stderr on each Agent spawn. Use those advisories (haiku/sonnet/opus) to set the `model` parameter. Then send ONE message with multiple `Agent({subagent_type: "claude", model: "<haiku|sonnet|opus>", prompt: "Run openspec-beads-work <id>..."})` tool calls. All in one message = true concurrency.
- Each agent is self-contained: it reads OpenSpec, claims, implements, validates, closes.
- Tasks that share a file (e.g., two tasks both modifying `tasks.md` tick) serialize naturally via Beads claim — the second agent will find the first task still in_progress and skip it.

**Parallelism decision rule** (from `ruflo-swarm-dispatch`):
- Independent tasks (different file paths) → built-in `Agent` tool in parallel. **This is the default.**
- Tasks sharing files or requiring ordered state → `ruflo swarm` escalation only.

The dep graph already enforces ordering — anything `bd ready` shows is safe to run concurrently.
