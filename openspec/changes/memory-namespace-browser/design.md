## Context

The Ruflo memory layer holds the workflow's structured trajectory and context. Every `openspec-beads-*` skill writes entries on claim and close, using the helper `ruflo_key_prefix` to build a pipe-delimited key whose canonical shape is:

```
branch:<branch>|worktree:<wt>|repo:<repo>|openspec:<change>|issue:<id>|type:<t>|outcome:<o>|ts:<unix>
```

Today the only UI is `RufloMemoryPanel`, which fires `ruflo memory search -q <title+labels> --format json` and displays a flat result list. Browsing the namespace tree, listing entries by namespace, manually storing entries, and deleting entries are all CLI-only.

This change adds a first-class Memory view — analogous in layout to `bd-health-panel` but rooted on ruflo — and the minimum set of Tauri commands (`ruflo memory list/store/delete`) to make it functional. It does **not** replace `RufloMemoryPanel`; the per-task panel remains the entry point from a task and now gets a navigation affordance into the new view.

## Goals / Non-Goals

**Goals:**

- Provide a dedicated `Memory` view in the top navigation, behind the same dual gate as the rest of the Ruflo surface (feature flag + PATH probe).
- Render a collapsible namespace tree derived purely from parsing keys returned by `ruflo memory list --format json`, with no schema assumptions beyond the documented `branch:/worktree:/repo:/openspec:/issue:/type:` facet set.
- Allow the user to: select a namespace node, see all entries under it, search semantically across namespaces, open an entry in a detail drawer, delete an entry, and manually create an entry pre-scoped to the selected namespace.
- Surface an "Open issue" deeplink whenever a memory's key contains `issue:<id>`, navigating to `setState({ view: 'all', taskId: <id> })`.
- All ruflo invocations stay in `src-tauri/src/commands/`. The frontend never shells out.
- Auto-generate TS bindings via `specta` / `tauri-specta`, consistent with existing Ruflo commands.

**Non-Goals:**

- No editing of existing entries (delete-and-recreate is the supported flow).
- No bulk operations (no multi-select delete, no namespace-level delete in this change).
- No background polling or live event stream for memory changes — refresh on view mount, selection change, search submit, and post-mutation only.
- No new persistence in Dolt. Memory remains entirely in ruflo's AgentDB.
- No graph / cluster visualisation. Tree + list only.
- No saved searches, no search history, no autocomplete on key facets in this change.
- No moving the existing per-task `RufloMemoryPanel` into the new view.

## Decisions

### 1. New top-level view `memory` in `ViewSwitcher`, dual-gated on Ruflo flag + PATH probe

Add to `ALL_VIEWS` in `src/components/layout/ViewSwitcher.tsx`:

```ts
{ id: 'memory', label: 'Memory', description: 'Ruflo memory browser', feature: 'ruflo' }
```

Extend the `feature?` discriminator to accept `'ruflo'` alongside `'openspec'`. The filter expression also AND-gates `'ruflo'`-flagged entries on `useRufloAvailable().available`, a hook that wraps `commands.rufloVersionProbe` and caches the result for the session. The view is hidden when either gate is false; if the active view becomes `'memory'` while a gate flips false, the redirect-to-`'all'` effect handles the fallback.

**Alternative considered:** put Memory under a "Tools" sub-menu. Rejected — `Health` is already a peer top-level view and Memory has equal stature in the workflow. The view list stays flat.

### 2. New capability `memory-browser` (not folded into `ruflo-memory-panel`)

The existing `ruflo-memory-panel` capability describes a per-task collapsible section. The new view is a top-level navigation surface with namespace tree, list, drawer, search, store, and delete — a fundamentally different shape. Folding everything into `ruflo-memory-panel` would over-bloat that spec. The new capability `memory-browser` gets ADDED Requirements; `ruflo-memory-panel` gets a single MODIFIED Requirement adding the deeplink from panel → view; `layout-shell` gets a MODIFIED Requirement adding the Memory nav entry.

### 3. Backend: thin wrapper over `ruflo memory <subcommand> --format json`

Add `src-tauri/src/commands/ruflo_memory.rs` with three commands, each routed through `find_ruflo_with_override` + `run_ruflo_managed`:

- `ruflo_memory_list(namespace_prefix: Option<String>, limit: Option<u32>)` — invokes `ruflo memory list --format json [--prefix <…>] [--limit <n>]`. Default `limit` of 500 when `None`.
- `ruflo_memory_store(key: String, value: String)` — validates `key` is non-empty and contains only `[A-Za-z0-9:|=._/-]` (≤ 1024 chars); validates `value` non-empty, ≤ 64 KiB. Invokes `ruflo memory store -k <key> -v <value>`.
- `ruflo_memory_delete(key: String)` — validates `key` non-empty + same alphabet. Invokes `ruflo memory delete -k <key>`.

`ruflo_memory_search` stays in `external.rs` unchanged.

**Alternative considered:** call AgentDB directly from Rust (skip the CLI). Rejected — the CLI is the documented public interface, it handles ONNX embedding and Graph-RAG indexing on write, and bypassing it would violate the project rule "all persistent agent context lives in AgentDB via `ruflo memory`".

### 4. Key parsing is a pure TS helper (`parseMemoryKey.ts`)

Keys are pipe-delimited facets `name:value`. Parsing follows the project-wide rule "split on first colon only":

```ts
export type MemoryFacets = {
  branch?: string
  worktree?: string
  repo?: string
  openspec?: string
  issue?: string
  type?: string
  rest: Record<string, string>
  ts?: number
  raw: string
}
export function parseMemoryKey(key: string): MemoryFacets { /* split on '|', then on first ':' */ }
```

Unknown facet names land in `rest`. Malformed entries (no `|`, no `:`) yield `{ rest: {}, raw }` and are bucketed under a synthetic `(unparsed)` root in the tree.

### 5. Namespace tree rendering

The tree is built client-side by feeding parsed keys through the hierarchy `branch → worktree → repo → openspec → issue → type`. Empty levels are skipped. Each node holds a count and a `prefix` string suitable for the `ruflo_memory_list --prefix` argument. Selection state is local UI state (`useState`), not URL-encoded.

**Empty-state behaviour:**

- No entries at all → right pane shows "No memories yet. Click + Store to add one."
- A namespace selected with no entries → right pane shows "No entries under this namespace."

### 6. Right-pane list, sorted by `ts` desc

Columns: **Key** (truncated facets), **Score** (`—` for namespace-list mode), **Timestamp** (relative if < 7 days, else ISO date), **Preview** (`body.slice(0, 120) + '…'`). Rows are clickable → opens `MemoryDetailDrawer`. A delete icon at the row end opens a confirm dialog.

### 7. Search mode swaps the list source

When the user types in the search input and submits (Enter or 300 ms debounce), the right pane switches to search mode: calls `rufloMemorySearch(query)` and renders the returned results. The left rail counts remain based on the last `ruflo_memory_list` snapshot. A "Clear search" button restores list mode. The breadcrumb shows `Search: "<query>"` in search mode.

### 8. Detail drawer + Open-issue affordance

`MemoryDetailDrawer` is a right-side slide-over. It shows:

- The raw key in a monospaced code block (copyable).
- Each parsed facet as a labelled chip, reusing `LABEL_CHIP_COLORS` palette (`branch:` cyan, `worktree:` purple, `repo:` slate, `openspec:` indigo, `issue:` amber, `type:` neutral).
- The full body in a `<pre>` block.
- A score badge (search mode only).
- An **Open issue** button if `facets.issue` is set: `setState({ view: 'all', taskId: facets.issue })`.
- A **Delete** button (with confirm) wired to `rufloMemoryDelete`.

### 9. + Store dialog

`StoreEntryDialog` is a modal pre-filling the key field with the selected namespace prefix plus a trailing `|`. Field layout: **Key** (text input, validated against the same alphabet as the backend) and **Value** (multiline textarea, required, ≤ 64 KiB with character counter). On success, invalidates the `['ruflo-memory']` query and closes the dialog. Validation errors are shown inline; backend errors bubble into a toast.

### 10. Refresh + invalidation strategy

- `MemoryBrowser` mounts → fire `ruflo_memory_list` with no prefix (root snapshot, capped at 500).
- Selecting a namespace node → re-fetch with that prefix.
- Submitting a search → fire `ruflo_memory_search`; results stored in a separate query key.
- Successful `store` or `delete` → invalidate `['ruflo-memory']`.

The dolt-log poller is not wired to memory mutations in this change; ruflo doesn't emit Tauri events for memory writes. A manual refresh button on the toolbar handles stale-data recovery.

### 11. UI design direction

- **Register:** `product`. Application UI, not marketing. Implementers use `impeccable craft` (product register) rather than the brand register.
- **Aesthetic:** minimalist-utility. Small chips, neutral palette consistent with `LABEL_CHIP_COLORS` in `src/components/task-list/TaskListItem.tsx`. Low chrome. Dense but legible. The left rail mimics the existing task list; the right pane mimics existing list-row design.
- **Anti-references:** no novelty chrome, no animated splashes, no AI-stock gradients, no card-shadow inflation, no rainbow tag pickers.
- **Skills used at implementation time:** `impeccable craft` to draft new components, `impeccable audit` to review the diff against the rest of the app, `minimalist-ui` reference when condensing the namespace tree, `gitnexus-impact-analysis` before modifying `ViewSwitcher` or `RufloMemoryPanel`.

ASCII mockup:

```
┌─ Memory ──────────────────────────────────────────────────────────────────────┐
│ [ search semantic… ]  branch:feat/x ▸ worktree:bs ▸ repo:BeadSpec   [+ Store] │
├──────────────────────────────┬────────────────────────────────────────────────┤
│ ▾ branch:feat/changes        │ key                      score  ts      ⋯      │
│   ▾ worktree:BeadSpec        │ …|issue:BS-xqf|type:traj   —   3m ago   🗑     │
│     ▾ repo:BeadSpec          │ …|issue:BS-xqf|type:close  —   1h ago   🗑     │
│       ▸ openspec:dep-chips   │ …|issue:BS-mwl|type:note   —   2d ago   🗑     │
│       ▸ openspec:memory-…    │                                                │
│     ▸ repo:other             │                                                │
│ ▸ branch:main                │                                                │
│ (unparsed) (3)               │                                                │
└──────────────────────────────┴────────────────────────────────────────────────┘
```

## Risks / Trade-offs

- **Ruflo CLI surface drift** — if `ruflo memory list` or `delete` flags change, the Rust commands break. **Mitigation:** small command surface in one module; pin behaviour with an integration test asserting the exact argv constructed.
- **Large payloads** — projects with thousands of memory entries could blow up the initial list response. **Mitigation:** default `limit` of 500, "Load more" pagination, namespace-prefix filter as the primary navigation path.
- **Stale tree counts after concurrent writes** — a memory write in another process won't reflect until the user changes selection or hits Refresh. **Mitigation:** manual refresh button. Acceptable for v1.
- **Malformed keys** — entries written by ad-hoc scripts may not match the canonical hierarchy. **Mitigation:** the parser falls back to an `(unparsed)` synthetic node; nothing crashes.
- **Destructive delete with no undo** — `ruflo memory delete` has no soft-delete. **Mitigation:** confirm dialog with the key displayed verbatim; document the action is irreversible.
- **PATH probe latency** — `find_ruflo_with_override` scans `~/.nvm/versions/node`. **Mitigation:** existing behaviour; cache the probe result in `useRufloAvailable` for the session.
- **Key alphabet** — values inside a facet can contain `/` (e.g. branch names like `feat/foo`); the validator allows `/`. We do not allow `|` or `:` inside values as they collide with the delimiter set. Matches `ruflo_key_prefix` behaviour.
