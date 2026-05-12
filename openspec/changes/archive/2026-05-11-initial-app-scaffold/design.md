## Context

Beads UI is a greenfield desktop application. There is no existing codebase to migrate. The only external contracts are: the `bd` CLI (must be on PATH for writes), and the Dolt SQL database that `bd` manages (read directly for performance). The VSCode extension serves as a UX reference but shares no code.

Key constraints:
- Must ship on macOS, Windows, and Linux from day one
- Read performance is critical — filter + KPI recalculations happen on every keypress
- The dependency graph may contain hundreds of nodes for large projects
- Real-time sync must not block the UI thread or cause full re-renders

## Goals / Non-Goals

**Goals:**
- Tauri 2.0 as the application shell (Rust process + WebView frontend)
- Direct Dolt SQL reads via `sqlx` — never through `bd` for reads
- `bd` CLI for all writes (preserves ID assignment, hooks, label normalization)
- 2-second `dolt_log()` polling for real-time sync with targeted cache invalidation
- Type-safe Rust↔TypeScript IPC via `specta` + `tauri-specta`
- Full CRUD, multi-project, cross-platform from day one
- React Flow for dependency graphs (≤50 nodes); Cytoscape.js fallback above that threshold

**Non-Goals:**
- `beads://` deep-link URL scheme (v1.1 — OS registration complexity)
- Named/persisted saved filter sets (v1.1 — v1 derives state from URL hash)
- Push notifications from a remote server (all notifications are local)
- Mobile (iOS/Android) targets
- Offline-first conflict resolution UI (v1.1)

## Decisions

### D1: Tauri 2.0 over pure Rust GUI (iced, Slint, egui)

**Decision**: Use Tauri 2.0 (Rust backend + WebView frontend with React).

**Rationale**: The dependency graph visualization (React Flow / Cytoscape.js), KPI dashboards, rich text editor (TipTap), and animation requirements are solved problems in the web ecosystem. Pure Rust GUI frameworks in 2026 reach only medium-high "wow factor" ceiling and require implementing these primitives from scratch. Tauri gives us the Rust performance/safety guarantees for data, IPC, and OS integration while delegating rendering to the platform WebView. Production references: GitButler, Cap.

**Alternative considered**: Dioxus 0.6 (React-like Rust UI). Rejected because TipTap, React Flow, and Cytoscape.js are not available in the Dioxus ecosystem; native Blitz renderer is still maturing.

### D2: Direct Dolt SQL reads via sqlx

**Decision**: The Rust backend connects to Dolt via `sqlx` (MySQL-compatible protocol). The `bd` CLI is never invoked for reads.

**Rationale**: `bd` CLI process spawning adds 100-500ms latency per query. Filter/KPI views require sub-100ms response for a fluid feel. Dolt exposes a MySQL-compatible SQL interface; `sqlx` is the idiomatic Rust async SQL client.

**Risk**: Dolt schema changes between `bd` versions can break direct queries silently. **Mitigation**: Check a schema version marker table on startup; degrade to read-only warning mode on mismatch.

### D3: One connection pool per project

**Decision**: Each open Beads project gets its own `sqlx::Pool` keyed by project path. No shared singleton.

**Rationale**: Projects may be on different Dolt databases (different ports or embedded paths). Sharing a pool would require multiplexing logic that adds complexity with no benefit. Pool size: 3-5 connections (Dolt embedded is single-writer; read pool can be slightly larger).

### D4: Real-time sync via dolt_log() commit hash polling

**Decision**: Rust polls `SELECT DOLT_LOG()` (or equivalent hash query) every 2 seconds. When the hash changes, the Rust backend diffs which task rows changed and emits a Tauri event containing changed task IDs only.

**Rationale**: Dolt does not natively push change notifications. 2s polling is imperceptible to users for collaborative workflows. Targeting only changed task IDs prevents full list re-renders and preserves scroll position.

**Alternative considered**: File-system watcher on the `.beads/` directory. Rejected because Dolt's internal file layout is not stable across versions and the commit hash approach is more reliable.

### D5: specta + tauri-specta for typed IPC

**Decision**: All Tauri commands are annotated with `specta::Type`. `tauri-specta` generates a TypeScript bindings file at build time. The frontend imports these bindings and never calls raw `invoke()` strings.

**Rationale**: Without this, Rust command signature changes silently break the frontend at runtime. `specta` catches the mismatch at compile time.

### D6: React Flow for dependency graph (Cytoscape.js for large graphs)

**Decision**: Use React Flow as the default graph renderer. If the graph contains more than 50 nodes, switch to Cytoscape.js for performance.

**Rationale**: React Flow has a superior developer experience and animation story for typical graph sizes. Cytoscape.js handles 1000+ nodes with its canvas renderer. The 50-node threshold is conservative and can be tuned.

### D7: TanStack Query + Zustand state model

**Decision**: TanStack Query manages all server state (task lists, task details, project list). Zustand manages UI-only state (selected task, active view, pane sizes, density). Tauri events from the Rust backend trigger TanStack Query cache invalidation.

**Rationale**: Separates server state (with caching, invalidation, optimistic updates) from ephemeral UI state. No Redux needed; both libraries are lightweight and composable.

### D8: Filter state in URL hash

**Decision**: Active filters, selected task ID, and current view are encoded in the window's location hash. React Router or a lightweight hash-state library manages this.

**Rationale**: Enables deep links, back/forward navigation, and (in v1.1) named saved views for free. Works in Tauri's WebView without a server.

## Risks / Trade-offs

- **[Risk] Dolt schema drift breaks queries** → Mitigation: schema version check on startup, graceful degradation with user warning
- **[Risk] Tauri WebView rendering inconsistencies across platforms** → Mitigation: test on all three platforms in CI; use CSS resets; avoid WebKit-only features
- **[Risk] `bd` CLI not on PATH** → Mitigation: detect at startup, degrade to read-only mode with clear error message
- **[Risk] Dependency graph performance with 100+ nodes** → Mitigation: Cytoscape.js fallback above 50 nodes; lazy-load transitive deps beyond 2 hops
- **[Risk] 2s polling causes CPU drain on battery** → Mitigation: pause polling when app window is hidden/minimized; resume on focus

## Migration Plan

Not applicable — greenfield project. No data migration needed.

Initial bootstrap order:
1. Scaffold Tauri 2.0 project (Rust workspace + Vite/React frontend)
2. Implement data layer (Dolt connection, bd CLI wrapper, specta IPC)
3. Implement layout shell (pane layout, project switcher, density)
4. Implement task list + filters + KPI
5. Implement task detail (inline edit, TipTap editor)
6. Implement dependency graph canvas
7. Implement smart views (command palette, keyboard nav, Focus, Ready-to-Start)
8. Implement notifications + tray app

## Open Questions

- **Q1**: Should the embedded Dolt engine be started by the Rust backend, or does `bd` always manage the engine lifetime? Depends on whether `bd` exposes a server mode for the embedded engine.
- **Q2**: What is the exact SQL query to detect changed task IDs between two Dolt commits? Likely `DOLT_DIFF()` table function — confirm against bd's schema.
- **Q3**: Should we bundle a specific `bd` version, or rely on whatever is on PATH? Bundling avoids version skew but increases binary size and complicates updates.
