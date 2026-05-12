## 1. Backend: extend ChangeInfo with specs field

- [x] 1.1 Add `specs: Vec<String>` field to the `ChangeInfo` struct in `src-tauri/src/commands/openspec.rs:11-19`
- [x] 1.2 Populate `specs` in `change_info_for_dir` (~line 48-86): glob `specs/*/spec.md` relative to the change dir, collect the directory name segment between `specs/` and `/spec.md` as each spec id
- [x] 1.3 Verify `read_change_artifact` (~line 163) handles artifact paths containing `/` (e.g. `specs/task-workspace/spec.md`) correctly on all platforms; add `canonicalize` + `starts_with(change_dir)` path-traversal guard if not already present
- [x] 1.4 Regenerate TypeScript bindings (`bun run tauri dev` or `cargo build`) and confirm `ChangeInfo` in `src/bindings.ts` includes the `specs` field

## 2. Frontend: workspace tab model — discriminated TabId

- [x] 2.1 Define `TabId = { kind: 'task'; id: string } | { kind: 'doc'; id: string; change: string; artifact: string }` in `src/utils/paneTree.ts`; helper `docTabId(change, artifact): string` returns `` `doc:${change}:${artifact}` ``
- [x] 2.2 Update `LeafPane` type in `paneTree.ts` so `tabs: TabId[]`, `activeTabId: string | null`, `pinned: Record<string, boolean>` — the `id` field on each `TabId` is used as the record key everywhere
- [x] 2.3 Add migration shim in `src/stores/workspacePersist.ts`: on rehydrate, if a tab entry is a plain string (existing persisted layout), coerce it to `{ kind: 'task', id: tab }`
- [x] 2.4 Update `src/stores/workspace.ts` actions that accept `taskId: string` to accept `TabId` or `id: string` as appropriate; add `openDocTab(change: string, artifact: string)` action — constructs DocTab, deduplicates across all leaves (brings to focus if already open), else opens in active pane as pinned
- [x] 2.5 Update `reorderTab`, `closeTab`, `moveTab`, `splitWithTab` (from cross-split-tab-drag change) to operate on `TabId` by `tab.id` string key

## 3. Frontend: LeafPane rendering dispatch

- [x] 3.1 Update `src/components/workspace/LeafPane.tsx` to read `activeTab: TabId` instead of `activeTabId: string`; dispatch on `activeTab.kind`: `'task'` → existing `<TaskDetailPanel>`, `'doc'` → new `<OpenSpecDocPanel>`

## 4. Frontend: OpenSpecDocPanel component

- [x] 4.1 Create `src/components/workspace/OpenSpecDocPanel.tsx`: accepts `{ change: string; artifact: string }`; invokes `read_change_artifact` on mount to fetch content
- [x] 4.2 Render content using `useEditor({ extensions: [StarterKit, Markdown], content, editable: false })` from `@tiptap/react` + `tiptap-markdown` (same imports as `DescriptionEditor.tsx`)
- [x] 4.3 Show a loading skeleton while content is fetching; show "Could not load this artifact" error state if the IPC call fails

## 5. Frontend: TabBar and Tab component updates

- [x] 5.1 Update `src/components/workspace/Tab.tsx` to accept `TabId`; render title as `<change>/<artifact-basename>` for doc tabs and a document icon distinct from the task icon
- [x] 5.2 Update `src/components/workspace/TabBar.tsx` to pass `TabId` objects to `Tab` and to dnd-kit sort items (use `tab.id` as the sort key)

## 6. Frontend: swap openPath calls

- [x] 6.1 In `src/components/changes-browser/ChangeCard.tsx`: replace all `openPath(filePath)` calls with `openDocTab(change, artifact)` from the workspace store; add spec-id chips using `changeInfo.specs` that also call `openDocTab(change, 'specs/<id>/spec.md')`
- [x] 6.2 In `src/components/task-detail/OpenSpecPanel.tsx`: replace `openPath(filePath)` calls with `openDocTab(change, artifact)`; render `changeInfo.specs` ids as clickable links under a "Specs" sub-heading

## 7. Verification

- [ ] 7.1 Click "proposal" chip on a change card — verify tab opens in workspace, renders markdown, title shows `<change>/proposal`, no OS editor launched
- [ ] 7.2 Click a delta-spec chip — verify `specs/<id>/spec.md` opens as workspace tab
- [ ] 7.3 Click same artifact link twice — verify only one tab, second click focuses the existing tab
- [ ] 7.4 Close the artifact tab — verify it is removed and workspace shows next tab or placeholder
- [ ] 7.5 Open an artifact tab, restart the app — verify tab is restored and content re-fetched
- [ ] 7.6 Open the per-task OpenSpec panel for a task linked to a change with delta specs — verify spec ids appear under "Specs" and clicking one opens as workspace tab
- [ ] 7.7 Confirm existing task tab behavior (preview/pinned, reorder, split) is unaffected
- [ ] 7.8 Check a change with no delta specs — verify no spec chips shown on card or panel
