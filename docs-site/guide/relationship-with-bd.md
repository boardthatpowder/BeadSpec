# Relationship with bd

BeadSpec is a **visual frontend** for the `bd` CLI. They are additive, not mutually exclusive — you need `bd` installed to use BeadSpec.

## Architecture

```
┌─────────────────────────────────────────┐
│                BeadSpec                  │
│  (React/TypeScript frontend)             │
│  (Rust/Tauri backend)                    │
│                                          │
│  Reads  ──────────── Dolt SQL (sqlx)    │
│  Writes ──────────── bd CLI             │
└─────────────────────────────────────────┘
                │
                ▼
        .beads/  (Dolt database)
                │
                ▼
         bd CLI  (writes, hooks)
```

**Reads** go directly to the Dolt SQL server via `sqlx`. This is fast and avoids CLI overhead — BeadSpec can query thousands of issues without spawning a process.

**Writes** always go through the `bd` CLI. This preserves:
- `bd` hook logic (pre/post-write automation)
- ID assignment (`BEADSPEC-001`, `BEADSPEC-002`, ...)
- Label normalization
- Dolt branch tracking and commit history

## Feature Parity Table

| Task | Terminal (`bd`) | BeadSpec GUI |
|---|---|---|
| Create an issue | `bd create --title="..."` | Press `N` or use Quick Capture |
| Edit an issue | `bd update <id> --title="..."` | Click field inline |
| Close an issue | `bd close <id>` | Click status → Closed |
| View issues | `bd list` | Task list with filters |
| Filter by status | `bd list --status=open` | Filter bar |
| Dependency graph | `bd dep list <id>` | Dependency tab / graph |
| Health checks | `bd doctor`, `bd preflight`, etc. | Health view → Checks tab |
| Formulas | `bd formula list`, `bd mol pour` | Health view → Formulas tab |
| Human queue | `bd human list/respond/dismiss` | Human queue chip |
| OpenSpec browser | `openspec list` | Changes view (optional) |
| Quick issue entry | — | Quick Capture window |
| Scripting / CI | Yes | No |
| Hooks | Yes | Delegated to `bd` |
| Branch operations | `bd dolt branch` | No |
| Merge / push | `bd dolt push` | No |

## What BeadSpec adds

BeadSpec adds visual workflows that would require many CLI commands to reconstruct manually:

- **Dependency graph** — see all issue relationships at once
- **Real-time sync** — changes from `bd` in the terminal appear in BeadSpec within seconds
- **Workspace tabs** — open multiple issues side-by-side in a split-pane layout
- **Health dashboard** — run all `bd` diagnostics in one click and see results at a glance
- **OpenSpec browser** — design specs and their implementation status side-by-side (optional)
- **Quick Capture** — create issues without switching from your current app

## When to use which

Use **`bd` in the terminal** when:
- Scripting or automating issue management
- Working in CI/CD pipelines
- Running branch operations (push, pull, merge)
- Bulk operations with shell piping

Use **BeadSpec** when:
- Reviewing all issues and their relationships visually
- Doing sprint planning with the dependency graph open
- Running health checks across the project
- Capturing quick ideas with the global shortcut
- Reviewing an OpenSpec change and its associated issues together

Both tools read from and write to the same `.beads/` database. Any change made in the terminal is visible in BeadSpec within seconds.
