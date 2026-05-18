## 1. Backend: event types & ring buffer

- [x] 1.1 Create `src-tauri/src/events/mod.rs` and `src-tauri/src/events/activity.rs`. Define `ActivityEvent` struct (`id`, `ts`, `kind`, `source`, `summary`, `detail: serde_json::Value`, `correlation_id: Option<String>`) deriving `serde::Serialize`, `serde::Deserialize`, `specta::Type`, `Clone`.
- [x] 1.2 Implement `ActivityRingBuffer`: a `Mutex<VecDeque<ActivityEvent>>` capped at 5000 entries and evicting events older than `now - 7 days` on each call to `push()`. Expose `push(event)`, `since(ts: Option<DateTime<Utc>>, limit: usize) -> Vec<ActivityEvent>`.
- [x] 1.3 Expose `emit_event(handle: &AppHandle, buf: &ActivityRingBuffer, event: ActivityEvent)` that pushes to the ring buffer and emits on the `workflow:activity` Tauri event topic.
- [x] 1.4 Write unit tests: ring buffer cap eviction (push 5001 entries → len stays ≤ 5000); horizon eviction (push event with ts = now-8d → absent from `since(None, 5000)`); `since_ts` slicing (seed 10 events at t0..t9, query since t5 → returns exactly 5 events).

## 2. Backend: event sources

- [x] 2.1 Extend `src-tauri/src/db/poller.rs` (or `watchers.rs`) to call `events::activity::emit_bd_event(handle, buf, kind, issue_id, summary)` for each classified change-set delta. Map Dolt diff ops to kinds: `issues.status → done` = `bd.close`, new issue row = `bd.create`, `bd.update` for status changes, `dependencies` table inserts/deletes = `bd.dep_add` / `bd.dep_remove`. `correlation_id` = issue ID.
- [x] 2.2 Implement `events::activity::start_ruflo_memory_source(handle, buf)` polling every 3 seconds for ruflo memory rows matching `type:event`. Parse key segments by `|`-splitting then per-segment `split_once(':')`. Watermark on highest `ts:` segment seen in the current process; skip rows with `ts ≤ watermark`. Emit via `emit_event`. Malformed JSON values are logged at WARN and skipped.
- [x] 2.3 Implement `events::activity::start_gitnexus_source(handle, buf)` polling every 5 seconds. Reads all `$PROJECT_DIR/.claude/cache/gitnexus-*-ack` and `gitnexus-*.json` mtimes. Emits `kind: gitnexus.index_stale` (source: `gitnexus`) when the newest index JSON mtime is more than 300 seconds newer than the newest ack mtime. Emits `kind: gitnexus.index_refreshed` when any index JSON mtime advances beyond the previous poll value.
- [x] 2.4 Wire all three sources in a single startup function `events::activity::start_all_sources(handle, buf, project_dir)` called from `src-tauri/src/lib.rs` during app setup. Stagger source starts by 1 second each (bd at 0s, ruflo memory at 1s, gitnexus at 2s) using `tokio::time::sleep` before each `interval`.

## 3. Backend: command + IPC registration

- [x] 3.1 Add Tauri command `list_recent_events(project_path: String, limit: u32, since_ts: Option<String>) -> Result<Vec<ActivityEvent>, String>`. Returns ring-buffer slice newer than `since_ts` (parsed as RFC-3339), most-recent-first, capped at `limit`. Returns an error string (not panic) on parse failure.
- [x] 3.2 Register `list_recent_events` in `src-tauri/src/lib.rs` in both `tauri::generate_handler![]` and `tauri_specta::collect_commands![]` alongside the existing OpenSpec commands.

## 4. Backend tests

- [x] 4.1 Integration test: seed a ruflo memory row with `type:event|kind:test.demo` and assert the ruflo memory source poller emits exactly one `ActivityEvent` with `kind == "test.demo"` and does not re-emit it on the next poll cycle.
- [x] 4.2 Integration test: trigger a `bd close`-equivalent diff through the existing `db/poller.rs` test harness and assert both `task_list_changed` and `workflow:activity` Tauri events fire within the poll interval. Assert `ActivityEvent.kind == "bd.close"` and `correlation_id` matches the issue ID.
- [x] 4.3 Unit test: `list_recent_events` with `since_ts` set to a future timestamp returns an empty vec.
- [x] 4.4 Unit test: malformed JSON value in a ruflo memory row logs a warning and does not panic.

## 5. IPC + bindings

- [x] 5.1 Run the `specta` codegen step (same as `bun tauri build` or the project's `scripts/regen-bindings.sh`) to regenerate `src/bindings.ts` with `ActivityEvent`, `listRecentEvents`.
- [x] 5.2 Add `listRecentEvents(projectPath: string, limit: number, sinceTs?: string): Promise<ActivityEvent[]>` wrapper in `src/ipc.ts`, matching the style of `getChangeBeadsProgress`.

## 6. Frontend integration

- [x] 6.1 Add `{ id: 'activity', label: 'Activity' }` entry to `ALL_VIEWS` in `src/components/layout/ViewSwitcher.tsx`, positioned between Health and Changes.
- [x] 6.2 Add `isActivityView` branch in `src/components/layout/index.tsx` (or `AppLayout.tsx`) alongside the existing `isHealthView` / `isChangesView` pattern; render `<ActivityFeed />` when active.
- [x] 6.3 Build `src/components/activity-feed/useActivityStream.ts`: on mount calls `listRecentEvents` (TanStack Query), subscribes to the `workflow:activity` Tauri event, appends new events to the query cache. Unsubscribes on unmount.
- [x] 6.4 Build `src/components/activity-feed/ActivityRow.tsx`: renders `ts` (monospaced, `HH:mm:ss`), a kind-badge chip (using `LABEL_CHIP_COLORS` keyed on `event.source`), `summary` (truncated at 80 chars, full on hover). Click toggles an expand section showing `detail` JSON pretty-printed in a `<pre>` block that is selectable.
- [x] 6.5 Build `src/components/activity-feed/ActivityFilters.tsx`: source multi-select chips (`bd`, `hook`, `gitnexus`) and three range pills (`Last hour`, `Today`, `Week`). Default range is `Today`. Filter state is read from and written to `HashStateContext` keys `activityKinds` (comma-separated) and `activityRange`.
- [x] 6.6 Build `src/components/activity-feed/useAutoFollow.ts`: accepts a `scrollRef` and a boolean `isAutoFollow`. When `isAutoFollow` is true, scrolls to the bottom on every new event. Detects user scroll-up (> 50px above bottom) and calls an `onDisable()` callback. Exposes `scrollToBottom()` for the "Jump to latest" pill.
- [x] 6.7 Build `src/components/activity-feed/ActivityFeed.tsx`: composes the above. Virtualises the list with `@tanstack/react-virtual`. Shows an empty state ("No activity yet") when the feed is empty. Shows an error toast and a "Retry" link if `listRecentEvents` throws. Shows the "Jump to latest" pill (bottom-right, absolute) when auto-follow is disabled.

## 7. Docs

- [x] 7.1 Add (or append to) `.claude/hooks/README.md` a section titled "Optional activity-feed writeback". Include: the key schema (`branch:<b>|worktree:<w>|repo:<r>|type:event|kind:<k>|ts:<unix>`), the value JSON schema (`{ "summary": "...", "detail": {...}, "correlation_id"?: "..." }`), the kind namespace table (bd.*, hook.*, gitnexus.*, worker.*, session.*), and a copy-paste snippet: `ruflo memory store -k "$(source ~/.claude/ruflo/lib/tags.sh && ruflo_key_prefix)|type:event|kind:hook.example|ts:$(date +%s)" -v '{"summary":"…","detail":{}}'`.

## 8. Verification

- [x] 8.1 `cargo test -p beadspec_lib events::activity::tests` passes.
- [x] 8.2 `bun tsc --noEmit` passes after bindings regen.
- [x] 8.3 Manual: close a bd issue in the terminal; within 2 seconds a `bd.close` row appears in the Activity feed.
- [x] 8.4 Manual: run `ruflo memory store -k "branch:test|worktree:test|repo:beadspec|type:event|kind:hook.demo|ts:$(date +%s)" -v '{"summary":"demo event","detail":{}}'`; within 3 seconds a `hook.demo` row appears in the feed.
- [x] 8.5 Manual: touch a file in `.claude/cache/` matching `gitnexus-*.json`; within 5 seconds a `gitnexus.index_refreshed` row appears.
- [x] 8.6 Manual: scroll up in the feed — auto-follow disables and the "Jump to latest" pill appears; click the pill — auto-follow re-engages and the view scrolls to the bottom.
- [x] 8.7 Manual: select the `hook` kind filter — only `hook.*` rows are visible.
- [x] 8.8 `openspec validate workflow-activity-feed` passes.
