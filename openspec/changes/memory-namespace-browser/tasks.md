## 1. Backend module + types

- [x] 1.1 Create `src-tauri/src/commands/ruflo_memory.rs`. Define structs `MemoryEntry { key: String, score: f32, namespace: String, preview: String, body: String, ts: Option<i64> }` and `MemoryListResponse { entries: Vec<MemoryEntry>, total: u32 }`, both deriving `serde::Serialize`, `serde::Deserialize`, and `specta::Type`.
- [x] 1.2 Add a private validator `is_valid_memory_key(key: &str) -> bool`: non-empty, ≤ 1024 chars, characters drawn from `[A-Za-z0-9:|=._/-]`. Reject any other byte to keep the value out of shell-injection paths.
- [x] 1.3 Add a private validator `is_valid_memory_value(value: &str) -> bool`: non-empty, ≤ 65536 bytes (64 KiB). No character restriction (value is passed as a single argv element, not via shell).
- [x] 1.4 Reuse `find_ruflo_with_override` and `run_ruflo_managed` from `external.rs` by making them `pub(crate)` if not already; do not duplicate them.

## 2. Tauri commands

- [x] 2.1 Add `ruflo_memory_list(namespace_prefix: Option<String>, limit: Option<u32>, settings: State<'_, Arc<Mutex<AppSettings>>>) -> Result<MemoryListResponse, String>`. Build argv `["memory", "list", "--format", "json"]`, append `["--prefix", <p>]` if `namespace_prefix` is `Some(non-empty)`, append `["--limit", <n>]` (default 500 if `None`). Parse stdout as JSON into `MemoryListResponse`. 10 s timeout.
- [x] 2.2 Add `ruflo_memory_store(key: String, value: String, settings: …) -> Result<(), String>`. Validate `key` and `value`. Build argv `["memory", "store", "-k", <key>, "-v", <value>]`. 10 s timeout. Returns `Ok(())` on exit 0, `Err(stderr)` otherwise.
- [x] 2.3 Add `ruflo_memory_delete(key: String, settings: …) -> Result<(), String>`. Validate `key`. Build argv `["memory", "delete", "-k", <key>]`. 10 s timeout. Same return contract as `store`.
- [x] 2.4 Register the new module in `src-tauri/src/commands/mod.rs` as `pub mod ruflo_memory;`.
- [x] 2.5 Register the three commands in `src-tauri/src/lib.rs` inside `tauri::generate_handler!` and `tauri_specta::collect_commands!`, adjacent to `ruflo_memory_search` and `ruflo_version_probe`.

## 3. Backend tests

- [x] 3.1 Unit test `is_valid_memory_key`: accepts canonical examples (`branch:foo|repo:bar|type:note`, `openspec:abc-def|issue:BEADSPEC-xqf|type:trajectory|ts:1700000000`); rejects shell metacharacters (`;`, `$`, `` ` ``, spaces, newlines, empty string, and an over-long input).
- [x] 3.2 Unit test `is_valid_memory_value`: accepts a small string, accepts a 64 KiB string, rejects empty, rejects 65537-byte string.
- [x] 3.3 Unit test that the argv constructed by `ruflo_memory_list` is exactly `["memory","list","--format","json","--prefix","branch:foo","--limit","250"]` when `namespace_prefix=Some("branch:foo")` and `limit=Some(250)`. Extract argv construction into a pure helper if needed to test without spawning.
- [x] 3.4 Unit test that `ruflo_memory_list` with `None` prefix omits `--prefix` and defaults limit to 500.
- [x] 3.5 Unit test that `ruflo_memory_store` rejects a key containing `;`, `$`, or a newline before any spawn happens.
- [x] 3.6 Unit test that `ruflo_memory_delete` rejects an empty key before any spawn happens.

## 4. IPC + bindings

- [x] 4.1 Run `bun tauri build` (or the existing `specta` codegen script) to regenerate `src/bindings.ts` with `MemoryEntry`, `MemoryListResponse`, `rufloMemoryList`, `rufloMemoryStore`, `rufloMemoryDelete`.
- [x] 4.2 Add wrappers to `src/ipc.ts`:
  - `rufloMemoryList(prefix?: string, limit?: number): Promise<MemoryListResponse>`
  - `rufloMemoryStore(key: string, value: string): Promise<void>`
  - `rufloMemoryDelete(key: string): Promise<void>`

## 5. Pure helpers

- [x] 5.1 Create `src/components/memory-browser/parseMemoryKey.ts` exporting `parseMemoryKey(key: string): MemoryFacets`. Implements "split on first colon" per the project label-parsing rule.
- [x] 5.2 Vitest covering: canonical key parses into all known facets; unknown facets land in `rest`; missing `|` returns `{ rest: {}, raw }`; numeric `ts:` parses into `ts: number`; non-numeric `ts:` parses into `rest.ts` string and leaves `ts` undefined.
- [x] 5.3 Create `src/components/memory-browser/useRufloAvailable.ts` hook that lazily probes `commands.rufloVersionProbe`, memoises the boolean result per app session, and returns `{ available, loading }`.

## 6. UI components

- [x] 6.1 Create `src/components/memory-browser/MemoryBrowser.tsx`: container layout (top toolbar, left rail, right pane, optional drawer). TanStack Query keys `['ruflo-memory','list', prefix]` and `['ruflo-memory','search', query]`.
- [x] 6.2 Create `NamespaceTree.tsx`: builds a tree from `MemoryListResponse.entries` via `parseMemoryKey` and the canonical hierarchy. Collapsible nodes via local `useState<Set<string>>` of expanded paths. Each node shows count. Bucket unparseable keys under `(unparsed)`.
- [x] 6.3 Create `MemoryList.tsx`: renders the right-pane rows. Columns key·score·timestamp·preview. Sort by `ts` desc (entries without `ts` sink to the bottom). Per-row delete icon (opens confirm dialog).
- [x] 6.4 Create `MemoryDetailDrawer.tsx`: shows raw key (copyable), parsed facet chips, full body, score (search mode only), Open-issue button (when `facets.issue` set), Delete button.
- [x] 6.5 Create `StoreEntryDialog.tsx`: form with key (pre-filled from selected namespace) + value + Store/Cancel. Client-side validation mirrors backend.
- [x] 6.6 Wire a small "Open in Memory browser" link in `RufloMemoryPanel.tsx` that calls `setState({ view: 'memory', memoryNamespace: <prefix derived from taskId+labels> })`. The browser reads `state.memoryNamespace` on mount and selects that node.
- [x] 6.7 Add a per-row Delete confirm dialog (re-use existing confirm-dialog primitive if one exists; otherwise inline modal). Confirm text shows the full key verbatim.

## 7. Navigation integration

- [x] 7.1 Extend `ALL_VIEWS` in `src/components/layout/ViewSwitcher.tsx` with `{ id: 'memory', label: 'Memory', description: 'Ruflo memory browser', feature: 'ruflo' }`; widen the `feature?` type to `'openspec' | 'ruflo'`.
- [x] 7.2 Update the filter in `ViewSwitcher` to also AND-gate the `'ruflo'`-flagged entries on `useRufloAvailable().available`.
- [x] 7.3 Add a redirect effect mirroring the OpenSpec one: if `activeView === 'memory'` and either gate flips false, `setState({ view: 'all' })`.
- [x] 7.4 Update `src/components/layout/index.tsx` to mount `<MemoryBrowser />` when `state.view === 'memory'`.
- [x] 7.5 Extend the hash-state schema to encode `view: 'memory'` (no `memoryNamespace` in the hash for this change — it lives in local UI state to avoid bloating the URL hash).

## 8. Frontend tests

- [x] 8.1 Vitest for `parseMemoryKey` per task 5.2.
- [x] 8.2 Vitest for `NamespaceTree.buildTree(entries)` (factor pure builder out of the component): canonical entries produce the expected tree shape; unparseable entries land in `(unparsed)`.
- [x] 8.3 React Testing Library: render `MemoryBrowser` with a mocked `rufloMemoryList` returning three entries across two namespaces; assert tree shows both branches, list shows all three entries sorted by `ts` desc, breadcrumb defaults to root.
- [x] 8.4 RTL: click a namespace node, assert the list filters and the breadcrumb updates.
- [x] 8.5 RTL: type in the search input, submit; assert `rufloMemorySearch` is called and list-mode swaps to search-mode (breadcrumb shows `Search: "<q>"`).
- [x] 8.6 RTL: click a row, assert `MemoryDetailDrawer` mounts; click "Open issue", assert `setState` invoked with `{ view: 'all', taskId: <id> }`.
- [x] 8.7 RTL: click Delete in the drawer, confirm, assert `rufloMemoryDelete` called and the query is invalidated.
- [x] 8.8 RTL: click + Store, fill the form, submit, assert `rufloMemoryStore` called with the composed key and that the list query is invalidated.
- [x] 8.9 RTL: with Ruflo flag disabled, the Memory view button is absent from `ViewSwitcher`.
- [x] 8.10 RTL: with Ruflo flag enabled but `useRufloAvailable().available === false`, the Memory view button is absent.

## 9. Verification

- [x] 9.1 `cargo test -p beadspec_lib ruflo_memory::` passes.
- [x] 9.2 `bun tsc --noEmit` passes after bindings regen.
- [x] 9.3 `bun test` passes (Vitest + RTL suites).
- [x] 9.4 Manual: with `ruflo` installed and the feature flag on, launch `bun tauri dev`, switch to Memory, confirm the tree populates, click a namespace, observe entries filter, search for a token, observe results swap.
- [x] 9.5 Manual: + Store a new entry under the currently selected namespace, observe it appear in the list within one query cycle; delete it, observe it disappear.
- [x] 9.6 Manual: open an entry whose key includes `issue:<id>`; click Open issue; confirm `TaskDetailPanel` opens on that issue.
- [x] 9.7 Manual: turn the Ruflo flag off in Settings while on the Memory view; confirm the view redirects to All and the nav entry disappears.
- [x] 9.8 Manual: with `ruflo` missing from PATH, confirm the Memory view button is hidden even with the flag on.
- [x] 9.9 `openspec validate memory-namespace-browser` passes.
