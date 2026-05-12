# Architecture

BeadSpec is a [Tauri 2](https://tauri.app/) application — a native desktop shell embedding a WebView for the frontend.

## Directory layout

```
beadspec/
├── src/                  # React/TypeScript frontend
│   ├── components/       # React components
│   ├── contexts/         # React context providers (Settings, HashState, Density)
│   ├── hooks/            # Custom React hooks (TanStack Query wrappers)
│   ├── stores/           # Zustand UI state stores
│   │   ├── workspace.ts      # Multi-tab/pane workspace state
│   │   ├── settingsStore.ts  # App settings (persisted via @tauri-apps/plugin-store)
│   │   └── zoomStore.ts      # Zoom level
│   ├── lib/ utils/       # Helpers and utilities
│   │   └── paneTree.ts       # Pane tree data structure (split, close, move)
│   ├── bindings.ts       # Generated Tauri IPC types (DO NOT EDIT MANUALLY)
│   ├── ipc.ts            # IPC wrapper
│   ├── App.tsx           # Root component (main window)
│   └── QuickCaptureApp.tsx # Separate entry for the Quick Capture window
│
├── src-tauri/            # Rust Tauri backend
│   ├── src/
│   │   ├── bd/           # bd CLI discovery and runner
│   │   ├── commands/     # Tauri IPC command handlers
│   │   │   ├── app.rs        # Focus, tray badge, zoom, shortcuts
│   │   │   ├── openspec.rs   # OpenSpec integration commands
│   │   │   └── recovery.rs   # Dolt health probe and recovery
│   │   ├── db/           # Dolt server lifecycle, sqlx pools, watchers, poller
│   │   ├── notifications/ # Notification manager
│   │   ├── recovery_log.rs # Recovery event log
│   │   ├── tray/         # System tray
│   │   ├── settings.rs   # App settings persistence
│   │   └── lib.rs        # Tauri setup, plugin registration, command registration
│   └── tauri.conf.json   # Tauri configuration
│
├── openspec/             # OpenSpec feature specs and in-flight changes
│   ├── specs/            # One directory per feature area
│   └── changes/          # In-flight change proposals
│
├── .beads/               # Beads issue database (version-controlled)
└── docs-site/            # VitePress documentation site (this site)
```

## Core architectural rules

### Read/write split

- **Reads** — all data queries go directly to the Dolt SQL server via `sqlx` / `mysql_async`. Never shell out to `bd` for reads.
- **Writes** — all mutations go through the `bd` CLI. This preserves `bd` hook logic, ID assignment, label normalization, and Dolt branch tracking.

### IPC

BeadSpec uses `specta` + `tauri-specta` to auto-generate typed TypeScript bindings from the Rust command signatures. The generated file is `src/bindings.ts`.

**Rule**: never call `invoke()` with a raw string. Always use the typed wrappers from `src/bindings.ts`. After any change to a `#[tauri::command]` signature, run:

```bash
bun run gen-bindings
```

and commit the updated `src/bindings.ts`.

### Multi-project isolation

Each Beads project gets its own `sqlx::Pool` and Dolt server instance. There is no global pool singleton. The project path is the key used to look up or create a pool.

### Real-time sync

`src-tauri/src/db/watchers.rs` polls `dolt_log()` on a 2-second interval. When the log changes, it emits a Tauri event. TanStack Query on the frontend responds by invalidating relevant queries, triggering a refetch. No WebSocket or SSE — just polling.

### Workspace pane tree

`src/utils/paneTree.ts` implements a binary tree of panes. Each node is either a `SplitPane` (horizontal or vertical, with two children) or a `LeafPane` (a list of tabs). The `workspace.ts` Zustand store drives the tree — split, close, move, and reorder operations all produce a new tree that React renders.

Layout is persisted to `layout.json` via `workspacePersist.ts` and restored on boot.

### Settings persistence

`src/stores/settingsStore.ts` uses `@tauri-apps/plugin-store` to persist settings to `settings.json` in the app config directory. Settings include:
- `features.openspec` / `features.ruflo` — feature flag toggles
- `binaryPaths.bd/openspec/ruflo/dolt` — path overrides
- `actor` — identity for Focus view
- `quickCaptureShortcut` — global shortcut string
- `density` / `zoom` — appearance
- `tooltips` — tooltip behavior
- `notificationPrefs` — notification toggles

### Keyboard shortcuts

Use `react-hotkeys-hook` with platform detection. Never hardcode `Ctrl` or `Cmd` — use the `mod` modifier provided by the library, which maps to `Cmd` on macOS and `Ctrl` elsewhere.

## IPC command surface

Commands are registered in `src-tauri/src/lib.rs`. Grouped by domain:

**Writes (via bd CLI)**
`create_task`, `update_task_field`, `change_task_status`, `add_label`, `remove_label`, `add_comment`, `delete_task`, `link_dependency`, `unlink_dependency`

**Reads (via Dolt SQL)**
`list_tasks`, `get_task`, `get_task_history`, `search_tasks`

**Project management**
`connect_project`, `disconnect_project`, `list_projects`

**App / window**
`focus_main_window`, `update_tray_badge`, `set_start_at_login` *(stub — not yet implemented)*, `launch_to_tray`, `get_shortcut_status`, `register_quick_capture_shortcut`, `validate_binary_path`

**Recovery**
`probe_dolt_health`, `attempt_dolt_recovery`

**External bd tools**
`bd_preflight`, `bd_doctor`, `bd_lint`, `bd_stale`, `bd_orphans`, `bd_formula_list`, `bd_formula_pour`, `bd_human_list`, `bd_human_respond`, `bd_human_dismiss`

**Ruflo (optional)**
`ruflo_memory_search`, `ruflo_version_probe`

**Workspace context**
`get_workspace_context`, `get_git_refs_for_issue`, `get_dolt_history_for_issue`

**OpenSpec (optional)**
`list_changes`, `read_change_artifact`, `get_change_progress`, `run_openspec_validate`, `import_change_to_beads`, `reconcile_openspec_checkboxes`

## Technology stack

| Layer | Technology |
|---|---|
| App shell | Tauri 2.0 |
| Rust backend | `sqlx`, `specta`, `tauri-specta`, `tokio` |
| IPC bindings | Auto-generated via `specta` / `tauri-specta` |
| Frontend | React 19, TypeScript, Vite 7 |
| Server state | TanStack Query |
| UI state | Zustand |
| Styling | Tailwind CSS 4 |
| Rich text | TipTap 3 |
| Graphs | React Flow + Cytoscape.js |
| Drag and drop | dnd-kit |
| Keyboard shortcuts | `react-hotkeys-hook` |
| Error types | `thiserror` |
| File watching | `notify` |
| Process enumeration | `sysinfo` |
