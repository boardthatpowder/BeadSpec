# scripts/openspec-beads — shared helper library

POSIX shell library sourced by the `openspec-beads-*` skill suite. Centralises logic that was previously duplicated across individual SKILL.md files.

## Files

| File | Purpose |
|---|---|
| `init.sh` | Sources all helpers on `. init.sh`; `obws_init <skill-name>` resolves `OBWS_*_LABEL` vars |
| `context.sh` | `obws_resolve_prefix`, `obws_tag_context`, `obws_tag_change`, `obws_assert_claimable` — branch/worktree/repo tagging contract |
| `memory.sh` | `obws_mem_write`, `obws_mem_write_trajectory`, `obws_mem_search_change`, `obws_mem_search_issue`, `obws_mem_consolidate` — canonical ruflo memory key schema |
| `gates.sh` | `obws_gate_validate`, `obws_gate_status`, `obws_gate_unit_tests`, `obws_gate_preflight`, `obws_gate_impact`, `obws_gate_detect_changes`, `obws_gate_lint`, `obws_gate_orphans`, `obws_gate_guidance_gates`, `obws_affected_processes`, `obws_validate_main_specs` — quality-gate wrappers |
| `graph.sh` | `obws_import_graph` — atomic `bd create --graph` import with idempotent re-run |
| `branch.sh` | `obws_base_branch` — resolves `main` / `master` / `develop` from remote HEAD |
| `tasks.sh` | `obws_tick_task <change-id> <task-ref>` — tick tasks.md checkboxes (BSD/GNU sed portable) |
| `dup.sh` | `obws_find_dups <title>` — duplicate detection via `bd find-duplicates`; respects `OBWS_DUP_METHOD` |

## Usage in skills

One-call setup — all helpers are sourced immediately:

```bash
. "$(git rev-parse --show-toplevel)/scripts/openspec-beads/init.sh"
obws_init <skill-name> || return 1   # resolves OBWS_*_LABEL vars
```

Skills → helpers available after `. init.sh` (all helpers are loaded; `obws_init` resolves `OBWS_*_LABEL` vars):

| Skill | Helpers used |
|---|---|
| `sync` | context, gates |
| `import` | context, gates, graph |
| `work` | context, memory, gates, branch, tasks |
| `complete` | context, memory, gates, branch |
| `followup` | context, memory, dup |
| `resume` | context, memory, gates, graph |
| `scope-change` | context, memory, gates |

## Environment overrides

| Variable | Default | Purpose |
|---|---|---|
| `RUFLO_HOME` | `~/.claude/ruflo` | Location of the ruflo installation |
| `OBWS_UNIT_TEST_CMD` | `bun run test:unit` | Unit test command override — **set this for your stack** |
| `OBWS_SKIP_NONGO_PREFLIGHT` | `1` | When set to `1`, suppresses Go-toolchain preflight failures irrelevant in non-Go projects |
| `OBWS_DUP_METHOD` | `mechanical` | Duplicate detection method: `mechanical` (fast) or `ai` (semantic, requires `ANTHROPIC_API_KEY`) |

> **Customise `OBWS_UNIT_TEST_CMD` for your stack:**
> ```bash
> # TypeScript/Bun (default)
> export OBWS_UNIT_TEST_CMD="bun run test:unit"
>
> # Node/Jest
> export OBWS_UNIT_TEST_CMD="npm test -- --testPathPattern=unit"
>
> # Subdirectory monorepo (before sourcing):
> export OBWS_UNIT_TEST_CMD="cd src && npm test"
>
> # Go
> export OBWS_UNIT_TEST_CMD="go test ./..."
>
> # Python
> export OBWS_UNIT_TEST_CMD="pytest tests/unit"
> ```

## GitNexus note

`obws_gate_impact` and `obws_gate_detect_changes` print MCP tool call instructions for Claude (use `{}` syntax, not `$`). GitNexus `impact` and `detect_changes` are MCP tools, not shell commands. `obws_gate_impact` also emits a CLI fallback (`gitnexus impact <symbol> --upstream --depth 3`) for non-MCP contexts.

`obws_affected_processes` emits a `gitnexus_cypher` MCP instruction populated with the actual changed files from `git diff`, for use at completion time.

## Deprecated `bd` commands (do not use in skills)

| Deprecated (bd)     | Replacement (ruflo)                          |
|---------------------|----------------------------------------------|
| `bd remember "..."` | `ruflo memory store -k "<key>" -v "<body>"`  |
| `bd memories <q>`   | `ruflo memory search -q "<query>"`           |
| `bd recall <key>`   | `ruflo memory retrieve -k "<key>"`           |
| `bd forget <key>`   | `ruflo memory delete -k "<key>"`             |

## Idempotency guarantees

- `obws_tag_context` / `obws_tag_change`: checks existing labels before calling `bd tag`; re-runs are safe.
- `obws_import_graph`: detects an existing epic via `bd query`; on re-import, calls `_obws_create_missing_nodes` to add only nodes absent from Beads — existing nodes are untouched. There is no `--dedup` flag passed to `bd create`.
- `obws_mem_write`: always writes a new timestamped entry; past entries are not modified.
- `obws_tick_task`: idempotent — if the checkbox is already `[x]`, sed matches nothing and the file is unchanged.

## Strictness policy

`obws_gate_validate` uses `--strict` at workflow bookends (`import`, `complete`) and non-strict mid-flow (`work`, `scope-change`, `resume`). This lets spec edits land without blocking in-progress claims, while enforcing full coverage at the entry and exit gates.
