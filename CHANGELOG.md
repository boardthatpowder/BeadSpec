# Changelog

All notable changes to BeadSpec are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Releases use [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.3] - 2026-05-13

### Fixed
- OpenSpec Changes card now counts Beads progress server-side, so deferred, blocked, and closed issues are no longer silently dropped by the global UI status filter. The `imported → ID` pill also survives the status filter.

## [0.1.0] - 2026-05-11

### Added
- Task list with grouping, filtering, and virtualized rendering
- Dependency graph (React Flow + Cytoscape.js)
- Smart views — saved filtered queries
- Velocity / burndown charts (Recharts)
- OpenSpec change browser — view in-flight specs from inside the app
- Quick capture window — global shortcut for fast issue creation
- System tray with popover
- Dolt server self-recovery dialog
- Real-time sync via `dolt_log()` polling
- Markdown description editor (TipTap)
- Keyboard shortcuts throughout (platform-aware Cmd/Ctrl)
- Settings — `bd` binary path override, density, theme
- Multi-project support — one Dolt pool per project path
- Cross-platform installers — macOS (universal), Windows, Linux

[Unreleased]: https://github.com/boardthatpowder/BeadSpec/compare/v0.1.3...HEAD
[0.1.3]: https://github.com/boardthatpowder/BeadSpec/compare/v0.1.0...v0.1.3
[0.1.0]: https://github.com/boardthatpowder/BeadSpec/releases/tag/v0.1.0
