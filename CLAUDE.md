# Project Instructions for AI Agents

This file provides instructions and context for AI coding agents working on this project.

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
- If a worktree was created manually, run `scripts/setup-worktree-beads.sh` before any `bd` command. This links ignored Beads runtime files to the main checkout so all worktrees share the same Dolt database.

### MANDATORY: Tag every Beads issue with branch / worktree / repo

Every `bd create` (epics, child tasks, follow-ups, scope changes, bugs) **must** be followed by tagging with the standard context labels so future sessions can filter cleanly and a worktree's work doesn't bleed across siblings:

```bash
source ~/.claude/ruflo/lib/tags.sh
PREFIX=$(ruflo_key_prefix)
# PREFIX format: branch:<name>|worktree:<name>|repo:<name>
BRANCH_LABEL=$(echo "$PREFIX"   | awk -F'|' '{print $1}')
WORKTREE_LABEL=$(echo "$PREFIX" | awk -F'|' '{print $2}')
REPO_LABEL=$(echo "$PREFIX"     | awk -F'|' '{print $3}')

bd tag <new-issue-id> "$BRANCH_LABEL"
bd tag <new-issue-id> "$WORKTREE_LABEL"
bd tag <new-issue-id> "$REPO_LABEL"
# Plus any domain-specific label (e.g., openspec:<change-id>) — never the only labels.
```

Verify with `bd show <id>` — the `LABELS:` line must contain all three context labels. The `openspec-beads-import`, `openspec-beads-followup`, and `openspec-beads-scope-change` skills already do this; if you create issues outside those skills (any ad-hoc `bd create`), you must tag manually.

Filter by branch later: `bd list --label "branch:<name>"`.

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

## Build & Test

```bash
bun install           # Install dependencies
bun run typecheck     # TypeScript type check (tsc --noEmit)
bun test              # All tests (Vitest)
bun run test:unit     # Unit tests only
bun run lint          # ESLint
bun run lint:fix      # ESLint + auto-fix
cargo test            # Rust tests (src-tauri/)
cargo clippy          # Rust lints
```

## Architecture Overview

BeadSpec is a Tauri 2.0 desktop app (Rust backend + React/TypeScript frontend) for managing Beads issue-tracking projects.

```
React UI → Tauri IPC (specta bindings) → Rust commands → Dolt SQL (sqlx/mysql_async)
                                                        ↕ bd CLI (write path)
Real-time: dolt_log() poll every 2s → Tauri events → TanStack Query cache invalidation
```

Key directories: `src/` (React), `src-tauri/src/` (Rust), `openspec/` (specs + changes), `.beads/` (issue DB).

## Conventions & Patterns

- **Package manager:** Bun (not npm/pnpm)
- **State:** TanStack Query (server state) + Zustand (UI state) + Tauri events (cross-window)
- **IPC:** specta + tauri-specta auto-generate TypeScript bindings from Rust — never hand-write command types
- **Label parsing:** Split on first colon only (e.g. `openspec:change-id` not `a:b:c`)
- **Feature branches:** Always open a PR; never push directly to `main`
- **Issue tracking:** All follow-up work goes to Beads (`bd create`) — no ad-hoc TODO comments

## OpenSpec CLI

**`openspec` is installed globally.** Use it directly without npx:

```bash
openspec list                    # List active changes
openspec show <change-id>        # Show change details
openspec validate <change-id>    # Validate spec deltas
openspec status --change <id>    # Show detailed status of one change
```

**DO NOT use `npx @anthropic-ai/openspec` or any other package prefix** — just use `openspec` directly.

**Skill family rule:** Prefer the `openspec-*` skill family. Use `opsx:*` only when explicitly requested; do not mix skill families within the same change.

## References

- `docs/developers/openspec-beads-runbook.md` — End-to-end developer workflow runbook (OpenSpec + Beads + Ruflo + GitNexus)
- `openspec/specs/` — Canonical spec capabilities (23 specs)
- `openspec/changes/` — Active feature changes

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **BeadSpec** (5545 symbols, 8288 relationships, 277 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/BeadSpec/context` | Codebase overview, check index freshness |
| `gitnexus://repo/BeadSpec/clusters` | All functional areas |
| `gitnexus://repo/BeadSpec/processes` | All execution flows |
| `gitnexus://repo/BeadSpec/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->

## Ruflo (Memory + Workers + Swarm)

### Memory — single source of truth: AgentDB

ALL persistent context goes to AgentDB (WASM SQLite via ruflo). Do NOT use:
- `bd remember` (deprecated — use `ruflo memory store`)
- `MEMORY.md` files
- memory MCP servers (uninstalled: `mcp__memory__*`, `mcp__plugin_claude-mem_*`)

**Key naming convention** — every write uses a pipe-delimited structured key:

```bash
source ~/.claude/ruflo/lib/tags.sh
KEY="$(ruflo_key_prefix)|openspec:<change>|issue:<id>|type:trajectory|ts:$(date +%s)"
ruflo memory store -k "$KEY" -v "<content>"
ruflo memory search -q "<semantic query>"
```

Helper: `source ~/.claude/ruflo/lib/tags.sh && ruflo_key_prefix`
Emits: `branch:<name>|worktree:<name>|repo:<name>`

Skills `openspec-beads-work`, `-followup`, `-complete` auto-recall on claim and auto-write on close.

### Background workers (report-only, branch-tagged)

Workers run as Claude Code session commands — they are **not** OS cron jobs.
Invoke them as slash commands; use `/ruflo-schedule` to register persistent `CronCreate` entries.

| Worker | Slash command | What it does |
|--------|--------------|-------------|
| Security audit | `/audit` or `/ruflo-schedule audit` | CVE scan + security report |
| Test gap detector | `/ruflo-loop testgaps` | Missing test coverage |
| Cost tracking | `/ruflo-cost` or `/cost report` | Token cost breakdown |

Workers NEVER commit or modify code.
Worker findings → Beads via `~/.claude/ruflo/hooks/on-finding.sh`. Triage with `openspec-beads-followup`.

### Swarm vs built-in Agent parallelism

Default: built-in `Agent` tool with parallel calls (standard Claude Code behavior).
Escalate to `ruflo-swarm` only when subtasks need consensus, shared state, or edit overlapping files.
See `ruflo-swarm-dispatch` skill for the exact decision rule.

### Plugins NOT to install (conflicts with this stack)

ruflo-sparc, ruflo-goals, ruflo-adr, ruflo-ddd, ruflo-knowledge-graph, ruflo-jujutsu,
ruflo-browser, ruflo-testgen, ruflo-aidefence, ruflo-federation, ruflo-rvf, ruflo-ruvllm,
ruflo-ruvector, ruflo-wasm, ruflo-migrations, ruflo-observability, ruflo-docs, ruflo-daa,
ruflo-plugin-creator, ruflo-workflows, ruflo-iot-cognitum, ruflo-neural-trader, ruflo-market-data.

### Custom hooks remain authoritative

TDD hooks (`.claude/hooks/*.sh`) and GitNexus hooks run BEFORE any Ruflo hook. They are synchronous gates and remain the source of truth for code quality. Ruflo's role is async observation, learning, and background scanning — not enforcement.

### CRITICAL: Never run `ruflo init` in this project directory

`ruflo init` creates 116 files that would overwrite `.claude/` settings, skills, and agents.
Use only: `npx ruflo@latest memory store/search/retrieve`, plus plugin slash commands (`/audit`, `/ruflo-loop`, `/ruflo-schedule`, `/ruflo-cost`).
Plugin install via `/plugin install ruflo-*@ruflo` is the correct onboarding path.
