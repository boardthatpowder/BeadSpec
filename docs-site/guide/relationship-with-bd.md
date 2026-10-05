# Relationship with bd

BeadSpec is a **visual frontend** for the `bd` CLI. They are additive, not mutually exclusive — you need `bd` installed to use BeadSpec.

## Architecture

Beads 1.3 or newer is required. BeadSpec starts an app-owned `bd serve` on an ephemeral loopback port for supported projects. Embedded projects use native CLI commands; BeadSpec does not start a separate Dolt sidecar for them.

**Reads and supported writes** use the Beads HTTP API. Native `bd` handles unsupported operations, relevant project hooks, and command-side export, push or backup policies. The default server auto-commit policy allows HTTP writes; direct-server `off` or `batch` policies use CLI writes.

**Live updates** use the optional Beads journal. Open **bd Health** to see transport and journal status, then choose **Enable live updates** to enable it for that project. This changes the project journal configuration and restarts its Beads connection. BeadSpec never enables journaling automatically.

Journal events refresh affected views promptly. Complete state refreshes run every 30 seconds and on focus or manual refresh, including changes made through pull, merge or direct database operations. Embedded journal checks run as finite native commands every two seconds.

**Activity history** is retained per project for up to seven days or 5,000 events. Recent activity may exclude events from before live updates were enabled or outside retained history. Task timelines use native Beads history and comments; the activity feed is not a complete historical database export.

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

Both tools read from and write to the same `.beads/` database. Journaled changes appear promptly; other changes appear on the next complete refresh.
