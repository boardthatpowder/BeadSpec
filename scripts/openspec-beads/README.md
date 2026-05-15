# scripts/openspec-beads — shared helper library

POSIX shell library sourced by the `openspec-beads-*` skill suite. Centralises logic that was previously duplicated across individual SKILL.md files.

## Files

| File | Purpose |
|---|---|
| `context.sh` | `obws_resolve_prefix`, `obws_tag_context`, `obws_tag_change` — single owner of the branch/worktree/repo tagging contract |
| `memory.sh` | `obws_mem_write`, `obws_mem_search_change`, `obws_mem_search_issue` — canonical ruflo memory key schema |
| `gates.sh` | `obws_gate_validate`, `obws_gate_status`, `obws_gate_unit_tests`, `obws_gate_preflight`, `obws_gate_impact`, `obws_gate_detect_changes` — quality-gate wrappers |
| `graph.sh` | `obws_import_graph` — atomic `bd create --graph` import with idempotent re-run |
| `branch.sh` | `obws_base_branch` — resolves `main` / `master` / `develop` from remote HEAD |

## Usage in skills

Source from the repo root (Claude resolves this via `git rev-parse --show-toplevel`):

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
. "${REPO_ROOT}/scripts/openspec-beads/context.sh"
. "${REPO_ROOT}/scripts/openspec-beads/memory.sh"
. "${REPO_ROOT}/scripts/openspec-beads/gates.sh"
. "${REPO_ROOT}/scripts/openspec-beads/graph.sh"
. "${REPO_ROOT}/scripts/openspec-beads/branch.sh"
```

Each helper can also be sourced individually when only part of the suite is needed.

## Environment overrides

| Variable | Default | Purpose |
|---|---|---|
| `RUFLO_HOME` | `~/.claude/ruflo` | Location of the ruflo installation |
| `OBWS_UNIT_TEST_CMD` | `bun run test:unit` | Unit test command for non-bun repos |

## GitNexus note

`obws_gate_impact` and `obws_gate_detect_changes` print MCP tool call instructions for Claude rather than running shell commands. GitNexus `impact` and `detect_changes` are MCP tool calls and cannot be invoked via shell. The functions make this explicit rather than silently failing.

## Idempotency guarantees

- `obws_tag_context`: checks existing labels before calling `bd tag`; re-runs are safe.
- `obws_import_graph`: detects an existing epic via `bd query` and switches to `--dedup` mode.
- `obws_mem_write`: always writes a new timestamped entry; past entries are not modified.
