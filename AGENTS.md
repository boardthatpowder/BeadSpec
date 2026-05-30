# Agent Workflow Guide — BeadSpec

BeadSpec is a Tauri 2.0 desktop application (Rust + React/TypeScript) for managing Beads issue-tracking projects. It reads Dolt SQL directly, writes via the `bd` CLI, and syncs in real time via `dolt_log()` polling.

## Working Agreements

- Always propose a short plan before editing.
- After edits, run `cargo test` (Rust) or `bun test` (frontend) or explain why no tests apply.
- Ask before adding production dependencies or changing public APIs.
- Prefer small commits and tight diffs.
- If scope grows, use `openspec-beads-followup` or `openspec-beads-scope-change` — never silently expand a claimed issue.

## Stack

| Layer | Technology |
|---|---|
| App shell | Tauri 2.0 |
| Backend | Rust (`sqlx`, `specta`, `tauri-specta`, `tokio`) |
| Frontend | React 19, TypeScript, Vite |
| State | TanStack Query (server) + Zustand (UI) |
| UI | Tailwind CSS, TipTap, React Flow / Cytoscape.js |
| Shortcuts | `react-hotkeys-hook` (platform-aware Cmd/Ctrl) |
| IPC | `specta` + `tauri-specta` — auto-generated TS bindings |

## Workflow Stack

| Tool | Role |
|---|---|
| OpenSpec | Owns agreed behavior, requirements, and done criteria |
| Beads (`bd`) | Owns durable task tracking and dependency state (prefix: BEADSPEC) |
| Ruflo | Owns cross-session memory and background workers |

## OpenSpec

Use OpenSpec before implementation when a change affects Tauri command signatures, public API shape, user-visible behavior, data model, or acceptance criteria.

```bash
openspec list
openspec show <change-id>
openspec validate <change-id>
openspec status --change <change-id>
```

## Skill family selection

Two parallel OpenSpec skill families exist. Prefer `openspec-*` unless directed otherwise:

| Family | When to use |
|--------|-------------|
| `openspec-*` | Production path — stable, fully integrated with Beads + Ruflo memory |
| `opsx:*` | Experimental variants — newer UX, same underlying workflow; use when the user explicitly invokes `/opsx:*` |

Never mix families mid-change. If you start with `openspec-beads-work`, finish with `openspec-beads-complete`.

## Parallelism: Agent tool vs ruflo-swarm

**Default:** built-in `Agent` tool with parallel calls (single message, multiple tool-use blocks). Use for ~90% of multi-task work: research, exploration, parallel test runs, independent file edits.

**Escalate to `ruflo-swarm-dispatch` skill only when:**
- Subtasks must reach **consensus** (e.g., agree on a refactor approach across 3 files)
- Subtasks share **intermediate results** (one agent's output feeds another's implementation)
- Subtasks edit **overlapping artifacts** that would conflict if modified independently

Do NOT use `ruflo-swarm` for pure exploration, independent research, or single-agent-capable work.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `ruflo memory store -k "<key>" -v "<value>"` for persistent knowledge — `bd remember` and MEMORY.md files are deprecated

### Worktree Setup

- Create new worktrees with `scripts/create-worktree.sh <path> --branch <branch>` instead of raw `git worktree add`.
- If a worktree was created manually, run `scripts/setup-worktree-beads.sh` before any `bd` command.

### MANDATORY: Tag every Beads issue with branch / worktree / repo

Every `bd create` **must** be followed by tagging with context labels.

**Recommended — use the helper (idempotent, handles fallbacks):**

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
. "${REPO_ROOT}/scripts/openspec-beads/context.sh"
obws_tag_context <id>              # applies branch/worktree/repo labels
obws_tag_change  <id> <change-id>  # applies openspec:<change-id> label (in-scope issues only)
```

**Manual fallback (for hooks/scripts outside the skill context):**

```bash
source ~/.claude/ruflo/lib/tags.sh
PREFIX=$(ruflo_key_prefix)
BRANCH_LABEL=$(echo "$PREFIX"   | awk -F'|' '{print $1}')
WORKTREE_LABEL=$(echo "$PREFIX" | awk -F'|' '{print $2}')
REPO_LABEL=$(echo "$PREFIX"     | awk -F'|' '{print $3}')
bd tag <new-issue-id> "$BRANCH_LABEL"
bd tag <new-issue-id> "$WORKTREE_LABEL"
bd tag <new-issue-id> "$REPO_LABEL"
```

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** — Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) — Tests, linters, builds
3. **Update issue status** — Close finished work, update in-progress items
4. **PUSH TO REMOTE** — This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** — Clear stashes, prune remote branches
6. **Verify** — All changes committed AND pushed
7. **Hand off** — Provide context for next session

**CRITICAL RULES:**

- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing — that leaves work stranded locally
- NEVER say "ready to push when you are" — YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->

## Memory

All persistent context lives in AgentDB. Do NOT use `bd memories add`, `bd recall`, `bd forget`, `bd kv`, or `MEMORY.md` files for agent context — use `ruflo memory store`.

**Canonical key schema:** `<branch|worktree|repo>|openspec:<change-id>|issue:<issue-id>|type:<type>|outcome:<outcome>|ts:<unix>`
Allowed `type` values: `trajectory`, `retrospective`, `followup-triage`, `scope-change`, `paused`.

**Recommended — use the helper (enforces canonical schema):**

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
. "${REPO_ROOT}/scripts/openspec-beads/memory.sh"
obws_mem_write "<change-id>" "<issue-id>" "<type>" "<outcome>" "<body>"
obws_mem_search_change "<change-id>"   # recall all entries for a change
obws_mem_search_issue  "<issue-id>"    # recall all entries for an issue
```

**Direct CLI (for scripts outside the skill context):**

```bash
source ~/.claude/ruflo/lib/tags.sh
ruflo memory store -k "$(ruflo_key_prefix)|openspec:<change>|issue:<id>|type:<type>|outcome:<outcome>|ts:$(date +%s)" -v "<content>"
ruflo memory search -q "<query>"
```

The `openspec-beads-work` skill automatically recalls relevant memory on claim and writes trajectory on close. The `openspec-beads-resume` skill uses `obws_mem_search_issue` to recover pause context across session boundaries.

## Quality Gate Hooks

Stack-specific hooks (`no-any.sh`, `no-mock-module.sh`, `tdd-nudge.sh`, `typecheck.sh`, `eslint-fix.sh`) are **wired by default** in `.claude/settings.json`. If your project doesn't use TypeScript/ESLint, comment out the corresponding matchers in `.claude/settings.json`.

