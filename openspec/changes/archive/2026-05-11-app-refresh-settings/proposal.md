## Why

BeadSpec has no way to manually trigger a data refresh, and its user preferences are scattered across `localStorage`, Zustand stores, and Tauri Store with no unified surface. Different deployments also require different binary paths (`bd`, `openspec`, `ruflo`, `dolt`) and feature sets, but everything is currently hardcoded — making it impossible to disable OpenSpec or Ruflo for environments that don't have those tools installed.

## What Changes

- Add a **Refresh button** in the TopBar and `Cmd/Ctrl+R` hotkey that invalidates all TanStack Query caches, forcing an immediate data re-fetch.
- Add a **Settings dialog** (gear icon in TopBar, also reachable via CommandPalette) with sections for:
  - Feature toggles: enable/disable OpenSpec and Ruflo integrations.
  - Binary path overrides for `bd`, `openspec`, `ruflo`, and `dolt` (with auto-detect fallback).
  - Actor identity (replaces hardcoded `"me"` used in smart views and bd commands).
  - Quick-capture global shortcut (replaces hardcoded `Cmd+Shift+N`).
  - Density, zoom, and notification prefs (migrated from scattered `localStorage` keys into the unified store).
- When **OpenSpec is disabled**: hide the Changes tab in the view switcher, the OpenSpec panel in task detail, and the OpenSpec doc panel in the workspace. No disabled stubs.
- When **Ruflo is disabled**: hide the Ruflo memory panel in task detail and Ruflo-specific filter chips. No disabled stubs.
- Persist all settings in `settings.json` via `@tauri-apps/plugin-store`. Rust runners (`bd`, `openspec`, `ruflo`, `dolt`) read binary path overrides from this file at startup.

## Capabilities

### New Capabilities

- `app-refresh`: Global data refresh action — TopBar button, `Cmd/Ctrl+R` hotkey, CommandPalette entry. Calls `queryClient.invalidateQueries()`. No Tauri command needed; the existing Rust poller handles re-sync.
- `app-settings`: Unified settings dialog — feature toggles for OpenSpec and Ruflo, binary path overrides for all four runners, actor identity, quick-capture shortcut, and consolidated density/zoom/notification prefs. Backed by `settings.json` via Tauri Store.

### Modified Capabilities

- `layout-shell`: TopBar gains Refresh and Settings buttons. ViewSwitcher conditionally omits the `changes` tab when OpenSpec is disabled.
- `task-detail`: OpenSpec panel tab and Ruflo memory panel tab are conditionally absent when their respective features are disabled.
- `openspec-change-browser`: Entire change browser surface (including the Changes view) is absent when OpenSpec is disabled.
- `ruflo-memory-panel`: Panel is absent from task detail when Ruflo is disabled.
- `notifications`: Notification preferences migrate from `localStorage` into the unified Settings store and are surfaced in the Settings dialog rather than a standalone panel.
- `quick-capture`: Shortcut is user-configurable via Settings rather than hardcoded to `Cmd+Shift+N`.
- `smart-views`: Actor identity is read from Settings (defaulting to `"me"`) rather than from a dedicated `localStorage` key.

## Impact

**Frontend**
- New files: `src/stores/settingsStore.ts`, `src/contexts/SettingsContext.tsx`, `src/components/settings/SettingsDialog.tsx`, `src/components/layout/SettingsButton.tsx`, `src/components/layout/RefreshButton.tsx`.
- Modified: `src/components/layout/index.tsx` (TopBar), `src/App.tsx` (mount SettingsDialog), `src/components/layout/ViewSwitcher.tsx`, `src/components/task-detail/TaskDetailPanel.tsx`, `src/components/workspace/LeafPane.tsx`, `src/contexts/DensityContext.tsx`, `src/stores/zoomStore.ts`, `src/components/notifications/NotificationPrefs.tsx`, `src/components/smart-views/FocusView.tsx`, `src/hooks/useWorkspaceShortcuts.ts`, `src/components/CommandPalette.tsx`.
- No new Tauri IPC bindings needed on the frontend side.

**Rust (Tauri)**
- New module `src-tauri/src/settings.rs` — loads `settings.json` from the Tauri app data dir at startup, exposes `get_settings()`.
- Modified: `src-tauri/src/commands/external.rs`, `src-tauri/src/bd/runner.rs`, `src-tauri/src/commands/openspec.rs`, `src-tauri/src/db/dolt_server.rs` — each reads binary path from settings with existing auto-detect as fallback.
- Modified: `src-tauri/src/lib.rs` — quick-capture shortcut registered dynamically from settings.

**Breaking / Migration**
- `density`, `beads-actor`, `notification-prefs` `localStorage` keys are superseded by `settings.json` entries. A one-time migration reads the old keys on first load and writes them to the store, then clears the legacy keys.
