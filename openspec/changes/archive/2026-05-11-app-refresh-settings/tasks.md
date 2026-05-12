## 1. Settings Foundation (JS)

- [x] 1.1 Create `src/stores/settingsStore.ts` — Tauri Store backed (`settings.json`), TypeScript types for `AppSettings` (feature flags, binary paths, actor, shortcut, density, zoom, notification prefs), defaults, `loadSettings()` / `saveSettings()` helpers
- [x] 1.2 Create `src/contexts/SettingsContext.tsx` — provides `useSettings()` (full settings object + setter) and `useFeatureFlag(key: 'openspec' | 'ruflo')` hook; loads on mount, writes on change
- [x] 1.3 Add one-time localStorage migration in `SettingsContext` init — reads `density`, `beads-actor`, `notification-prefs` from `localStorage`, writes to store if absent, removes legacy keys
- [x] 1.4 Mount `SettingsContext` in `src/App.tsx` wrapping the whole tree (below `QueryClientProvider`)

## 2. Settings Foundation (Rust)

- [x] 2.1 Create `src-tauri/src/settings.rs` — `AppSettings` struct (serde-deserializable), `load_settings(app_handle)` reads `settings.json` from Tauri app data dir via `serde_json`; derives `Default`
- [x] 2.2 Register `Mutex<AppSettings>` as managed Tauri state in `src-tauri/src/lib.rs`; call `load_settings()` during app setup
- [x] 2.3 Listen for `settings-changed` Tauri event in `lib.rs` — re-read `settings.json` and update the `Mutex<AppSettings>` so in-flight binary path changes are picked up without restart

## 3. Refresh Action

- [x] 3.1 Create `src/components/layout/RefreshButton.tsx` — calls `useQueryClient().invalidateQueries()`, reads `useIsFetching()` for spinner state; matches TopBar button styling from `ProjectSwitcher`
- [x] 3.2 Add `Cmd/Ctrl+R` hotkey via `useShortcut('r', refresh)` in `src/hooks/useWorkspaceShortcuts.ts`
- [x] 3.3 Add `{ id: 'refresh', label: 'Refresh', ... }` to `actions` array in `src/components/CommandPalette.tsx:51`
- [x] 3.4 Mount `<RefreshButton />` in TopBar in `src/components/layout/index.tsx` after `<BdHumanQueueChip />`

## 4. Feature Gating

- [x] 4.1 Gate `'changes'` tab in `ViewSwitcher.tsx` behind `useFeatureFlag('openspec')`; if the active view is `'changes'` when the flag turns off, redirect to `'all'`
- [x] 4.2 Gate `<ChangesBrowser />` mount in `src/components/layout/index.tsx:83` behind `useFeatureFlag('openspec')`
- [x] 4.3 Gate OpenSpec panel tab in `src/components/task-detail/TaskDetailPanel.tsx` behind `useFeatureFlag('openspec')`; reset active tab to first available if OpenSpec tab was active
- [x] 4.4 Gate `OpenSpecDocPanel` panel type in `src/components/workspace/LeafPane.tsx:62` behind `useFeatureFlag('openspec')`
- [x] 4.5 Gate Ruflo memory panel tab in `src/components/task-detail/TaskDetailPanel.tsx:224` behind `useFeatureFlag('ruflo')`; reset active tab if needed
- [x] 4.6 Gate Ruflo-specific filter chips in `src/components/filters/FilterBar.tsx` and `src/lib/filterParser.ts` behind `useFeatureFlag('ruflo')`

## 5. Binary Path Plumbing (Rust)

- [x] 5.1 Update `src-tauri/src/bd/runner.rs:42,70` and `src-tauri/src/commands/external.rs:63` — read `bd` binary path from `AppSettings` state; fall back to existing auto-detect when path is blank
- [x] 5.2 Update `src-tauri/src/commands/external.rs:78-113` (`find_ruflo()`) — prepend settings-configured `ruflo` path check before nvm heuristic
- [x] 5.3 Update `src-tauri/src/commands/openspec.rs:249` — replace literal `"openspec"` with path from `AppSettings`, falling back to `"openspec"` when blank
- [x] 5.4 Update `src-tauri/src/db/dolt_server.rs:43` — read `dolt` binary path from `AppSettings`; fall back to `"dolt"` when blank; log a note if path changed post-startup (restart required)

## 6. Quick-Capture Shortcut (Rust + JS)

- [x] 6.1 Add `register_quick_capture_shortcut(app: AppHandle, shortcut: String) -> Result<(), String>` Tauri command in `src-tauri/src/commands/app.rs` — unregisters current, registers new, returns error string on failure; expose via `tauri-specta`
- [x] 6.2 Update `src-tauri/src/lib.rs:21` — replace hardcoded `"CmdOrCtrl+Shift+N"` with value from `AppSettings` at startup (defaulting to `"CmdOrCtrl+Shift+N"` if absent)
- [x] 6.3 Call `invoke('register_quick_capture_shortcut', { shortcut })` from Settings dialog when shortcut field changes; surface inline error on `Err` response

## 7. Settings Dialog UI

- [x] 7.1 Create `src/components/settings/SettingsDialog.tsx` — modal overlay shell (model on `RecoveryDialog.tsx`): `bg-black/60` backdrop, `bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl`, Escape-to-close via `useHotkeys('escape', ...)`; sectioned with a sidebar or tab strip for navigation
- [x] 7.2 Add **Features** section — toggle switches for "OpenSpec integration" and "Ruflo integration"; writes to `settings.features`
- [x] 7.3 Add **Binary Paths** section — text inputs for `bd`, `openspec`, `ruflo`, `dolt` paths; placeholder shows auto-detect path; note inline on `dolt` field that path changes require restart
- [x] 7.4 Add **Identity** section — text field for actor (default `"me"`)
- [x] 7.5 Add **Quick Capture** section — shortcut display field; on change calls `register_quick_capture_shortcut`; shows inline error on failure
- [x] 7.6 Add **Appearance** section — density selector (compact / default / comfortable) and zoom slider/control; writes to `settings.density` and `settings.zoom`
- [x] 7.7 Add **Notifications** section — embed refactored `NotificationPrefsPanel` reading from settings store instead of localStorage
- [x] 7.8 Create `src/components/layout/SettingsButton.tsx` — gear icon button; on click toggles SettingsDialog open; matches TopBar button styling
- [x] 7.9 Mount `<SettingsButton />` in TopBar (after RefreshButton) and `<SettingsDialog />` as sibling of `<RecoveryDialog />` in `src/App.tsx`

## 8. Migrate Pref Consumers

- [x] 8.1 Update `src/contexts/DensityContext.tsx:18,26` — read density from `useSettings().density` instead of `localStorage`; `DensityContext` becomes a thin adapter over `SettingsContext`
- [x] 8.2 Update `src/stores/zoomStore.ts` — read/write zoom from `settings.zoom` via `settingsStore` instead of its own Tauri Store key
- [x] 8.3 Update `src/components/smart-views/FocusView.tsx:10` — read actor from `useSettings().actor` instead of `localStorage["beads-actor"]`
- [x] 8.4 Update `src/components/notifications/NotificationPrefs.tsx:19,27` — read/write notification prefs from `useSettings().notificationPrefs` instead of `localStorage["notification-prefs"]`

## 9. Validation

- [x] 9.1 `bun run typecheck` — no TypeScript errors
- [x] 9.2 Manual: toggle OpenSpec off → Changes tab gone, OpenSpec panel tab gone, LeafPane doc panel gone; toggle back on → all restored
- [x] 9.3 Manual: toggle Ruflo off → Ruflo memory panel gone, Ruflo filter chips gone; toggle back on → restored
- [x] 9.4 Manual: click Refresh button + press Cmd/Ctrl+R + use CommandPalette → task list re-fetches each time; spinner shows during fetch
- [x] 9.5 Manual: set a binary path override, invoke the feature (e.g., view Changes) → verify CLI is called with the override path (check Tauri logs)
- [x] 9.6 Manual: change actor to a known assignee name → Focus view shows that person's tasks
- [x] 9.7 Manual: change quick-capture shortcut → old shortcut stops working, new one triggers quick capture
- [x] 9.8 Manual: restart app → all settings persist; feature flags, binary paths, actor all restored
- [x] 9.9 Manual: simulate corrupted `settings.json` (delete file) → app starts with defaults, no crash
- [x] 9.10 `cargo test` in `src-tauri/` — no regressions
