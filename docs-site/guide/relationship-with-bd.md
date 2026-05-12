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
- ID assignment (`BUI-001`, `BUI-002`, ...)
- Label normalization
- Dolt branch tracking and commit history

## Feature Parity Table

| Task | Terminal (`bd`) | BeadSpec GUI |
|---|---|---|
| Create an issue | `bd create --title="..."` | Click **+** or press `N` |
| Edit an issue | `bd update <id> --title="..."` | Click field inline |
| Close an issue | `bd close <id>` | Click status → Closed |
| View issues | `bd list` | Task list with filters |
| Filter by status | `bd list --status=open` | Filter bar |
| Dependency graph | `bd dep list <id>` | Graph tab |
| Smart views | `bd list --filter=...` | Smart Views panel (saved) |
| Velocity chart | — | Velocity tab |
| OpenSpec browser | `openspec list` | Changes tab |
| Quick issue entry | — | Quick Capture window |
| Scripting / CI | Yes | No |
| Hooks | Yes | Delegated to `bd` |
| Branch operations | `bd dolt branch` | No |
| Merge / push | `bd dolt push` | No |

## What BeadSpec adds

BeadSpec adds visual workflows that would require many CLI commands to reconstruct manually:

- **Dependency graph** — see all issue relationships at once
- **Real-time sync** — changes from `bd` in the terminal appear in BeadSpec within seconds
- **Smart views** — save named filter queries and jump to them instantly
- **Velocity charts** — throughput over time without writing shell scripts
- **OpenSpec browser** — design specs and their implementation status side-by-side
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
- Tracking velocity over time
- Capturing quick ideas with the global shortcut
- Reviewing an OpenSpec change and its associated issues together

Both tools read from and write to the same `.beads/` database. Any change made in the terminal is visible in BeadSpec within seconds.
