## Context

beads-ui renders its task list with `@tanstack/react-virtual` (already installed). All tasks are loaded via TanStack Query into a single `Task[]` array; grouping is a pure JS transform on that array applied before the virtual list sees it. The `HashStateContext` serializes view state (filters, selected task ID, view mode) to the URL hash. A Tauri store (`layout.json`) persists layout preferences across hard refreshes. This change extends both persistence mechanisms for the new `groupBy` field.

## Goals / Non-Goals

**Goals:**
- Define the `GroupConfig` type and its serialization format
- Specify the `groupTasks()` algorithm and its output shape
- Define the mixed-item virtual list architecture (`TaskRow | GroupHeader` discriminated union)
- Specify the FilterBar "Group by" dropdown UX and data source
- Define collapse state management and its interaction with bulk selection
- Specify the two persistence paths (URL hash + Tauri store)

**Non-Goals:**
- Multi-level grouping, drag-and-drop, server-side grouping (all v2+)
- Aggregate badges beyond count
- Persistence of collapse state

## Decisions

### D1: GroupConfig type

```ts
export type GroupConfig =
  | { type: 'field'; field: 'status' | 'priority' | 'assignee' | 'task_type' }
  | { type: 'label-prefix'; prefix: string }
  | null
```

`null` means flat list (the default). This union covers every grouping the FilterBar dropdown will offer in v1.

**Serialization** to/from string for URL hash and Tauri store:
- `null` → `null` (not written to hash when absent)
- `{ type: 'field', field: 'status' }` → `"field:status"`
- `{ type: 'label-prefix', prefix: 'openspec' }` → `"label:openspec"`

`deserializeGroupConfig(s: string | null | undefined): GroupConfig`:
- `null` / `undefined` / `""` → `null`
- `"field:status"` → `{ type: 'field', field: 'status' }`
- `"label:openspec"` → `{ type: 'label-prefix', prefix: 'openspec' }`
- Unrecognized string → `null` (graceful degradation)

### D2: `groupTasks()` algorithm

```ts
export interface GroupedSection {
  key: string    // unique stable key for React and collapse state
  label: string  // display name for section header
  tasks: Task[]
}

export function groupTasks(tasks: Task[], config: GroupConfig): GroupedSection[]
```

**When `config === null`**: return `[{ key: '__all__', label: '', tasks }]` — callers treat a single unlabeled section as flat mode.

**When `config.type === 'field'`**:
1. Determine the value for each task: `task[config.field]` (for `status`, `priority`) or `task.assignee` / `task.task_type` (if present on the type; fall back to `'(unassigned)'`/`'(no type)'` for null/undefined).
2. Collect all unique values. Sort: status uses canonical order `['open','in_progress','blocked','closed']`; priority sorts numerically ascending; others sort alphabetically.
3. Produce one `GroupedSection` per value, tasks filtered and pre-sorted by the section's natural order then by the current sort field within the section.
4. Empty sections are included so the user can see all states at a glance.

**When `config.type === 'label-prefix'`**:
1. For each task, collect the set of values after the first colon for labels that start with `config.prefix + ':'`. A task with no matching label falls into the `(none)` section.
2. A task that has **multiple** matching labels (e.g. `openspec:foo` and `openspec:bar`) appears in **both** sections — this is intentional for label-prefix grouping (one issue can belong to two epics).
3. Sort sections alphabetically by key, with `(none)` last.

**Alternative considered**: exclude tasks that have no matching label-prefix from all sections — rejected because it would silently hide tasks from the list, confusing users.

### D3: Mixed-item virtual list

The virtual list currently maps `sorted[index]` → `TaskRow`. With grouping it must map `virtualItems[index]` → `TaskRow | GroupHeader`.

**Item discriminated union:**

```ts
type VirtualItem =
  | { type: 'header'; sectionKey: string; label: string; count: number; collapsed: boolean }
  | { type: 'task';   task: Task; flatIndex: number }
```

`flatIndex` is the 0-based index of this task in the flattened visible-task array (headers excluded). This is the index used for shift-click range selection.

**Building the item list** (`buildVirtualItems(sections, collapsed)`):
```
items = []
flatIdx = 0
for section in sections:
  push { type: 'header', sectionKey: section.key, ... }
  if not collapsed.has(section.key):
    for task in section.tasks:
      push { type: 'task', task, flatIndex: flatIdx++ }
return items
```

**Height estimation:**
- `GroupHeader`: `36px` (shorter than task row, taller than a divider)
- `TaskRow`: `54px` (unchanged from current)

`useVirtualizer` receives `estimateSize(index) => items[index].type === 'header' ? 36 : 54`.

**Alternative considered**: separate virtual lists per section — rejected because it breaks keyboard navigation, inter-section shift-click, and scroll position continuity.

### D4: FilterBar "Group by" dropdown

The dropdown sits in the FilterBar row 1 alongside Search, Status, Priority, and Filters. It uses the same `FilterPill`-style button pattern (compact trigger with dropdown popover).

**Options structure:**
1. "None" (clears groupBy to null)
2. Divider: "By field"
3. Status
4. Priority
5. Assignee
6. Type
7. Divider: "By label prefix"
8. One entry per unique label prefix derived from `useAllLabels()`, sorted alphabetically, excluding structural prefixes `branch`, `repo`, `worktree`, `worker` (those are filter dimensions, not semantic grouping axes). An empty prefix list shows a disabled "no label prefixes found" item.

The label-prefix list is derived from `parseFilterDimensions(allLabels).dimensions` filtered to `isStructured === true` and excluding the structural prefixes listed above.

**Active state**: the dropdown trigger shows the current group-by label (e.g. "Status", "openspec") when active, "Group" when none.

### D5: Collapse state management

```ts
const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
```

Held in `TaskList` component local state. Not persisted to URL or store (ephemeral; collapses reset on navigation). When `sections` changes (e.g. filter applied), collapsed state is **not** reset — keys that no longer exist are simply ignored.

Toggle: `setCollapsed(prev => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next })`

### D6: `AppHashState` extension

```ts
export interface AppHashState {
  view?: 'all' | 'focus' | 'ready'
  taskId?: string
  filters?: Record<string, string[] | string>
  groupBy?: string | null   // NEW — serialized GroupConfig
}
```

Default (when absent from hash): `null` (flat list). Written by the Group-by dropdown; read by `TaskList` via `useAppState()`.

### D7: Tauri store persistence (`layout.json`)

The Tauri `@tauri-apps/plugin-store` plugin is (or will be) used to persist layout preferences. The key `groupBy` in `layout.json` holds the same serialized string as the URL hash field.

**On mount**: read `layout.json#groupBy`. If hash already has a `groupBy` value, hash wins (deep-link / bookmark takes precedence). If hash has no `groupBy`, apply the stored value.

**On change**: write to both hash and store atomically (hash write is already synchronous; store write is async fire-and-forget).

If `@tauri-apps/plugin-store` is not yet installed, add `bun add @tauri-apps/plugin-store` and register in `src-tauri/Cargo.toml` and `src-tauri/src/lib.rs`.

### D8: Bulk selection across groups

Bulk selection uses `flatIndex` (from `VirtualItem.type === 'task'` items only). Shift-click computes range `[min(anchor, target), max(anchor, target)]` on the flat index array. Tasks in collapsed sections have no `flatIndex` (they are not in the virtual item list at all); shift-click across a collapsed section naturally produces a contiguous range of visible tasks only. This is the correct behavior — you cannot select a task you cannot see.

When a section is expanded mid-selection (user expands after anchor click), the existing anchor index remains valid and the next shift-click will include the newly visible tasks within the range.

## Risks / Trade-offs

- **`label-prefix` multi-section task duplication** — a task in two sections means `selectedIds` could contain it from either selection. Bulk operations that act by ID are idempotent so this is safe, but the count badge on the bulk toolbar will reflect the unique ID count, not the visual row count. Acceptable for v1.
- **`@tauri-apps/plugin-store` not yet in `Cargo.toml`** — if absent, the store persistence subtask adds a Rust dependency that requires `cargo build`. The implementation subtask must check before assuming it's available.
- **Empty sections on field grouping** — showing empty `open` / `closed` sections when the filter hides them is intentional (gives a stable structure) but may be confusing. Mitigation: add a subtle "(empty)" label instead of hiding.
