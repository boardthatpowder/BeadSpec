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
│   ├── lib/ utils/       # Helpers and utilities
│   ├── bindings.ts       # Generated Tauri IPC types (DO NOT EDIT MANUALLY)
│   ├── ipc.ts            # IPC wrapper
│   ├── App.tsx           # Root component
│   └── quick-capture.tsx # Separate entry for the Quick Capture window
│
├── src-tauri/            # Rust Tauri backend
│   ├── src/
│   │   ├── bd/           # bd CLI discovery and runner
│   │   ├── commands/     # Tauri IPC command handlers
│   │   ├── db/           # Dolt server lifecycle, sqlx pools, watchers
│   │   ├── notifications/ # Notification manager
│   │   ├── tray/         # System tray
│   │   ├── settings.rs   # App settings persistence
│   │   └── lib.rs        # Tauri setup and plugin registration
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

### Keyboard shortcuts

Use `react-hotkeys-hook` with platform detection. Never hardcode `Ctrl` or `Cmd` — use the `mod` modifier provided by the library, which maps to `Cmd` on macOS and `Ctrl` elsewhere.

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
| Charts | Recharts |
| Drag and drop | dnd-kit |
| Keyboard shortcuts | `react-hotkeys-hook` |
| Error types | `thiserror` |
| File watching | `notify` |
| Process enumeration | `sysinfo` |
