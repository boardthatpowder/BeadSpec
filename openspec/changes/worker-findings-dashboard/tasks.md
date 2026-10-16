## 1. Backend types & query

- [x] 1.1 Create `src-tauri/src/commands/workers.rs` with `WorkerFinding { issue_id: String, title: String, worker: String, priority: i32, status: String, notes_first_line: String, created_at: String }`, deriving `serde::Serialize`, `serde::Deserialize`, and `specta::Type`.
- [x] 1.2 Add a helper `parse_worker_provenance(notes: &str) -> Option<WorkerProvenance>` accepting the current hook delimiter `Auto-filed by ruflo-<worker> worker on ` and the legacy delimiter `Auto-filed by ruflo-<worker> on `.
- [x] 1.3 Add `list_worker_findings(project_path, registry) -> Result<Vec<WorkerFinding>, String>` Tauri command that: (a) acquires the Dolt SQL pool for `project_path` via the existing `ProjectRegistry`; (b) queries unresolved rows with `notes LIKE 'Auto-filed by ruflo-%'`, `status NOT IN ('closed','deleted')`, and `issue_type != 'deleted'`; (c) parses worker via the helper; (d) skips rows where the parser or unresolved-row guard fails.
- [x] 1.4 Add `pub mod workers;` to `src-tauri/src/commands/mod.rs`.
- [x] 1.5 Register `commands::workers::list_worker_findings` in `src-tauri/src/lib.rs` inside both `tauri_specta::collect_commands!` and `tauri::generate_handler!`.

## 2. Backend tests

- [x] 2.1 Unit test `parse_worker_provenance` for the current hook prefix (`Auto-filed by ruflo-security worker on ...`), legacy delimiter, hyphenated worker tags (`ruflo-test-gap worker on ...`), mid-string occurrence rejection, malformed delimiter rejection, and invalid-token rejection.
- [x] 2.2 Unit test the unresolved-row guard: open, in-progress, blocked, and custom statuses are included; `closed`, `deleted`, and `issue_type = 'deleted'` are excluded.
- [x] 2.3 Unit test the SQL contract used by `list_worker_findings` so notes prefix filtering, closed/deleted exclusion, issue-type exclusion, and `created_at DESC` ordering cannot drift silently.
- [x] 2.4 Test that `created_at DESC` ordering is preserved by the backend SQL contract and priority/newest-first ordering is applied inside each frontend worker group.
- [x] 2.5 Unit test the `list_tasks` worker-provenance projection so task rows derive chips from only the first notes line instead of selecting full note bodies.

## 3. IPC + bindings

- [x] 3.1 Run `bun tauri build` (or the existing specta codegen script) to regenerate `src/bindings.ts` with `WorkerFinding` and the `listWorkerFindings` command stub.
- [x] 3.2 Add `listWorkerFindings(projectPath: string): Promise<WorkerFinding[]>` wrapper in `src/ipc.ts` using the existing `unwrap(commands.listWorkerFindings(projectPath))` idiom.

## 4. Frontend helper

- [x] 4.1 Add `src/lib/worker-findings.ts` exporting `parseWorkerProvenance(notes: string | null | undefined): { worker: string; firstLine: string } | null` using the same delimiter behavior as the Rust helper. Document the coupling to `on-finding.sh` and to `parse_worker_provenance`.
- [x] 4.2 Add a unit test under `src/lib/worker-findings.test.ts` mirroring the Rust cases from task 2.1 plus a `null` / `undefined` / empty-string trio and unknown-priority severity formatting.

## 5. TaskListItem chip

- [x] 5.1 Confirmed `Task` row payload does not carry notes; add parsed nullable `worker_provenance` to the Rust `Task` payload and pass it through `TaskList` into `TaskListItem` without a separate worker-findings query or full-notes task-list payload.
- [x] 5.2 Regenerate bindings so `Task.worker_provenance` is typed in `src/bindings.ts`.
- [x] 5.3 Style the chip identically to other label chips: `text-[10px] px-1.5 py-0 rounded font-mono leading-4 max-w-24 truncate ${labelChipClass('worker:' + worker)}`. Use the `worker:` prefix so it picks up `LABEL_CHIP_COLORS.worker`. Apply `formatLabel('worker:' + worker)` so the chip text shows just the worker tag (e.g. `security`).
- [x] 5.4 Add `title={provenance.firstLine}` so the full prefix is visible on hover, and `aria-label={"Filed by ruflo-" + provenance.worker}`.
- [x] 5.5 Ensure the chip does NOT count toward the `task.labels.length > 2` `+N` overflow indicator.

## 6. WorkerFindingsPanel

- [x] 6.1 Create `src/components/health/WorkerFindingsPanel.tsx` that uses `useQuery(['worker-findings', projectPath], () => listWorkerFindings(projectPath))` to fetch findings, groups them by `worker`, sorts groups alphabetically, and sorts rows by priority ascending then `created_at` descending.
- [x] 6.2 Each section header shows: worker tag (with the same teal chip styling as the inline chip), total count, and a severity breakdown line `(1 critical, 4 high, 2 medium)` computed from `priority` via `priorityToSeverity()` in the helper. Hide severity counts of 0.
- [x] 6.3 Each finding row shows: issue ID (using the existing `renderWithChips`-equivalent rendering or a plain navigation button), `P{priority}` styled via `PRIORITY_STYLE`, title (truncate), and `created_at` short-date. Clicking the row calls the existing workspace `openPinned(issue_id)` (see `task-workspace` spec) — match the keyboard/Enter contract used by `TaskListItem`.
- [x] 6.4 Empty state: when `findings.length === 0`, render `"No worker findings. Run /audit, /ruflo-loop testgaps, or /ruflo-cost to generate some."` centred with the same neutral-600 chrome as the existing `"Click Re-run to start checks."` empty state.
- [x] 6.5 Loading state: spinner matching the existing `CheckSection` spinner. Error state: red error pill with the error string.

## 7. BdHealthPanel tab strip

- [x] 7.1 In `BdHealthPanel.tsx`, introduce a `useState<'checks' | 'findings'>('checks')` and render a small tab strip below the existing header. Style: underline tabs, `text-neutral-300` inactive, `text-neutral-100 border-b border-neutral-100` active. The strip is `border-b border-neutral-800` so it visually anchors to the header.
- [x] 7.2 Move the existing body (`bdNotFound`, `projectNotConnected`, `allPassed`, and the `CHECKS.map(...)` render) into a `<ChecksBody />` sub-component or inline conditional, gated by `tab === 'checks'`.
- [x] 7.3 When `tab === 'findings'`, render `<WorkerFindingsPanel />`.
- [x] 7.4 The `Re-run` button is gated to `tab === 'checks'`. When the findings tab is active, the button is hidden (no `Re-run` for findings — they refresh via the task-cache cycle).
- [x] 7.5 Verify the auto-run-on-mount effect (`useEffect` keyed on `[project, hasRun, runChecks]`) still triggers only the checks side and is not affected by tab state.

## 8. Verification

- [x] 8.1 `cargo test workers::tests` passes with parser and unresolved-row coverage.
- [x] 8.2 `bun tsc --noEmit` passes after bindings regeneration.
- [x] 8.3 `bun test src/lib/worker-findings.test.ts` passes.
- [x] 8.3a `bun test src/components/health/WorkerFindingsPanel.test.ts` passes.
- [ ] 8.4 Manual: `bun tauri dev`, trigger `/audit` (or seed a Beads issue with `bd create -t bug ... && bd update <id> --notes "Auto-filed by ruflo-security worker on $(date -u +%FT%TZ). Branch: main"`), confirm the new chip appears on its row in the task list and the issue appears under `security` in the Worker findings tab.
- [ ] 8.5 Manual: close the seeded issue via the task detail panel, confirm it disappears from the Worker findings tab within one task-cache refresh cycle.
- [ ] 8.6 Manual: confirm the `Checks` tab still auto-runs on mount and the `Re-run` button is hidden on the `Worker findings` tab.
- [x] 8.7 `openspec validate worker-findings-dashboard` passes with zero errors.
