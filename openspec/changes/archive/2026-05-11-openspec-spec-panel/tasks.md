## 1. Rust Backend — openspec.rs command module

- [x] 1.1 Create `src-tauri/src/commands/openspec.rs` with the four Tauri commands: `list_changes`, `read_change_artifact`, `get_change_progress`, `run_openspec_validate`, and the helper `list_change_specs`. Implement project-root resolution from `ProjectRegistry` (first entry or dedicated accessor). Include `ChangeInfo`, `ChangeProgress`, and `ValidationResult` data types derived with `serde::Serialize`, `serde::Deserialize`, and `specta::Type`.
- [x] 1.2 Register `pub mod openspec;` in `src-tauri/src/commands/mod.rs` and add all five commands to the `invoke_handler` in `src-tauri/src/lib.rs` (alongside existing commands).
- [x] 1.3 Re-run `tauri-specta` codegen (`cargo test export_bindings` or the existing specta export task) to regenerate `src/bindings.ts` with the new types and command stubs. Verify the generated file compiles (`bun run typecheck` or `tsc --noEmit`).
- [x] 1.4 Smoke-test the new commands via `tauri dev`: open a project, call `list_changes()` from the browser console via `window.__TAURI__.core.invoke('list_changes')` and confirm a non-empty array is returned.

## 2. TypeScript Types and IPC helpers

- [x] 2.1 Confirm `ChangeInfo`, `ChangeProgress`, `ValidationResult` are present in the generated `src/bindings.ts` after step 1.3. If codegen does not run automatically in CI, commit the updated `bindings.ts`.
- [x] 2.2 Add typed wrappers in `src/ipc.ts` (or the equivalent IPC barrel file) for `listChanges`, `readChangeArtifact`, `getChangeProgress`, `runOpenspecValidate`, `listChangeSpecs` following the existing `unwrap(commands.xxx())` pattern.

## 3. OpenSpecPanel component

- [x] 3.1 Create `src/components/task-detail/OpenSpecPanel.tsx`. Accept props `changeName: string`, `containerMode: 'section' | 'tab'`, `projectRoot: string`. Use `useQuery` (TanStack Query) for `getChangeProgress` and `listChangeSpecs`; keep `validationResult` in local `useState`.
- [x] 3.2 Implement artifact links sub-section: call `listChangeSpecs` to enumerate spec files; render `proposal.md`, `design.md`, `tasks.md` + discovered spec paths. Use Tauri's `open` (from `@tauri-apps/plugin-shell`) for the click handler. Render missing files as muted, non-clickable `<span>` elements.
- [x] 3.3 Implement progress bar sub-section: render `<progress value={done} max={total} />` (or Tailwind-styled equivalent). Hide when `total === 0` and show "Tasks not created yet" hint.
- [x] 3.4 Implement validate sub-section: "Re-validate" button (hidden when `archived`), loading spinner while pending, display `ValidationResult` with timestamp, error list when invalid.
- [x] 3.5 Implement drift detection: after `tasks.md` content is fetched (via `readChangeArtifact`), parse checkbox lines in the frontend and compare against the current task's `status` and `title`. Render a yellow `<div>` warning when drift is detected; render nothing when not.
- [x] 3.6 Implement `containerMode` branching: `'section'` wraps in `<details><summary>OpenSpec</summary>...</details>`; `'tab'` renders a `<div className="h-full overflow-y-auto">` wrapper instead. Both must compile without TypeScript errors.
- [x] 3.7 Implement archive awareness: when `ChangeInfo.archived` is true, show grey "archived" pill badge next to the change name header, reduce artifact link opacity to 50%, hide the "Re-validate" button.

## 4. TaskDetailPanel integration

- [x] 4.1 In `src/components/task-detail/TaskDetailPanel.tsx`, extract the `openspec:<name>` label from `task.labels` (split on first colon, check prefix case-insensitively). Store the result as `openspecChangeName: string | null`.
- [x] 4.2 Render `{openspecChangeName && <OpenSpecPanel changeName={openspecChangeName} containerMode="section" projectRoot={project ?? ''} />}` at the bottom of the "Details" tab scroll area (inside the details `<div>`, after `DescriptionEditor` and `CommentsSection`). Import `OpenSpecPanel`.
- [x] 4.3 Confirm no layout shift for tasks without `openspec:*` labels: inspect the DOM in `tauri dev` and verify no empty containers are introduced.

## 5. Manual test in Tauri dev

- [x] 5.1 Open `tauri dev`. Find (or create) a task with the label `openspec:openspec-spec-panel`. Open the task. Verify the "OpenSpec" section appears in the Details tab.
- [x] 5.2 Verify artifact links: click `proposal.md` — it should open in the system default editor. Click a non-existent artifact — confirm it is muted and non-clickable.
- [x] 5.3 Verify progress bar: open a task linked to a change with a `tasks.md` that has checkboxes. Confirm the bar shows the correct ratio.
- [x] 5.4 Click "Re-validate". Confirm a result (valid or error list) appears with a timestamp and the button returns to non-loading state.
- [x] 5.5 Verify drift detection: manually set a task to `closed` while its tasks.md entry is unchecked (or vice versa). Confirm the yellow drift warning appears.
- [x] 5.6 Verify tasks without `openspec:*` labels show no OpenSpec section and no extra whitespace.

## 6. Validate and close

- [x] 6.1 Run `openspec validate openspec-spec-panel` and confirm output is clean.
- [x] 6.2 Run `bun run typecheck` (or `tsc --noEmit`) and `cargo check` in `src-tauri/` to confirm no type errors.
- [x] 6.3 Close this change in beads (`bd close <epic-id>`).
