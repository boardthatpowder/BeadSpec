## Context

Beads UI currently has no way for the user to manually trigger a data refresh — all cache invalidation is event-driven via the Rust dolt_log() poller. User preferences (density, zoom, actor, notification prefs) live in three different systems: `localStorage`, per-feature Zustand stores, and `@tauri-apps/plugin-store`. Binary paths for the four external runners (`bd`, `openspec`, `ruflo`, `dolt`) are either hardcoded strings or environment-specific auto-detect heuristics in Rust. There is no feature-flag system, making it impossible to ship Beads UI to environments where OpenSpec or Ruflo are not installed.

## Goals / Non-Goals

**Goals:**
- One-click / hotkey data refresh that works without restarting the app.
- Unified settings store (a single `settings.json`) that both JS and Rust can read.
- Feature toggles for OpenSpec and Ruflo that hide those integrations entirely when off.
- User-editable binary path overrides for all four runners.
- Consolidate scattered prefs (density, zoom, actor, notification prefs, quick-capture shortcut) into the settings dialog.
- Silent one-time migration of legacy `localStorage` keys into the new store.

**Non-Goals:**
- Settings sync across machines or user accounts.
- Import/export of settings files.
- Granular per-project settings (settings are global to the installation).
- Hot-reload of binary path changes without restart (path changes take effect on next app launch).
- A/B testing or remote config.

## Decisions

### 1. Persist settings in `@tauri-apps/plugin-store` (`settings.json`)

**Decision**: Use the same Tauri Store plugin already used by 6 other stores (`layout.json`, zoom, etc.) rather than localStorage or a custom file.

**Rationale**: The plugin writes to the platform-correct app data directory, is async-safe, and its on-disk format is plain JSON that Rust can read with `serde_json` at startup without going through the plugin API.

**Alternative considered**: A dedicated Tauri command (`get_settings` / `set_settings`) backed by a Rust-owned file. Rejected because it duplicates the store plugin's responsibility and adds IPC round-trips on every settings read.

---

### 2. React feature gating via `SettingsContext` + `useFeatureFlag(key)` hook

**Decision**: Mount a `SettingsContext` near the React tree root. Each integration (OpenSpec panels, Ruflo panels) consumes `useFeatureFlag('openspec')` / `useFeatureFlag('ruflo')` and conditionally renders `null` when the flag is off.

**Rationale**: Rendering `null` means no React subtree, no hooks, no Tauri IPC calls for disabled features — better than CSS `display:none` or disabled props which still execute the subtree. The hook is a thin selector over context with no additional re-renders.

**Alternative considered**: Prop drilling `featureFlags` down from `App.tsx`. Rejected: too many touch points across deeply nested components.

---

### 3. Refresh = pure frontend `queryClient.invalidateQueries()`

**Decision**: The Refresh action calls `queryClient.invalidateQueries()` (no query-key filter) on the shared `QueryClient`. No new Tauri command is introduced.

**Rationale**: The Rust dolt_log() poller already handles DB-driven invalidation. The refresh exists for cases where the user suspects stale UI state (e.g., the poller missed an event, or they edited data via another tool). A full invalidation is the simplest correct approach; queries will refetch lazily as their components are visible.

**Alternative considered**: Emitting a Tauri event from the frontend to force-poke the poller. Rejected: adds unnecessary cross-process coordination for a purely UI concern.

---

### 4. Rust reads settings via `serde_json` at startup, not via JS IPC

**Decision**: The Rust `settings` module reads `settings.json` from the Tauri app data directory using `serde_json` at startup and holds the result in `Mutex<AppSettings>` as managed Tauri state. Each command handler that needs a binary path calls `state.lock().binary_paths.openspec.clone()`.

**Rationale**: Runners are invoked from Rust commands; fetching settings via an IPC call back to JS would create a circular dependency. Reading the same file the JS store plugin writes is simpler and avoids an IPC round-trip on every external command invocation.

**Race condition**: The JS store plugin is the sole writer. Rust reads on startup and re-reads when the frontend emits a `settings-changed` Tauri event after saving. Window of inconsistency is bounded to the time between a JS write and the Rust handler processing the event — acceptable given the use case (runner paths change rarely).

**Alternative considered**: A dedicated Tauri command `get_settings` → JSON string → Rust parse per invocation. Rejected: adds per-command latency and re-parses JSON on every `openspec` CLI call.

---

### 5. Quick-capture shortcut: dynamic re-registration

**Decision**: At startup, read the configured shortcut from `settings.json` (defaulting to `"CmdOrCtrl+Shift+N"`). On `settings-changed` event, unregister the current global shortcut and register the new one using `app.global_shortcut().unregister(old)` + `.register(new, handler)`.

**Rationale**: The `tauri-plugin-global-shortcut` API supports dynamic un/re-registration without restart. This avoids requiring users to restart to change the capture shortcut.

**Risk**: If the user sets an invalid or already-registered shortcut, registration fails silently. Mitigation: validate against a known-safe allowlist in the Settings UI; display an error if the Tauri registration fails (via a new `register_quick_capture_shortcut` command that returns `Result`).

---

### 6. LocalStorage migration: silent, one-time, on first mount

**Decision**: `SettingsContext` checks for legacy localStorage keys (`density`, `beads-actor`, `notification-prefs`) on first mount. If present and the corresponding settings key is absent from the store, it writes the value to the store and removes the legacy key. No user interaction required.

**Rationale**: Users should not lose their preferences when updating. The migration is idempotent: subsequent mounts find the settings key already set and skip migration.

## Risks / Trade-offs

- **settings.json corruption** → JS store: `load()` throws, caught in `SettingsContext` init, app falls back to built-in defaults and logs a warning. Rust: `serde_json::from_str` returns `Err`, `AppSettings::default()` is used.

- **User disables OpenSpec, loses access to re-enable it** → Settings gear button is always visible in the TopBar regardless of feature flags. The OpenSpec/Ruflo toggles are always shown in the Settings dialog. This is by design.

- **Binary path override set to a bad path** → The runner returns an error to the frontend, which surfaces the existing error UI (toast or inline error) for the affected feature. The auto-detect fallback is used only when the path field is blank; an explicit bad path is not silently overridden.

- **Hot-reload of binary paths** → Changing binary paths in Settings takes effect for subsequent Tauri command calls within the same session (the `Mutex<AppSettings>` is updated on `settings-changed`). The `dolt` binary path is an exception: dolt-server is spawned once at startup, so a path change requires an app restart. The UI will note this constraint.

## Migration Plan

1. Ship the JS `settingsStore.ts` with localStorage migration logic.
2. Ship the Rust `settings.rs` module reading from the same file.
3. No DB migrations, no schema changes, no Tauri capability changes (the store plugin is already registered).
4. Rollback: revert the JS context and Rust module; the three localStorage keys survive if migration logic was never executed.

## Open Questions

- Should the Settings dialog be accessible from the system tray menu as well? (Deferred — tray menu redesign is a separate change.)
- Should binary path overrides be per-project or global? (Decided: global, for simplicity. Revisit if multi-project deployments need different CLIs.)
