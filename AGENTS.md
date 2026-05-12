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
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->
