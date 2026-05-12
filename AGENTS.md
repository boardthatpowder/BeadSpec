# Agent Workflow Guide — Beads UI

Beads UI is a Tauri 2.0 desktop application (Rust + React/TypeScript) for managing Beads issue-tracking projects. It reads Dolt SQL directly, writes via the `bd` CLI, and syncs in real time via `dolt_log()` polling.

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
| Beads (`bd`) | Owns durable task tracking and dependency state (prefix: BUI) |
| Ruflo | Owns cross-session memory and background workers |
| GitNexus | Owns code graph, impact analysis, and symbol-aware refactors |

## OpenSpec

Use OpenSpec before implementation when a change affects Tauri command signatures, public API shape, user-visible behavior, data model, or acceptance criteria.

Prefer the `openspec-*` skill family. Use `opsx:*` commands only when explicitly requested. Never mix families mid-change.

```bash
openspec list
openspec show <change-id>
openspec validate <change-id>
openspec status --change <change-id>
```

<!-- BEGIN BEADS INTEGRATION v:1 profile:beads-ui hash:workflow-beads-ui -->
## Beads

Issue prefix: `BUI`. Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists. Run `bd prime` at session start.

```bash
bd ready
bd show <id>
bd update <id> --claim
bd close <id> --reason "<summary>"
bd blocked
bd dolt push
```

Every `bd create` must be tagged immediately with branch, worktree, and repo labels:

```bash
source ~/.claude/ruflo/lib/tags.sh
PREFIX=$(ruflo_key_prefix)
bd tag <id> "$(echo "$PREFIX" | awk -F'|' '{print $1}')"
bd tag <id> "$(echo "$PREFIX" | awk -F'|' '{print $2}')"
bd tag <id> "$(echo "$PREFIX" | awk -F'|' '{print $3}')"
```

Verify with `bd show <id>` — LABELS must include all three before the issue is considered ready.

## Ruflo

Persistent memory goes through Ruflo AgentDB. Do not use `bd remember` or write `MEMORY.md` files for cross-session state.

```bash
source ~/.claude/ruflo/lib/tags.sh
KEY="$(ruflo_key_prefix)|type:<type>|ts:$(date +%s)"
ruflo memory store -k "$KEY" -v "<content>"
ruflo memory search -q "<semantic query>"
```

Never run `ruflo init` in this repository.

## GitNexus

Use GitNexus before risky symbol edits:

- Run impact analysis before editing an existing Rust function, React component, or Tauri command.
- Warn the user before proceeding if impact analysis reports HIGH or CRITICAL risk.
- Use `gitnexus_rename` or `npx gitnexus rename` for renames; do not use find-and-replace.
- Run GitNexus change detection before committing when code changes touch indexed symbols.

```bash
npx gitnexus analyze
npx gitnexus impact <symbol>
npx gitnexus detect-changes
```

## Key Architecture Rules

- **Reads**: always via `sqlx` / `mysql_async` direct to Dolt SQL — never through `bd` CLI for reads
- **Writes**: always via `bd` CLI — preserves ID assignment, hooks, label normalization
- **Label prefix parsing**: split on **first colon only** (`url:https://...` → prefix `url`, value `https://...`)
- **IPC**: never call raw `invoke()` strings — always use the `specta`/`tauri-specta` generated typed wrappers
- **Multi-project**: one `sqlx::Pool` per project path — no shared singleton
- **Keyboard shortcuts**: always use `react-hotkeys-hook` with platform detection, never hardcode Cmd or Ctrl

## Session Completion

Before calling work complete:

1. Tick the `tasks.md` checkbox for completed tasks (`- [x]`).
2. Run `cargo test` and `bun test` (or explain why not applicable).
3. Close related Beads issues with `bd close`.
4. Commit and push:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```

Work is NOT complete until `git push` succeeds.
<!-- END BEADS INTEGRATION -->
