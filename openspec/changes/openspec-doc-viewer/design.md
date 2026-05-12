## Context

The workspace tab model in `workspace.ts` currently represents every open tab as a plain `taskId: string`. `paneTree.ts` types `LeafPane.tabs` as `string[]`. `LeafPane.tsx` unconditionally renders `<TaskDetailPanel taskId={activeTabId} />`. Every store action, persistence layer, and tab component assumes tab = task. Extending this to support OpenSpec doc tabs requires threading a discriminated union through all of these layers.

On the backend, `ChangeInfo` (`openspec.rs:11-19`) tracks `has_proposal`, `has_design`, `has_tasks` as booleans. There is no listing of delta-spec files. `read_change_artifact` (line ~163) joins the artifact name directly to the change directory, so it already works for nested paths — this needs verification but no likely change.

## Goals / Non-Goals

**Goals:**
- Unified `TabId` discriminated union so workspace tabs can hold task or doc content without parallel data structures.
- Read-only markdown rendering of any OpenSpec artifact inside a workspace tab, with the same tab chrome (close, reorder, persist) as task tabs.
- `ChangeInfo.specs` surfaces delta-spec ids so both `ChangeCard` and `OpenSpecPanel` can render them as chips.
- Clicking any artifact chip/link routes to `openDocTab` instead of `openPath`.

**Non-Goals:**
- Editable markdown (docs are read-only in the viewer).
- Live file-watching / auto-reload of doc content while the tab is open.
- Rendering non-OpenSpec markdown (not extending to arbitrary files).
- Persisting doc tab scroll position.

## Decisions

### 1. Discriminated TabId type

Replace `tabs: string[]` in `LeafPane` (paneTree.ts) with `tabs: TabId[]` where:

```ts
type TaskTab = { kind: 'task'; id: string }          // id = taskId (stable, unique)
type DocTab  = { kind: 'doc';  id: string; change: string; artifact: string }
              // id = `doc:${change}:${artifact}` — stable, globally unique
type TabId   = TaskTab | DocTab
```

Using a single `id` string that encodes kind+payload means all existing dnd-kit sort keys, Zustand map keys, and persistence keys remain strings — no structural breakage. The `kind` field is decoded only at render time.

**Alternative considered**: keep `tabs: string[]`, encode kind in the string itself (e.g. `doc::change::artifact`). Rejected — stringly-typed, hard to refactor, error-prone at parse sites.

### 2. Store changes

- `openTab(tab: TabId)` — replaces `openPreview(taskId)` semantics; doc tabs always open as pinned (no preview concept for docs).
- `openDocTab(change, artifact)` — convenience action that constructs the DocTab and calls `openTab`; deduplicates (brings existing tab to focus if already open).
- Existing `closeTab`, `reorderTab`, `moveTab`, `splitWithTab` accept `TabId` instead of `string`; sort/equality uses `tab.id`.
- `dirtyTabs` and `innerSubTab` maps continue to key on `tab.id`; doc tabs never appear in `dirtyTabs` (read-only).

### 3. LeafPane rendering dispatch

`LeafPane.tsx` switches on `activeTab.kind`:
- `'task'` → existing `<TaskDetailPanel taskId={activeTab.id} />`
- `'doc'` → new `<OpenSpecDocPanel change={activeTab.change} artifact={activeTab.artifact} />`

### 4. OpenSpecDocPanel implementation

Fetches markdown via `invoke('read_change_artifact', { change, artifact })` on mount. Renders using a tiptap `useEditor({ extensions: [StarterKit, Markdown], content, editable: false })`. Reuses the same tiptap config as `DescriptionEditor.tsx` (same imports, `editable: false`). Shows a loading skeleton while fetching and an error state if the file is missing.

**Why tiptap over a simpler markdown renderer**: tiptap-markdown is already bundled and tree-shaken — adding another renderer (marked, remark) would increase bundle size for no benefit.

### 5. Backend: ChangeInfo.specs field

Add `specs: Vec<String>` to `ChangeInfo`. In `change_info_for_dir`, after checking for proposal/design/tasks, glob `specs/*/spec.md` relative to the change dir and collect the spec-id part (directory name between `specs/` and `/spec.md`). This is pure filesystem reads — no performance concern.

Verify `read_change_artifact` handles artifact paths with `/` correctly (Rust path join is safe; Tauri's path API normalises separators on Windows).

### 6. TabBar and Tab component

`Tab.tsx` accepts `TabId` instead of `taskId: string`. Label for doc tabs: `<change>/<artifact-basename>` (e.g. `cross-split-tab-drag/proposal`). Icon: a document icon distinct from the task icon.

### 7. Persistence

`workspacePersist.ts` serialises `LeafPane.tabs` as JSON. `TabId` objects serialise cleanly. On rehydration, `kind === 'doc'` tabs re-fetch content on mount. No migration needed for existing persisted layouts (existing string entries have no `kind` field — add a migration shim: if `typeof tab === 'string'`, coerce to `{ kind: 'task', id: tab }`).

## Risks / Trade-offs

- **Migration shim**: persisted layouts store `tabs` as plain strings today. The shim in `workspacePersist.ts` must run before Zustand's `set` to avoid a crash on existing installs. This is a one-time read-time normalisation — low risk.
- **Tab deduplication for docs**: two clicks on the same artifact should focus the existing tab, not open a duplicate. `openDocTab` must check `leaf.tabs.some(t => t.id === newTab.id)` across all leaves, not just the active pane.
- **read_change_artifact path traversal**: artifact paths come from UI state (change name + artifact string). The Rust handler must validate that the resolved path stays within `<project_root>/openspec/changes/<change>/` to prevent directory traversal. Add a `canonicalize` + `starts_with` check if not already present.
