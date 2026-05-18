## 1. Backend types & command

- [x] 1.1 Create `src-tauri/src/commands/ruflo_sessions.rs`. Define `SessionSnapshot { id: String, name: String, created_at: String, is_auto: bool, metadata: Option<serde_json::Value> }` deriving `serde::Serialize`, `serde::Deserialize`, and `specta::Type`. Compute `is_auto` from `name.starts_with("auto-")` at parse time.
- [x] 1.2 Implement `list_session_snapshots(project_path: String) -> Result<Vec<SessionSnapshot>, String>` Tauri command: spawn `ruflo session list --json` via `std::process::Command` with `current_dir(project_path)`. On exit code 0, parse stdout into `Vec<SessionSnapshot>`. On I/O error or "command not found", return the sentinel `Err("ruflo CLI not found".to_string())`. On non-zero exit code, return `Err(stderr_verbatim)`. On JSON parse failure, return `Err` containing the parse error and leading stdout characters.
- [x] 1.3 Add `pub mod ruflo_sessions;` to `src-tauri/src/commands/mod.rs`. Register `list_session_snapshots` in `src-tauri/src/lib.rs` in both `tauri::generate_handler!` and the `tauri_specta::collect_commands!` macro alongside existing commands.

## 2. Backend tests

- [x] 2.1 Unit test: parse a representative `ruflo session list --json` fixture string (a JSON array with one `auto-*` entry and one non-`auto-*` entry) into `Vec<SessionSnapshot>`; assert `is_auto` is `true` for the `auto-*` name and `false` for the other.
- [x] 2.2 Unit test: malformed JSON input returns `Err` whose message contains the JSON parse error and at least the first 40 characters of the malformed input.
- [x] 2.3 Note: if the codebase has no existing pattern for mocking spawned child processes at the command level, document the gap in a code comment and rely on the parser-level unit tests (2.1, 2.2) instead. File a follow-up Beads issue for the mock-spawn integration test.

## 3. IPC + bindings

- [x] 3.1 Run the specta codegen step (`bun tauri build` or the project's codegen script if defined) to regenerate `src/bindings.ts` with `SessionSnapshot` and `listSessionSnapshots`.
- [x] 3.2 Add `listSessionSnapshots(projectPath: string): Promise<SessionSnapshot[]>` wrapper in `src/ipc.ts`, matching the style of existing wrappers (e.g. `getChangeBeadsProgress`).

## 4. Frontend — tab strip in `BdHealthPanel`

- [x] 4.1 Add `const [activeTab, setActiveTab] = useState<'checks' | 'sessions'>('checks')` near other panel-level state in `BdHealthPanel.tsx`.
- [x] 4.2 Render a tab strip immediately below the panel header. Two tabs: "Checks" (default) | "Sessions". Style: `text-sm` neutral text, `border-b-2 border-current` on the active tab, no pill or background.
- [x] 4.3 Wrap the existing checks markup in `{activeTab === 'checks' && (…)}`. Render `<SessionsTab project={project} />` in the `{activeTab === 'sessions' && (…)}` block.
- [x] 4.4 Move the "Re-run" button so it only renders when `activeTab === 'checks'`. The Sessions tab owns its own Refresh button inside `SessionsTab`.

## 5. Frontend — `SessionsTab.tsx`

- [x] 5.1 Create `src/components/health/SessionsTab.tsx`. Accept `{ project: string }` as props.
- [x] 5.2 Local state: `snapshots: SessionSnapshot[] | null`, `isLoading: boolean`, `error: string | null`, `selectedId: string | null`, `rufloNotFound: boolean`.
- [x] 5.3 `useEffect` on mount and on `project` change: call `listSessionSnapshots(project)`, update state. Detect the `"ruflo CLI not found"` sentinel by checking `err.message?.includes('ruflo CLI not found')` (or the exact string returned by the Tauri command) and set `rufloNotFound = true`.
- [x] 5.4 Render three states: (a) `rufloNotFound` → "Ruflo CLI not configured" empty state with install hint, matching the `bdNotFound` pattern in `BdHealthPanel`; (b) `snapshots.length === 0` → "No session snapshots yet. Snapshots are created automatically when a Claude Code session ends."; (c) populated → list of `<button>` rows, newest first, each showing timestamp + `auto|manual` chip + metadata summary (issue count and files-changed count when present in `metadata`).
- [x] 5.5 Render a "Refresh" button in the tab header. Clicking it re-runs step 5.3. Disable the button while `isLoading` is true.
- [x] 5.6 Drawer: `<aside>` fixed-right, `w-96 max-w-full`, slide-in. Opens when `selectedId !== null`. Renders: snapshot name, formatted created-at, full `metadata` as `<pre className="text-[10px] font-mono overflow-auto">`, and two action buttons ("View memory entries from this session" / "Restore conversation context"). Closes on Esc and on backdrop click.

## 6. Frontend — drawer actions

- [x] 6.1 "View memory entries from this session": compute `from = selected.created_at` (parse to ms), `to = nextSnapshot?.created_at ?? Date.now()`. Clamp `from` to `now - 30 days`; if the gap between `from` and `to` exceeds 7 days, show a `<p className="text-xs text-amber-600">Window may include earlier sessions</p>` hint in the drawer. Attempt to navigate to the Memory view with `?ts_from=<ms>&ts_to=<ms>` using the existing routing primitive (`setState({ view: 'memory', … })`). If that route or its param support does not yet exist, copy `|ts:<from>-<to>|` to clipboard with a toast and file a follow-up Beads issue.
- [x] 6.2 "Restore conversation context": call `navigator.clipboard.writeText(snapshot.id)`. On success, show a toast: "Snapshot ID copied. Paste into a fresh Claude Code session: `ruflo session restore <id>`". On clipboard rejection, show a fallback toast displaying the full snapshot ID so the user can copy it manually.
- [x] 6.3 Close the drawer on `Escape` keydown (via `useEffect` adding a window keydown listener while `selectedId !== null`) and on backdrop overlay click.

## 7. Verification

- [x] 7.1 `cargo test -p beadspec_lib ruflo_sessions::tests` passes (covers tasks 2.1 and 2.2).
- [x] 7.2 `bun tsc --noEmit` passes after bindings regeneration.
- [x] 7.3 `bun run lint` passes for `BdHealthPanel.tsx` and `SessionsTab.tsx`.
- [x] 7.4 Manual: open a project that has run at least one Claude Code session with the Stop hook enabled. Open Health view → Sessions tab → confirm at least one row appears. Click a row → drawer opens with metadata JSON. Click "Restore conversation context" → clipboard contains the snapshot ID and toast appears.
- [x] 7.5 Manual: with `ruflo` removed from PATH, confirm the Sessions tab shows "Ruflo CLI not configured" and the Checks tab continues to work normally.
- [x] 7.6 `openspec validate session-snapshot-timeline` passes.
