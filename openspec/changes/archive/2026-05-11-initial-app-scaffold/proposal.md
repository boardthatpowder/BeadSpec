## Why

The VSCode Beads extension provides basic issue management but is locked inside the editor, lacks a dedicated visual experience, and offers no dependency graph, smart views, or real-time sync. A standalone cross-platform desktop app built on Tauri 2.0 gives Beads a first-class UI with the performance, keyboard ergonomics, and "wow factor" the tool deserves.

## What Changes

- **NEW**: Tauri 2.0 desktop application (Rust backend + React/TypeScript frontend) targeting macOS, Windows, and Linux
- **NEW**: Direct Dolt SQL reads via `sqlx`/`mysql_async` (10-100x faster than going through `bd` CLI for reads)
- **NEW**: `bd` CLI invoked for writes only (ID assignment, label normalization, hooks)
- **NEW**: Real-time sync via 2-second `dolt_log()` commit-hash polling with targeted TanStack Query cache invalidation
- **NEW**: Resizable pane layout (top bar + left list + right detail) with persisted sizes and density toggle
- **NEW**: Smart filter bar — auto-parses `prefix:value` labels into independent filter dimensions
- **NEW**: KPI metrics bar — dynamic counts reflecting the active filter set, clickable to set filters
- **NEW**: Full CRUD inline task editing — no modal dialogs; title, status, priority, labels, assignee all click-to-edit
- **NEW**: Rich markdown editor (TipTap) with `/task`, `/code`, `/checklist` slash commands and `bd-` task reference autocomplete
- **NEW**: Interactive dependency graph canvas (React Flow / Cytoscape.js) with pan/zoom, node status encoding, and click-to-navigate
- **NEW**: Activity timeline with field-level diff view between any two history entries
- **NEW**: Command palette (Cmd/Ctrl+K) with fuzzy search across tasks, actions, and views
- **NEW**: Keyboard-first navigation (`j/k`, `Enter`, `Space`, `/`, `Backspace`)
- **NEW**: Bulk operations (shift-click range select + bulk status/label changes)
- **NEW**: Focus/Today view and "Ready to Start" smart view (open tasks with all deps closed)
- **NEW**: Native OS notifications (assignment, unblock, comment) with click-to-open
- **NEW**: Menu bar / system tray mini-app with live task count badge and quick-create
- **NEW**: Multi-project support — one Dolt connection pool per project, project switcher
- **NEW**: Type-safe IPC contract via `specta` + `tauri-specta`
- **NEW**: Filter state encoded in URL hash (deep links, back/forward)
- **NEW**: Breadcrumb navigation for tasks reached via dependency graph traversal

## Capabilities

### New Capabilities

- `data-layer`: Dolt SQL connection pooling, `bd` CLI write wrapper, `dolt_log()` real-time poller, multi-project pool management, typed IPC via specta+tauri-specta
- `layout-shell`: Tauri window, resizable panes, density toggle, multi-project switcher, cross-platform keyboard shortcuts, URL-hash filter state, skeleton loaders, optimistic updates, toast undo
- `task-list`: Smart label prefix filter parsing, status/priority filters, KPI metrics bar, sortable/real-time task list, bulk operations
- `task-detail`: Inline editing, TipTap rich editor with slash commands, task reference autocomplete (`bd-`), activity timeline with diff view, breadcrumb navigation
- `dependency-graph`: React Flow / Cytoscape.js canvas, status-encoded nodes, pan/zoom navigation, real-time updates
- `smart-views`: Command palette, keyboard-first navigation, Focus/Today view, Ready to Start smart view
- `notifications`: Native OS notifications, menu bar / tray mini-app

### Modified Capabilities

_(none — this is a greenfield project)_

## Impact

- **New repo**: `/Users/dean/workspaces/beads-ui` — Tauri 2.0 monorepo (Rust workspace + React frontend)
- **Runtime dependencies**: Tauri 2.0, React 19, TanStack Query, Zustand, TipTap, React Flow, Cytoscape.js, Tailwind CSS, react-hotkeys-hook, specta, tauri-specta, sqlx, mysql_async
- **External dependencies**: `bd` CLI (must be on PATH), Dolt SQL endpoint (embedded via bd)
- **Platforms**: macOS (primary), Windows 10+, Linux (GTK)
- **No existing code to migrate** — greenfield build
