# Contributing to BeadSpec

Thank you for your interest in contributing. Before diving in, please read [CODE_OF_CONDUCT.md](https://github.com/boardthatpowder/BeadSpec/blob/main/CODE_OF_CONDUCT.md).

## Quick links

- [Architecture](/contributing/architecture) — how BeadSpec is structured
- [OpenSpec workflow](/contributing/openspec-workflow) — the spec-first contribution process
- [Testing](/contributing/testing) — running tests
- [Release process](/contributing/release-process) — how releases are cut

## Getting the repo running

### Prerequisites

| Tool | Install |
|---|---|
| Rust stable | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| Bun | `curl -fsSL https://bun.sh/install \| bash` |
| bd CLI | `brew install bd` (macOS) or [download](https://github.com/gastownhall/beads/releases) |
| Platform toolchain | See below |

**macOS**: `xcode-select --install`

**Windows**: Visual Studio 2022 Build Tools with C++ workload

**Ubuntu/Debian**:
```bash
sudo apt-get install libwebkit2gtk-4.1-dev libssl-dev libayatana-appindicator3-dev \
  librsvg2-dev libgtk-3-dev patchelf build-essential
```

### Clone and run

```bash
git clone https://github.com/boardthatpowder/BeadSpec.git
cd BeadSpec
bun install
bun run tauri dev
```

## Contribution workflow

1. Fork and create a branch from `main`
2. For behavior changes: check `openspec/specs/<feature>/spec.md` before coding — see [OpenSpec Workflow](/contributing/openspec-workflow)
3. Make your change with small, atomic commits
4. Run the full test suite (see [Testing](/contributing/testing))
5. Update `docs-site/` for any user-facing changes
6. Open a PR against `main`

## License

By contributing to BeadSpec, you agree your contributions are dual-licensed under MIT and Apache-2.0, matching BeadSpec's own license.
