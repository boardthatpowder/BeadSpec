## 1. Backend types & module

- [x] 1.1 Create `src-tauri/src/commands/openspec_validate_history.rs` exporting type
      `ValidationHistoryEntry { change_slug: String, valid: bool, errors: Vec<String>,
      ts_epoch: u64, ts_iso: String }` deriving `serde::Serialize`, `serde::Deserialize`,
      and `specta::Type`.
- [x] 1.2 In the same module, add a helper `build_history_key(workspace: &WorkspaceContext,
      change_slug: &str, valid: bool, ts_ms: u128) -> String` producing the pipe-delimited
      key format defined in design.md §1.
- [x] 1.3 Add a helper `derive_workspace_for_path(project_path: &str) -> Result<WorkspaceContext, String>`
      that reuses the `git rev-parse --abbrev-ref HEAD` + basename logic already in
      `get_workspace_context` (factor a shared inner fn or call through the public command).

## 2. Tauri commands

- [x] 2.1 Implement `record_openspec_validation(project_path, change_slug, result_json, settings)`
      Tauri command. It MUST: (a) parse `result_json` into a temp struct `{ valid: bool,
      errors: Vec<String> }`; (b) derive `WorkspaceContext` via the helper from 1.3;
      (c) compute `ts_ms` from `SystemTime::now().duration_since(UNIX_EPOCH).as_millis()`;
      (d) build the key via 1.2; (e) build the JSON value (`change_slug`, `valid`, `errors`,
      `ts_epoch = ts_ms / 1000`, `ts_iso` formatted as RFC-3339 via `chrono`);
      (f) call `run_ruflo_managed` with `["memory", "store", "-k", key, "-v", value]` and a
      10s timeout; (g) return `()` on success.
- [x] 2.2 Implement `list_openspec_validations(project_path, change_slug, settings) ->
      Result<Vec<ValidationHistoryEntry>, String>`. It MUST: (a) call
      `ruflo memory search -q "openspec:<slug> type:validate-history" --format json` via
      `run_ruflo_managed` with a 10s timeout; (b) parse stdout using the same shape
      `ruflo_memory_search` returns; (c) filter to keys containing `|openspec:<slug>|` AND
      `|type:validate-history|`; (d) JSON-parse each value into `ValidationHistoryEntry`,
      skipping rows that fail to parse or whose `change_slug` doesn't match the requested
      slug; (e) sort by `ts_epoch` descending; (f) truncate to the first 50 rows.
- [x] 2.3 Register both commands with `pub mod openspec_validate_history;` in
      `src-tauri/src/commands/mod.rs`.
- [x] 2.4 Register both commands in `src-tauri/src/lib.rs` in BOTH `tauri::generate_handler!`
      AND `tauri_specta::collect_commands!` alongside the existing `openspec::*` commands.

## 3. Backend tests

- [x] 3.1 Unit test for `build_history_key`: assert exact pipe-delimited format including
      `outcome:pass` / `outcome:fail` and millisecond `ts:` segment.
- [x] 3.2 Unit test that the JSON value emitted by `record_openspec_validation`'s formatter
      round-trips back through `serde_json::from_str::<ValidationHistoryEntry>(value)` —
      asserts `ts_epoch` is in seconds (not ms) and `ts_iso` parses as valid RFC-3339.
- [x] 3.3 Unit test for the `list_openspec_validations` filter: feed a synthetic search
      result containing one matching entry, one entry with the wrong slug, one entry with
      `type:trajectory`, and one entry whose value is malformed JSON. Assert only the
      matching entry survives.
- [x] 3.4 Unit test for sort order: three entries with descending `ts_epoch` values produce
      a newest-first list.

## 4. IPC + bindings

- [x] 4.1 Regenerate `src/bindings.ts` by running the existing specta codegen step. The new
      type `ValidationHistoryEntry` and both new commands MUST appear in the output.
- [x] 4.2 Add wrappers in `src/ipc.ts`:
      - `recordOpenspecValidation(projectPath, changeSlug, resultJson): Promise<void>`
      - `listOpenspecValidations(projectPath, changeSlug): Promise<ValidationHistoryEntry[]>`
      Style matches the existing `runOpenspecValidate` and `getChangeBeadsProgress` wrappers.

## 5. Frontend integration

- [x] 5.1 In `src/components/task-detail/OpenSpecPanel.tsx`, ensure a TanStack Query for
      `ruflo_version_probe` keyed `['ruflo-version']` with `staleTime: Infinity` and
      `retry: false` is present (or add it) to gate the history section.
- [x] 5.2 Modify `ValidateSection` so `handleValidate` calls
      `recordOpenspecValidation(projectRoot, changeName, JSON.stringify({ valid, errors }))`
      after both the success path and the catch path, then invalidates
      `['validation-history', projectRoot, changeName]`. Recording errors are caught and
      `console.warn`'d — they must never surface to the user or affect the in-place result.
- [x] 5.3 Add sub-component `<ValidationHistory projectRoot changeName />` inside
      `OpenSpecPanel.tsx`. It runs a TanStack Query against `listOpenspecValidations`, keyed
      `['validation-history', projectRoot, changeName]`, with `staleTime: 30_000` and
      `enabled` gated on the ruflo-version probe succeeding.
- [x] 5.4 Render the section inside a `<details>` (closed by default) with the header
      "Validation history" and a count badge (e.g. `(3)`). Render up to 5 rows newest-first.
      Each row: timestamp (HH:MM · DD MMM) + pass/fail badge + one-line summary. Wrap the
      timestamp in a `<Tooltip>` showing the full ISO string on hover (mirrors `ArtifactLink`).
- [x] 5.5 Implement per-row expansion: click toggles a local `Set<number>` of expanded row
      indices. Expanded view renders the full `errors[]` list for `valid === false` entries,
      identical styling to the existing `ValidateSection` error list.
- [x] 5.6 Render the empty state ("No validations recorded yet — click Re-validate above.")
      when the query returns `[]` and ruflo is available.
- [x] 5.7 Render the gate message ("Validation history requires the ruflo CLI (memory
      store).") when `ruflo_version_probe` rejects.
- [x] 5.8 If `entries.length > 5`, render a "Showing 5 of N · [Show all]" footer where
      "Show all" toggles local state expanding the list inline (up to 50 entries, no modal,
      no new route).
- [x] 5.9 Insert `<ValidationHistory>` directly below `<ValidateSection>` in
      `OpenSpecPanelBody`.

## 6. Frontend tests

- [x] 6.1 Vitest / RTL test for `<ValidationHistory>`: mock `listOpenspecValidations` to
      return 0 entries → assert empty-state copy is rendered.
- [x] 6.2 Test with 3 entries → assert newest-first ordering and that no "Show all" footer
      renders.
- [x] 6.3 Test with 10 entries → assert only 5 visible by default and that clicking "Show
      all" reveals the remainder.
- [x] 6.4 Test gate path: mock `ruflo_version_probe` rejection → assert gate message renders
      and no `listOpenspecValidations` call fires.
- [x] 6.5 Test recording side-effect: mock `runOpenspecValidate` to return
      `{ valid: true, errors: [] }`, click Re-validate, assert `recordOpenspecValidation` is
      called once with the matching JSON payload.

## 7. Verification

- [x] 7.1 `cargo test -p beadspec_lib openspec_validate_history::tests` passes.
- [x] 7.2 `bun tsc --noEmit` passes after bindings regeneration.
- [x] 7.3 `bun run lint` passes.
- [x] 7.4 Manual: open a project with at least one OpenSpec change, open the change's epic
      task, expand `OpenSpec`, click `Re-validate` twice (once on a valid spec, once after
      introducing a spec error). Confirm two rows appear in "Validation history" with the
      correct badges; expand each to confirm the error list matches the inline
      `ValidateSection` result.
- [x] 7.5 Manual: uninstall (or rename) the `ruflo` binary; confirm the section degrades to
      the gate message and `Re-validate` still works in `ValidateSection` (record call fails
      silently and is logged to the console).
- [x] 7.6 Manual: switch worktrees on the same repo; confirm history entries from worktree A
      do not appear in worktree B when the same change is opened.
- [x] 7.7 `openspec validate openspec-validation-history` passes.
