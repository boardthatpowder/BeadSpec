## Why

BeadSpec is blind to the 277 GitNexus execution flows indexed on this repo. Today, understanding "what calls this function?" or "trace the auth flow" requires either grepping the codebase or invoking `mcp__gitnexus__context` from a chat window — neither is persistent or navigable. A first-class Processes browser in BeadSpec turns execution-flow exploration into a top-level navigation surface, and tightens the loop between an OpenSpec change's symbol set and the Beads issues touching it.

## What Changes

- A new **Processes** entry is added to `ViewSwitcher` (positioned between `Health` and `OpenSpec`), visible whenever a project is connected.
- A new `ProcessBrowser` two-pane view renders the GitNexus execution-flow catalogue: left pane shows a searchable, cluster-filtered list; right pane shows a stepped execution-trace detail for the selected process.
- Each step row displays: symbol name, `file:line` (monospace), and a truncated docstring snippet (120 chars, falling back to the function signature line).
- **Find issues touching this process** — a popover showing up to 20 Beads issues whose branch diff (via `getGitRefsForIssue`) intersects the process's file set, sorted by overlap size desc; clicking a row navigates to the issue in `TaskDetailPanel`.
- **Open in editor** — clicking a focused step opens `file:line` in the user's preferred editor via the existing `openPath` Tauri shell helper.
- Cluster grouping is derived from `npx gitnexus clusters --json`; a frontend deterministic-hash assigns a colour to each cluster so unknown clusters still render distinctly.
- A stale-index banner appears when the GitNexus index age exceeds 4 hours, with a **Re-analyze** CTA that shells out to `npx gitnexus analyze` as a background task (progress via Tauri events).
- New Tauri commands: `list_gitnexus_processes`, `get_gitnexus_process`, `list_gitnexus_clusters`, `find_issues_touching_process`, `get_gitnexus_index_status`, `trigger_gitnexus_reanalyze`.

Non-goals (explicit):
- No write path to GitNexus — no editing flows or clusters.
- No graph visualisation (Cytoscape, mermaid, etc.); stepped list only.
- No real-time invalidation on code changes — re-fetch on demand or via Re-analyze.
- No symbol-level deep dive (that is item 1, `gitnexus-impact-panel`); the Processes view stays at flow granularity.
- No multi-repo support — single connected project only.

## Capabilities

### New Capabilities
- `process-flow-browser`: the full Processes view including backend commands, IPC layer, and React components.

### Modified Capabilities
- `layout-shell`: adds a "Processes" nav entry to the top navigation bar.

## Impact

- **Tauri commands** (new): `list_gitnexus_processes`, `get_gitnexus_process`, `list_gitnexus_clusters`, `find_issues_touching_process`, `get_gitnexus_index_status`, `trigger_gitnexus_reanalyze` in `src-tauri/src/commands/gitnexus_processes.rs`.
- **Type bindings**: new `ProcessSummary`, `ProcessDetail`, `ProcessStep`, `Cluster`, `IssueMatch`, `IndexStatus`, `ReanalyzeHandle` types auto-generated via `specta` into `src/bindings.ts`.
- **Frontend IPC**: new wrappers in `src/ipc.ts`.
- **React components**: new `src/components/process-browser/` directory with `ProcessBrowser.tsx`, `ProcessList.tsx`, `ProcessDetail.tsx`, `StaleIndexBanner.tsx`, `IssueMatchesPopover.tsx`.
- **ViewSwitcher**: `src/components/layout/ViewSwitcher.tsx` gains a `'processes'` entry.
- **Layout router**: `src/components/layout/index.tsx` gains a `view === 'processes'` branch.
- **Hash state**: `View` union in `HashStateContext` gains `'processes'`; `processId` is encoded in the hash for deep-linking.
- **No schema changes** to Dolt — purely a read-side feature; GitNexus data comes from CLI shellout.
- **No new permission scopes** — `openPath` shell scope already covers the required access from the git-history-panel.
