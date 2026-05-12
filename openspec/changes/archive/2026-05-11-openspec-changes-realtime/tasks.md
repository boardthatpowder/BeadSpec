## 1. Backend — Recursive file watcher

- [x] 1.1 In `src-tauri/src/db/watchers.rs` `OpenSpecWatcher::start()`, change `RecursiveMode::NonRecursive` to `RecursiveMode::Recursive`
- [x] 1.2 Add `EventKind::Modify(_)` to the event filter alongside the existing `Create` and `Remove` arms
- [x] 1.3 Add a path filter so only events where a path ends in `.md` or has no extension (directory event) trigger the channel send

## 2. Frontend — ChangeCard progress staleness

- [x] 2.1 In `src/components/changes-browser/ChangeCard.tsx`, add `change.last_modified` to the `useEffect` dependency array for the `getChangeProgress` call

## 3. Verification

- [x] 3.1 Run `cargo build` in `src-tauri/` with no errors
- [x] 3.2 Launch the app, open a project, navigate to Changes view — confirm existing cards load
- [x] 3.3 In a terminal, edit `tasks.md` in an existing change (toggle a checkbox) — confirm the progress bar updates within 2 seconds without manual refresh
- [x] 3.4 Run `openspec new change test-realtime-x` and confirm a new card appears without refresh; then delete the directory and confirm it disappears
- [x] 3.5 Create `proposal.md` in an existing draft change — confirm the card's proposal link activates
