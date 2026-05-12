# Contributing to BeadSpec

Thank you for your interest in contributing. BeadSpec is a desktop GUI for the [Beads](https://github.com/gastownhall/beads) issue tracker. This guide covers everything you need to get your environment running, understand the architecture, and submit a pull request.

Contributions are dual-licensed under MIT and Apache-2.0, matching BeadSpec's own license. By submitting a PR you agree that your contribution is released under both licenses.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Development Setup](#development-setup)
- [Architecture Overview](#architecture-overview)
- [Project Workflow (OpenSpec + Beads)](#project-workflow)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Code Style](#code-style)
- [Getting Help](#getting-help)

---

## Prerequisites

You need the following tools installed before anything else:

| Tool | Why | Install |
|---|---|---|
| [Rust stable](https://rustup.rs/) | Tauri backend | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| [Bun](https://bun.sh/) | JS package manager + scripts | `curl -fsSL https://bun.sh/install \| bash` |
| [bd](https://github.com/gastownhall/beads) | Beads CLI — required at runtime | `brew install bd` (macOS) or download from releases |

**Platform-specific toolchain:**

- **macOS**: `xcode-select --install`
- **Windows**: Visual Studio 2022 Build Tools with the "Desktop development with C++" workload
- **Ubuntu/Debian**:
  ```bash
  sudo apt-get install libwebkit2gtk-4.1-dev libssl-dev libayatana-appindicator3-dev \
    librsvg2-dev libgtk-3-dev patchelf build-essential
  ```

---

## Development Setup

```bash
# 1. Clone
git clone https://github.com/boardthatpowder/BeadSpec.git
cd BeadSpec

# 2. Install JS deps
bun install

# 3. Launch in development mode (hot-reload for both Vite and Rust)
bun run tauri dev
```

Other useful commands:

```bash
bun run dev           # Vite dev server only (no Tauri shell — useful for pure UI work)
bun run typecheck     # TypeScript type check
bun run lint          # ESLint
bun run gen-bindings  # Regenerate src/bindings.ts from Rust (run after any Tauri command change)
cargo test            # Rust unit tests (from src-tauri/)
bun test              # Frontend tests (vitest)
bun run build         # Production frontend build
bun run tauri build   # Full production installer
```

---

## Architecture Overview

BeadSpec uses a **split read/write architecture**:

- **Reads** go directly to Dolt SQL via `sqlx` / `mysql_async`. This is fast and doesn't require shelling out.
- **Writes** go through the `bd` CLI. This ensures `bd` hook logic, ID normalization, and Dolt branch tracking all work correctly.

Key layers:

| Layer | Technology | Location |
|---|---|---|
| App shell | Tauri 2.0 | `src-tauri/` |
| Rust backend | `sqlx`, `specta`, `tauri-specta`, `tokio` | `src-tauri/src/` |
| IPC bindings | Auto-generated via `specta` / `tauri-specta` | `src/bindings.ts` (generated) |
| Frontend | React 19, TypeScript, Vite | `src/` |
| Server state | TanStack Query | `src/hooks/` |
| UI state | Zustand | `src/stores/` |
| Styling | Tailwind CSS 4 | `src/` |
| Rich text | TipTap | `src/components/` |
| Graphs | React Flow + Cytoscape.js | `src/components/` |
| Keyboard shortcuts | `react-hotkeys-hook` (platform-aware Cmd/Ctrl) | `src/hooks/` |

**IPC rule**: never call raw `invoke()` strings. Always use the typed wrappers from `src/bindings.ts`. After changing any Tauri command signature, run `bun run gen-bindings`.

**Multi-project**: one `sqlx::Pool` per project path — there is no global singleton.

---

## Project Workflow

BeadSpec uses **OpenSpec** for agreed behavior and **Beads** (`bd`) for task tracking.

- `openspec/specs/` — canonical behavior specs, one directory per feature area.
- `openspec/changes/` — in-flight change proposals (spec delta + tasks + design decisions).
- `.beads/` — Beads issue database (do not delete this directory; it is version-controlled by design).

If you are making a change that affects a Tauri command signature, public API shape, user-visible behavior, or data model, create an OpenSpec change proposal first. For small bug fixes and typo/doc changes this is not required.

When contributing externally (i.e., you do not have `bd` workflow set up), you can skip Beads tracking. Just describe the change clearly in your PR and the maintainer will link it to the relevant issues.

---

## Making Changes

1. Fork the repository and create a feature branch from `main`.
2. For behavior changes, check `openspec/specs/<feature>/spec.md` to understand the intended behavior before writing code.
3. Implement your change. Keep commits small and atomic.
4. Run the test suite before opening a PR (see [Testing](#testing)).
5. Update or add documentation in `docs-site/` for any user-facing behavior changes.
6. Open a PR against `main`.

---

## Testing

```bash
# TypeScript type safety
bun run typecheck

# Linting (must pass with zero warnings)
bun run lint

# Rust unit tests
cd src-tauri && cargo test

# Frontend unit tests
bun test

# Full build smoke test
bun run build
```

There is no requirement to mock the Dolt database in unit tests — integration tests that exercise `bd` commands or SQL queries should use a real `bd` environment if possible.

---

## Pull Request Guidelines

- **Title**: short, imperative sentence (e.g. "Add keyboard shortcut for quick capture"). Under 72 characters.
- **Description**: explain *why* the change is needed, not just what changed.
- **Scope**: keep PRs focused. One feature / bug fix per PR.
- **Checklist** (in the PR template):
  - [ ] Tests added or explained why not needed
  - [ ] `bun run typecheck` passes
  - [ ] `bun run lint` passes
  - [ ] Documentation updated (if user-facing change)
  - [ ] If IPC command changed: `bun run gen-bindings` run, `src/bindings.ts` committed

---

## Code Style

- **TypeScript**: ESLint config at `eslint.config.js` enforces style. `bun run lint` must pass with `--max-warnings 0`.
- **Rust**: `cargo fmt` and `cargo clippy` (warnings are treated as errors in CI).
- **No comments**: only add a comment when the *why* is non-obvious — a hidden constraint, a workaround for a specific bug, or a subtle invariant. Describe the surprise, not the obvious.
- **No unnecessary abstractions**: three similar lines are better than a premature abstraction.

---

## Getting Help

- **Bugs / feature requests**: open a GitHub Issue.
- **Questions / ideas**: start a GitHub Discussion.
- **Security issues**: see [SECURITY.md](SECURITY.md) — report privately, do not open a public issue.
