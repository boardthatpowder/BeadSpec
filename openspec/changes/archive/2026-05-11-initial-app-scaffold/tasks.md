## 1. Project Scaffold

- [x] 1.1 Initialize Tauri 2.0 project with Vite + React + TypeScript frontend (`bun create tauri-app`)
- [x] 1.2 Configure Rust workspace with `src-tauri/` Cargo.toml and add core dependencies: `sqlx`, `mysql_async`, `specta`, `tauri-specta`, `tokio`, `serde`
- [x] 1.3 Configure frontend dependencies: React 19, TanStack Query, Zustand, Tailwind CSS, react-hotkeys-hook, React Flow, TipTap
- [x] 1.4 Set up Tauri 2.0 capability/ACL configuration for `shell:execute` (bd CLI) and `notification` plugin
- [x] 1.5 Configure `tauri-specta` codegen to auto-generate TypeScript bindings from Rust commands on build
- [x] 1.6 Set up git with `.gitignore` covering `target/`, `node_modules/`, `.beads/*.db`

## 2. Data Layer — Dolt SQL Connection

- [x] 2.1 Implement `DoltPool` struct in Rust: per-project MySQL connection pool via `sqlx`, keyed by project path
- [x] 2.2 Implement `ProjectRegistry` that manages lifecycle of multiple `DoltPool` instances (open, idle, close on project switch)
- [x] 2.3 Write schema version check on pool creation: query a version marker and degrade gracefully if mismatched
- [x] 2.4 Implement Tauri command `connect_project(path: String) -> Result<ProjectMeta>` — discovers Dolt endpoint from `bd` config, opens pool, returns project metadata
- [x] 2.5 Implement Tauri command `list_projects() -> Result<Vec<ProjectMeta>>` — invokes `bd list` (or scans known paths) and returns discovered projects
- [x] 2.6 Implement core Tauri read commands: `list_tasks(project, filters) -> Result<Vec<Task>>`, `get_task(project, id) -> Result<TaskDetail>`, `get_task_history(project, id) -> Result<Vec<HistoryEntry>>`

## 3. Data Layer — bd CLI Write Wrapper

- [x] 3.1 Implement `BdRunner` in Rust: locates `bd` binary on PATH (error with message if missing), executes commands, captures stdout/stderr
- [x] 3.2 Implement Tauri write commands: `create_task`, `update_task_field`, `change_task_status`, `add_label`, `remove_label`, `add_comment`, `delete_task`, `link_dependency`, `unlink_dependency`
- [x] 3.3.*Add optimistic update protocol: each write command returns an `OptimisticId` that the frontend uses to roll back on failure
- [x] 3.4 Implement `bd` not-found detection: on startup, check PATH and emit a `bd_not_found` Tauri event if missing

## 4. Data Layer — Real-Time Sync

- [x] 4.1 Implement `DoltPoller` Rust struct: polls `SELECT DOLT_LOG()` commit hash every 2 seconds per active project
- [x] 4.2 On hash change, query `DOLT_DIFF()` to extract changed task IDs; emit Tauri event `tasks_changed { project, task_ids: Vec<String> }` to frontend
- [x] 4.3 On structural changes (task created or deleted), emit `task_list_changed { project }` event for full list invalidation
- [x] 4.4 Pause poller when app window is hidden/minimized; resume on focus (use Tauri window events)
- [x] 4.5 Wire Tauri events to TanStack Query: `tasks_changed` invalidates specific task queries; `task_list_changed` invalidates list queries

## 5. Layout Shell

- [x] 5.1 Implement root layout component with three regions: `TopBar`, `TaskListPanel` (left), `DetailPanel` (right), connected by a draggable `ResizableDivider`
- [x] 5.2 Persist pane sizes to Tauri store (app data); restore on launch; apply default (30%/70%) on first launch
- [x] 5.3.*Implement density toggle: `DensityContext` (Compact / Comfortable / Spacious) applied via CSS custom properties; persisted to Tauri store
- [x] 5.4.*Implement window-width responsive behavior: collapse left panel to icon rail at <800px
- [x] 5.5.*Implement skeleton loader components for task list rows and detail panel sections
- [x] 5.6.*Implement toast notification system with 5-second undo button for destructive operations

## 6. Multi-Project Switcher

- [x] 6.1 Implement `ProjectSwitcher` dropdown in `TopBar`: lists discovered projects, highlights active, allows adding by path
- [x] 6.2 On project switch, drain idle previous project pool (keep active), load new project pool, re-render list and detail
- [x] 6.3 Implement unsaved-edit guard: prompt "Save or discard?" if detail panel has pending edits on project switch
- [x] 6.4 Persist last active project to Tauri store; restore on launch

## 7. Keyboard Shortcuts & URL Hash State

- [x] 7.1 Implement `ShortcutProvider` wrapping the app: uses `react-hotkeys-hook` with platform detection (Cmd on macOS, Ctrl on Windows/Linux)
- [x] 7.2.*Implement keyboard shortcut reference modal (triggered by `?` key): lists all shortcuts with platform-correct modifier labels
- [x] 7.3.*Implement URL hash state encoding: active filters, selected task ID, and current view encoded/decoded via a `useHashState` hook
- [x] 7.4 Wire hash state to browser back/forward history within the Tauri WebView

## 8. Task List & Filters

- [x] 8.1 Implement `FilterParser`: scans all task labels in loaded project, splits on first colon, groups into `prefix → Set<value>` map; unstructured labels go into `tags` dimension
- [x] 8.2 Implement `FilterBar` component: renders one filter control per detected label prefix + fixed controls for Status and Priority
- [x] 8.3 Implement filter logic: AND across dimensions, OR within dimension; filter state stored in Zustand + URL hash
- [x] 8.4 Implement `KpiBar` component: counts by status and priority for the active filter set; each tile is clickable to toggle the corresponding filter
- [x] 8.5 Implement `TaskList` component: virtualized scrollable list (TanStack Virtual), sortable by column header, real-time in-place row update without re-sort or scroll-position loss
- [x] 8.6 Implement task row: shows ID, title, status badge, priority dot, label chips; highlights selected row
- [x] 8.7 Implement bulk selection: shift-click range select; `BulkActionToolbar` appears with status change, label add dropdowns; Escape clears selection
- [x] 8.8 Implement real-time filter dimension updates: new label prefixes detected via sync events add dimensions to `FilterBar` without restart

## 9. Task Detail — Fields & Inline Editing

- [x] 9.1 Implement `TaskDetailPanel` with tabs: Details, Dependencies, Activity
- [x] 9.2 Implement click-to-edit for title: inline `<input>` on click, Enter saves (bd), Escape discards
- [x] 9.3 Implement status dropdown: click badge → dropdown with valid transitions → optimistic update → bd write
- [x] 9.4 Implement priority selector: inline segmented control, optimistic update → bd write
- [x] 9.5 Implement assignee picker: fuzzy search over project members, optimistic update → bd write
- [x] 9.6 Implement label manager: autocomplete input for add, × chip for remove, both via bd write
- [x] 9.7 Implement "outside active filter" indicator: if edits cause task to not match current filter, show a badge "Outside current filter" without closing the panel

## 10. Task Detail — Rich Text Editor

- [x] 10.1 Integrate TipTap editor for task descriptions: click-to-edit, Enter/click-outside saves, Escape discards
- [x] 10.2 Implement unsaved-changes guard: prompt on navigation away if description has pending edits
- [x] 10.3 Implement slash command menu: `/` triggers command list with options `/task`, `/code`, `/checklist`, `/heading`, `/quote`
- [x] 10.4 Implement `/task` slash command: fuzzy task picker inserts `[BD-ID: Title]` clickable link; rendered mode resolves title at render time
- [x] 10.5 Implement `/code` slash command: inserts fenced code block with language selector
- [x] 10.6 Implement `/checklist` slash command: inserts TipTap task list (checkbox items)
- [x] 10.7 Implement `bd-` autocomplete: floating task picker appears anywhere `bd-` is typed in any text field; inserts task ID or formatted link

## 11. Task Detail — Comments & Activity

- [x] 11.1 Implement comments section below description: list of rendered markdown comments with author + timestamp
- [x] 11.2 Implement comment composer: TipTap editor, submit button, bd write on submit
- [x] 11.3 Implement `ActivityTimeline` component: chronological list of history entries (status change, label add/remove, comment, description edit)
- [x] 11.4 Implement diff view: select two history entries → field-level diff for structured fields, text diff for descriptions
- [x] 11.5 Wire activity timeline to real-time sync: new comments and field changes appear immediately

## 12. Task Detail — Breadcrumb Navigation

- [x] 12.1 Implement `NavigationHistory` Zustand store: tracks task navigation path when traversing via dependency graph
- [x] 12.2 Implement `BreadcrumbBar` component: renders `Task A → ... → Task C`; collapses middle entries at >5 deep; each crumb is clickable
- [x] 12.3 Clear navigation history when task is opened directly from the task list (not via dep graph)

## 13. Dependency Graph

- [x] 13.1 Implement `DependencyGraphTab` component: renders React Flow canvas with the selected task's dependency tree
- [x] 13.2 Implement node visual encoding: border color by status (grey/blue/amber/green), reduced opacity + checkmark for Closed, amber edge highlight for Blocked chain
- [x] 13.3 Implement node hover tooltip: full title, status, priority, assignee
- [x] 13.4 Implement click-to-navigate: clicking a node loads that task in the detail panel and updates the breadcrumb
- [x] 13.5 Implement pan/zoom controls: drag to pan, scroll/pinch to zoom, "Fit to screen" button
- [x] 13.6 Implement Cytoscape.js fallback: if node count exceeds 50, switch renderer with hierarchical auto-layout
- [x] 13.7 Implement real-time graph updates: node status changes animate in place; new dependency edges trigger re-layout with smooth animation

## 14. Smart Views — Command Palette

- [x] 14.1 Implement `CommandPalette` component: modal overlay, text input, results list grouped by Tasks / Actions / Views
- [x] 14.2 Wire to Cmd/Ctrl+K shortcut; dismiss on Escape or click-outside
- [x] 14.3 Implement fuzzy search over all task IDs and titles in the active project (search runs in Rust, result emitted via Tauri command)
- [x] 14.4 Implement action results: "Create new task", "Switch project", "Open Focus view", "Open Ready to Start view"
- [x] 14.5 On task result selection: close palette, scroll task list to task, load task in detail panel

## 15. Smart Views — Keyboard Navigation

- [x] 15.1 Implement `j`/`k` navigation in task list (when list has focus): moves selection up/down
- [x] 15.2 Implement `Enter` from task list: moves focus to detail panel, scrolls to top
- [x] 15.3 Implement `Space` for quick status change: inline status picker in list row, arrow keys + Enter to select, Escape to dismiss
- [x] 15.4 Implement `/` to focus filter input from anywhere in the task list
- [x] 15.5 Implement `Backspace` / `Alt+Left` for dependency graph back-navigation (breadcrumb step back)

## 16. Smart Views — Focus & Ready to Start

- [x] 16.1 Implement `FocusView`: filters to tasks assigned to current user with status In Progress or deadline within 48h; switches to single-column layout; shows encouraging empty state
- [x] 16.2 Implement `ReadyToStartView`: queries Rust backend for open tasks whose full dependency chain is Closed; sorts by priority desc
- [x] 16.3 Wire `ReadyToStartView` to real-time sync: when a task's last blocking dep closes, it animates into the view
- [x] 16.4 Implement view switcher in `TopBar`: All / Focus / Ready to Start; active view encoded in URL hash

## 17. Notifications

- [x] 17.1 Integrate Tauri `notification` plugin; implement `NotificationManager` in Rust
- [x] 17.2.*Implement assignment notification: on `tasks_changed` event, if assigned user changed to current user, fire native OS notification
- [x] 17.3.*Implement unblock notification: on `tasks_changed`, if a task blocking a current-user task changes to Closed, fire notification
- [x] 17.4.*Implement comment notification: on `tasks_changed`, if a comment was added to a task owned by current user, fire notification with preview
- [x] 17.5 Implement notification click handler: bring app to foreground and navigate to the relevant task
- [x] 17.6 Implement notification preferences UI: individual toggles for assignment / unblock / comment; global mute toggle

## 18. Tray / Menu Bar App

- [x] 18.1 Integrate Tauri `tray-icon` plugin; set up menu bar (macOS) and system tray (Windows/Linux) icon
- [x] 18.2 Implement live badge count: open + in-progress tasks assigned to current user; updates with real-time sync
- [x] 18.3 Implement tray popover: shows task count, quick-create form (title + priority), "Open BeadSpec" button
- [x] 18.4 Implement quick-create from tray: invokes `bd create`, shows task ID in success toast, triggers list refresh
- [x] 18.5 Implement start-at-login tray mode: app launches to tray only (no main window) when configured
