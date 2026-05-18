# Project Context

## Purpose

**BeadSpec** — a Tauri 2.0 desktop app (Rust + React/TypeScript) for managing Beads issue-tracking projects. Provides a GUI over the Dolt-backed Beads database, with real-time sync and full CRUD for issues, dependencies, and labels. Cross-platform: macOS, Windows, Linux.

## Architecture

```
React UI → Tauri IPC (specta bindings) → Rust commands → Dolt SQL (sqlx/mysql_async)
                                                        ↕ bd CLI (write path)
Real-time: dolt_log() poll every 2s → Tauri events → TanStack Query cache invalidation
```

State: TanStack Query (server) + Zustand (UI) + Tauri events (cross-window).
IPC contract: specta + tauri-specta auto-generate TypeScript bindings from Rust types.

## Workflow

- OpenSpec owns requirements, design notes, acceptance criteria, and change archival.
- Beads owns task execution, dependencies, status, and blockers.
- Ruflo owns persistent cross-session memory and background worker findings.
- GitNexus owns code graph analysis, blast-radius checks, and symbol-aware refactors.

## Conventions

- Propose a short plan before editing.
- Keep diffs tight and project-specific.
- Ask before adding production dependencies or changing public APIs.
- Prefer tests for behavior changes; explain when no tests apply.
- Record durable follow-up work in Beads rather than ad hoc TODO lists.
- Run `bun run typecheck` and `cargo clippy` before committing.
