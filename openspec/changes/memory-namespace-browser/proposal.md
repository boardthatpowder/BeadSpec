## Why

Ruflo memory is the institutional knowledge graph of the OpenSpec/Beads workflow — every issue close, scope change, and validate-history entry writes pipe-delimited keys (`branch:<b>|worktree:<w>|repo:<r>|openspec:<change>|issue:<id>|type:<t>|ts:<unix>`). Today the only UI for memory is `RufloMemoryPanel` on `TaskDetailPanel`: a per-task lazy search. Memory accumulated under unrelated namespaces, manually stored entries, and worker-finding side-channels are invisible. The user cannot enumerate, navigate, or curate memory; deletion and structured create do not exist in the UI at all. Without a dedicated browser, the long-term value of the memory layer compounds in the database but never reaches the user.

## What Changes

- A new top-level view **Memory** is added to `ViewSwitcher`, gated on the **Ruflo feature flag AND the `ruflo` PATH probe** (mirrors the existing OpenSpec gate but uses `ruflo` instead of `openspec`).
- A new `MemoryBrowser` screen renders three regions:
  - **Left rail:** a collapsible `NamespaceTree` parsed from pipe-delimited keys with the canonical hierarchy `branch:<b>` → `worktree:<w>` → `repo:<r>` → `openspec:<change>` → `issue:<id>` → `type:<t>`. Nodes show entry counts; clicking a node selects that namespace.
  - **Right pane:** a `MemoryList` showing entries under the selected namespace, columns: key · score · timestamp · preview, sorted by `ts` desc.
  - **Top toolbar:** a semantic search input (calls `rufloMemorySearch`), the active namespace breadcrumb, a **+ Store** button.
- Clicking a row opens a `MemoryDetailDrawer` showing the full content, the raw key, all parsed namespace facets, the score, and — if the key contains an `issue:<id>` facet — an **Open issue** link that navigates `setState({ view: 'all', taskId })`.
- Each row has a **Delete** action (with confirm) that calls a new `rufloMemoryDelete` Tauri command.
- A **+ Store** dialog (`StoreEntryDialog`) lets the user manually `ruflo memory store -k <key> -v <value>`; the dialog pre-fills the key with the selected namespace prefix and exposes a multiline value editor.
- Two new Tauri commands wrap the ruflo CLI: `ruflo_memory_store(key, value)` and `ruflo_memory_delete(key)`; both run under the existing `find_ruflo_with_override` + `run_ruflo_managed` plumbing in `src-tauri/src/commands/external.rs`. A new `ruflo_memory_list(namespace_prefix?, limit?)` command returns entries for the left-rail/right-pane render path (uses `ruflo memory list --format json --prefix <…>`).
- All ruflo CLI invocations are confined to the existing `external.rs` module; no shellouts are added on the frontend.

Non-goals (explicit):

- No bulk import/export of memory entries (`ruflo memory store/delete` only).
- No editing of existing entries — delete-and-recreate is the supported mutation path.
- No multi-namespace selection or saved searches in this change.
- No semantic-cluster visualisation, embedding-similarity heatmap, or graph rendering — this is a tree + list, not a graph view.
- No new persistence layer in Dolt — the memory store remains entirely in ruflo's AgentDB.
- No background polling — refresh is on view-mount, on selection change, on search submit, and on successful store/delete.

## Capabilities

### New Capabilities

- `memory-browser`: a new top-level view providing namespace-tree navigation, listing, semantic search, manual create, and delete over Ruflo memory entries.

### Modified Capabilities

- `layout-shell`: adds a "Memory" entry to the top navigation `ViewSwitcher`, gated on the Ruflo feature flag + PATH probe.
- `ruflo-memory-panel`: adds a navigation affordance from the per-task panel into the new Memory view (a small "Open in Memory browser" link that pre-selects the issue's namespace).

## Impact

- **Tauri commands (new):** `ruflo_memory_store(key, value)`, `ruflo_memory_delete(key)`, `ruflo_memory_list(namespace_prefix: Option<String>, limit: Option<u32>)` in a new module `src-tauri/src/commands/ruflo_memory.rs`. Existing `ruflo_memory_search` stays in `external.rs` for symmetry with `ruflo_version_probe`.
- **Module wiring:** `src-tauri/src/commands/mod.rs` exposes the new module; `src-tauri/src/lib.rs` registers the new commands in `tauri::generate_handler!` and `tauri_specta::collect_commands!`.
- **Type bindings:** new `MemoryEntry { key, score, namespace, preview, body, ts }` and `MemoryListResponse { entries: Vec<MemoryEntry>, total: u32 }` types auto-generated via `specta` into `src/bindings.ts`. Bindings regen is a task step.
- **Frontend IPC:** new wrappers `rufloMemoryList`, `rufloMemoryStore`, `rufloMemoryDelete` in `src/ipc.ts`.
- **Frontend components (new):** `src/components/memory-browser/MemoryBrowser.tsx` (screen), `NamespaceTree.tsx`, `MemoryList.tsx`, `MemoryDetailDrawer.tsx`, `StoreEntryDialog.tsx`, `parseMemoryKey.ts` (pure helper).
- **Frontend integration:** `src/components/layout/ViewSwitcher.tsx` gains a `'memory'` view ID gated on `useFeatureFlag('ruflo')` AND a `useRufloAvailable()` probe extracted into a shared hook. `src/components/layout/index.tsx` mounts `<MemoryBrowser />` when `state.view === 'memory'`.
- **Server state:** TanStack Query keys `['ruflo-memory', 'list', prefix]`, `['ruflo-memory', 'search', query]`; mutations for store/delete invalidate `['ruflo-memory']`.
- **No schema changes** to Dolt and **no new persistence** — memory remains in ruflo's AgentDB.
- **No CLI invariants violated:** all writes go through `ruflo memory store/delete`.
- **No skill changes** — existing skills (`openspec-beads-work`, `-followup`, `-complete`) that auto-write memory continue unchanged.
