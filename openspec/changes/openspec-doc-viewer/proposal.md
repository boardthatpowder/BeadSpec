## Why

OpenSpec artifact links in the changes browser and per-task panel currently shell out to the OS default editor (`openPath`), forcing a context switch to an external app. Opening artifacts as in-app tabs keeps the user in Beads and enables side-by-side viewing alongside task detail. Additionally, delta-spec files (`specs/<id>/spec.md`) are not surfaced in either surface at all — users have no way to navigate to them from the UI.

## What Changes

- Clicking any artifact link (proposal, design, tasks, delta-spec) opens a read-only markdown tab in the main workspace pane instead of calling `openPath`.
- The workspace tab model is extended to a discriminated union supporting non-task content; a new `OpenSpecDocPanel` renders markdown via tiptap (already installed).
- Delta-spec files are listed as chips on both `ChangeCard` (changes browser) and `OpenSpecPanel` (per-task), using a new `specs` field on `ChangeInfo` populated by the Rust backend.
- The "opens in system editor" language in `openspec-change-browser` and `openspec-panel` specs is replaced with "opens as a workspace tab."

## Capabilities

### New Capabilities
- `openspec-doc-viewer`: Workspace tab type that renders an OpenSpec artifact (any `.md` file under `openspec/changes/<name>/`) as read-only markdown; extends the tab model with a discriminated `Tab` union to support non-task content.

### Modified Capabilities
- `openspec-change-browser`: Artifact click opens a workspace tab (not the OS editor); delta-spec chips added to change cards.
- `openspec-panel`: Artifact click opens a workspace tab (not the OS editor); delta-spec chips added to the artifact list.

## Impact

- **Backend (`src-tauri/src/commands/openspec.rs`)**: `ChangeInfo` struct extended with `specs: Vec<String>` (spec ids); `change_info_for_dir` reads `specs/*/spec.md` to populate it; `read_change_artifact` verified to accept nested paths (e.g. `specs/foo/spec.md`).
- **Frontend — workspace model**: `src/stores/workspace.ts` and `src/utils/paneTree.ts` — `TabId` becomes a discriminated union `{ kind: 'task', taskId } | { kind: 'doc', change: string, artifact: string }`; store actions `openDocTab(change, artifact)` and `closeTab` handle the new kind.
- **Frontend — rendering**: `src/components/workspace/LeafPane.tsx` dispatches on tab kind; new `src/components/workspace/OpenSpecDocPanel.tsx` fetches content via `read_change_artifact` and renders via tiptap with `editable: false`.
- **Frontend — click handlers**: `src/components/changes-browser/ChangeCard.tsx` and `src/components/task-detail/OpenSpecPanel.tsx` — `openPath(...)` calls replaced with `openDocTab(change, artifact)`.
- **Frontend — spec chips**: both surfaces render spec-id chips from `ChangeInfo.specs`; chips call `openDocTab(change, 'specs/<id>/spec.md')`.
- **No new npm dependencies** — tiptap + tiptap-markdown already installed.
- **Tauri capability**: `read_change_artifact` IPC command must be permitted for the doc viewer.
