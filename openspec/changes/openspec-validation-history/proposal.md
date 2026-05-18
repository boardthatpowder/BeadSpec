## Why

`OpenSpecPanel` already runs `openspec validate` on demand via `runOpenspecValidate`, but the
result vanishes the moment the user clicks "Re-validate" again or navigates away. There is no
record of what passed, what failed, when, or what the failure was — so the user cannot track
spec drift over time, cannot compare two consecutive validation runs, and has no audit trail
when they reopen a change a week later. The validate result is the cheapest, highest-signal
proof that a change is still coherent against its specs, and we are discarding it.

## What Changes

- Each invocation of `runOpenspecValidate` from `OpenSpecPanel` SHALL be persisted as a Ruflo
  memory entry under the key
  `<branch>|<worktree>|<repo>|openspec:<change-slug>|type:validate-history|outcome:<pass|fail>|ts:<epoch-ms>`
  whose value is the JSON-serialised `ValidationHistoryEntry` (change slug, valid flag, error
  list, epoch seconds, ISO timestamp).
- `OpenSpecPanel` SHALL render a new collapsible "Validation history" sub-section directly
  below `ValidateSection`, listing the most recent 5 entries newest-first. Each row shows a
  short timestamp, a pass/fail badge, and a one-line summary (`Valid` for pass; the first
  error line for fail). Clicking a row expands it inline to show the full error list.
- Two new Tauri commands are introduced:
  - `record_openspec_validation(project_path, change_slug, result_json)` — writes one history
    entry via `ruflo memory store`.
  - `list_openspec_validations(project_path, change_slug)` — returns up to 50 recent entries
    via `ruflo memory search`, sorted newest-first; the panel slices the first 5.
- The history sub-section SHALL be hidden entirely (no header, no rows) when `ruflo --version`
  fails, mirroring the gate `RufloMemoryPanel` uses via `ruflo_version_probe`. A short muted
  message is shown in its place.
- Empty state when no entries exist: a single muted line "No validations recorded yet."

Non-goals (explicit):

- No diff view between two history entries — flat list only.
- No retention or garbage-collection of old entries (Ruflo memory handles its own consolidation).
- No automatic background validation — recording is on-demand, triggered only when the user
  clicks "Re-validate".
- No history anywhere on the Changes browser cards — history lives in the per-change
  `OpenSpecPanel` only.
- No export, CSV, or copy-as-markdown of the history list.
- No write API for editing or deleting individual history entries through the UI.

## Capabilities

### New Capabilities
<!-- None — this extends an existing capability. -->

### Modified Capabilities
- `openspec-panel`: gains a "Validation history" requirement and an additional scenario on the
  existing "openspec validate status" requirement (each validate run is now persisted, and a
  recording failure must not block the in-place result display).

## Impact

- **Tauri commands** (new): `record_openspec_validation` and `list_openspec_validations` in a
  new module `src-tauri/src/commands/openspec_validate_history.rs`, wired into
  `commands/mod.rs`, `tauri::generate_handler!`, and `tauri_specta::collect_commands!`.
- **Type bindings** (new): `ValidationHistoryEntry { change_slug, valid, errors, ts_epoch, ts_iso }`
  auto-generated via `specta` into `src/bindings.ts`.
- **Frontend IPC**: two wrappers in `src/ipc.ts` (`recordOpenspecValidation`,
  `listOpenspecValidations`).
- **React component**: `src/components/task-detail/OpenSpecPanel.tsx` — `ValidateSection`
  calls `recordOpenspecValidation` after each `runOpenspecValidate` result (pass or fail), then
  invalidates the history query. A new `<ValidationHistory>` sub-component renders the list.
- **Storage**: no schema changes — uses the existing Ruflo memory store (WASM SQLite under
  `~/.claude/ruflo/…`). Branch/worktree/repo prefix derived in Rust the same way
  `get_workspace_context` derives it.
- **No CLI shellouts beyond the existing `ruflo memory store/search`**, both already wired
  via `run_ruflo_managed`.
