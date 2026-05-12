# BeadSpec

> A native desktop GUI for the [Beads](https://github.com/gastownhall/beads) issue tracker — visualize dependencies, track velocity, and browse OpenSpec changes without leaving your workflow.

[![CI](https://github.com/boardthatpowder/BeadSpec/actions/workflows/ci.yml/badge.svg)](https://github.com/boardthatpowder/BeadSpec/actions/workflows/ci.yml)
[![Latest Release](https://img.shields.io/github/v/release/boardthatpowder/BeadSpec)](https://github.com/boardthatpowder/BeadSpec/releases/latest)
[![License](https://img.shields.io/badge/license-MIT%20OR%20Apache--2.0-blue)](#license)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey)](#install)
[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%202-24C8DB)](https://tauri.app/)

<!-- TODO: add a hero screenshot or GIF here once the app is running in CI -->
<!-- ![BeadSpec screenshot](docs-site/public/screenshots/main.png) -->

---

## Why BeadSpec?

- **See the whole picture** — dependency graphs, velocity charts, and smart views that would take dozens of `bd` commands to reconstruct mentally.
- **Stay in flow** — a global quick-capture shortcut and system tray let you log issues without switching apps.
- **Spec-first** — browse OpenSpec change proposals and their implementation status directly inside the app, keeping design and code in sync.

BeadSpec is a frontend. The `bd` CLI remains the source of truth — BeadSpec reads Dolt SQL directly for speed and writes through `bd` to preserve its hook logic, ID assignment, and branch tracking.

---

## Features

| Feature | Description |
|---|---|
| Task list | Grouped, filtered, virtualized issue list with inline editing |
| Dependency graph | Interactive visual graph (React Flow + Cytoscape.js) |
| Smart views | Saved filter queries with live counts |
| Velocity / burndown | Charts showing throughput over time (Recharts) |
| OpenSpec browser | Browse in-flight change proposals and spec status |
| Quick capture | Global keyboard shortcut opens a floating issue-creation window |
| System tray | Access recent issues and quick capture from the menu bar |
| Markdown editor | Rich description editor (TipTap) with task lists and code blocks |
| Real-time sync | Auto-refreshes via `dolt_log()` polling — no manual refresh needed |
| Multi-project | Switch between Beads repos; each gets its own isolated connection |
| Keyboard shortcuts | Platform-aware (Cmd on macOS, Ctrl elsewhere) throughout |
| Recovery dialog | Detects and recovers from Dolt server crashes automatically |
| Settings | Override `bd` binary path, adjust density, configure appearance |

---

## Install

Download the latest installer from the [Releases page](https://github.com/boardthatpowder/BeadSpec/releases/latest):

| Platform | File |
|---|---|
| macOS (Apple Silicon + Intel universal) | `.dmg` |
| Windows | `.msi` or `.exe` |
| Linux | `.AppImage`, `.deb`, or `.rpm` |

**Before launching BeadSpec, install `bd`** — it provides the database layer (`dolt` is provisioned automatically by `bd` on first run):

| Platform | Command |
|---|---|
| macOS | `brew install bd` |
| Linux | Download from the [Beads releases page](https://github.com/gastownhall/beads/releases) and add to `$PATH` |
| Windows | Download `bd.exe` from the [Beads releases page](https://github.com/gastownhall/beads/releases) and add to `%PATH%` |

> **macOS Gatekeeper note**: unsigned builds will be blocked on first open. Right-click the `.app` → **Open** → **Open** to bypass it. Or: `xattr -d com.apple.quarantine /Applications/BeadSpec.app`

If BeadSpec can't find `bd` on launch, a setup dialog appears where you can specify the path manually.

---

## Quick Start

1. Install `bd` (see above) and initialize a Beads repo:
   ```bash
   mkdir my-project && cd my-project
   bd init
   ```

2. Launch BeadSpec and open the project folder when prompted.

3. Your issues, dependencies, and views appear immediately. Use `bd` in the terminal for scripting and automation; use BeadSpec for visual work.

---

## Relationship with `bd`

BeadSpec is a **visual frontend** for `bd`. It does not replace the CLI — they coexist:

| Operation | How |
|---|---|
| Creating / editing issues | BeadSpec calls `bd` under the hood (preserves hooks + ID logic) |
| Querying / filtering | BeadSpec reads Dolt SQL directly (fast, no CLI overhead) |
| Scripting / automation | Use `bd` directly in the terminal |
| Branching / merging | Use `bd` (BeadSpec shows the result) |

You always need `bd` installed. Everything `bd` can do in the terminal, BeadSpec can show visually — but they are additive, not mutually exclusive.

See [Relationship with bd](https://boardthatpowder.github.io/BeadSpec/guide/relationship-with-bd) in the docs for a full feature-parity table.

---

## Documentation

Full documentation is at **[boardthatpowder.github.io/BeadSpec](https://boardthatpowder.github.io/BeadSpec)** and includes:

- [Installation guide](https://boardthatpowder.github.io/BeadSpec/guide/installation) — platform-specific notes
- [Quick start](https://boardthatpowder.github.io/BeadSpec/guide/quick-start)
- [Feature guides](https://boardthatpowder.github.io/BeadSpec/guide/features/task-list)
- [Keyboard shortcuts](https://boardthatpowder.github.io/BeadSpec/guide/keyboard-shortcuts)
- [Troubleshooting](https://boardthatpowder.github.io/BeadSpec/guide/troubleshooting)
- [Contributing guide](https://boardthatpowder.github.io/BeadSpec/contributing/)

---

## Building from Source

### Prerequisites

- [Rust stable](https://rustup.rs/)
- [Bun](https://bun.sh/)
- Platform toolchain:
  - **macOS**: `xcode-select --install`
  - **Windows**: Visual Studio 2022 Build Tools (C++ workload)
  - **Linux (Ubuntu 22.04)**:
    ```bash
    sudo apt-get install libwebkit2gtk-4.1-dev libssl-dev libayatana-appindicator3-dev \
      librsvg2-dev libgtk-3-dev patchelf build-essential
    ```

### Build

```bash
bun install
bun run tauri build

# macOS universal binary (Apple Silicon + Intel):
bun run tauri build --target universal-apple-darwin
```

Installers land in `src-tauri/target/release/bundle/`.

### Development

```bash
bun run tauri dev    # Full Tauri dev with hot-reload
bun run dev          # Vite dev server only (no Tauri shell)
bun run typecheck    # TypeScript check
bun run lint         # ESLint
bun run gen-bindings # Regenerate IPC bindings from Rust
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full contributor guide.

---

## Project Workflow

BeadSpec uses **OpenSpec** for agreed behavior specs and **Beads** (`bd`) for task tracking — both are committed to this repository:

- `openspec/specs/` — canonical feature specifications
- `openspec/changes/` — in-flight change proposals
- `.beads/` — Beads issue database (version-controlled; do not delete)

Contributors working with these tools: see [Contributing / OpenSpec Workflow](https://boardthatpowder.github.io/BeadSpec/contributing/openspec-workflow) in the docs.

---

## IDE Setup

[VS Code](https://code.visualstudio.com/) with:
- [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

---

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) first. For security issues, see [SECURITY.md](SECURITY.md).

---

## License

BeadSpec is dual-licensed under your choice of:

- [MIT License](LICENSE-MIT)
- [Apache License, Version 2.0](LICENSE-APACHE)

See [LICENSE](LICENSE) for details.

---

## Acknowledgements

- [Tauri](https://tauri.app/) — the app shell
- [Beads / bd](https://github.com/gastownhall/beads) — the issue tracker and database engine
- [Dolt](https://github.com/dolthub/dolt) — the Git-for-data SQL database powering Beads
