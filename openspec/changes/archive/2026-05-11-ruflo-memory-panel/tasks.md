# Tasks: ruflo-memory-panel

## Task 1: `run_ruflo_command` + ruflo PATH resolution in `external.rs`

In `src-tauri/src/commands/external.rs`, add:

```rust
#[tauri::command]
pub async fn run_ruflo_command(
    args: Vec<String>,
    state: State<'_, AppState>,
) -> Result<CommandOutput, String> {
    let ruflo_path = state.ruflo_path.as_ref().ok_or_else(|| "ruflo not available".to_string())?;
    // shell out, capture stdout/stderr, return CommandOutput
}
```

Extend `AppState` with:
```rust
pub ruflo_path: Option<String>,
```

In `src-tauri/src/lib.rs` `setup()`, resolve ruflo PATH at startup:
```rust
let ruflo_path = std::process::Command::new("ruflo")
    .arg("--version").output().ok().map(|_| "ruflo".to_string());
// or use `which::which("ruflo")`
app_state.ruflo_path = ruflo_path;
```

Add a `is_ruflo_available() -> bool` command that returns `state.ruflo_path.is_some()`.

Register `run_ruflo_command` and `is_ruflo_available` in the `invoke_handler`.

- [x] Define `run_ruflo_command` in `external.rs` following `run_bd_command` pattern
- [x] Extend `AppState` with `ruflo_path: Option<String>`
- [x] Resolve ruflo PATH in `setup()` and store in AppState
- [x] Add `is_ruflo_available` command
- [x] Register both commands in invoke handler

## Task 2: Bindings codegen

Re-run tauri-specta codegen to export the two new commands (`run_ruflo_command`, `is_ruflo_available`) to TypeScript bindings.

- [x] Run specta codegen (follow the pattern used for prior commands)
- [x] Verify generated bindings include `runRufloCommand` and `isRufloAvailable`

## Task 3: `RufloMemoryPanel` component — lazy fetch, result list, expand-in-place

Create `src/components/RufloMemoryPanel.tsx`:

**Props:**
```ts
interface Props {
  taskId: string;
  title: string;
  labels: string[];
}
```

**State:**
```ts
type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; memories: Memory[] }
  | { status: 'error'; message: string };

interface Memory { title: string; body: string; created_at: string; }
```

**Behaviour:**
- Collapsible section header "Related memories" with chevron
- On first expand: set `loading`, call `runRufloCommand`, parse `stdout` as JSON, set `loaded` or `error`
- On `taskId` change: reset to `idle` via `useEffect([taskId])`
- Each result: title + 120-char excerpt; click toggles full body inline
- Empty state: "No related memories found"
- Error state: "Could not load memories"

- [x] Create `RufloMemoryPanel.tsx` with described props, state, and render logic
- [x] Implement 120-char excerpt truncation helper
- [x] Implement expand/collapse per-result (Set<number> or Record<number, boolean>)
- [x] Implement task-change reset via useEffect

## Task 4: Query construction — filter system label prefixes

In `RufloMemoryPanel`, implement query construction before calling the command:

```ts
const SYSTEM_PREFIXES = ['branch:', 'worktree:', 'repo:', 'openspec:'];
const userLabels = labels.filter(l => !SYSTEM_PREFIXES.some(p => l.startsWith(p)));
const query = [title, ...userLabels].filter(Boolean).join(' ');
```

If `query` is empty after construction: skip fetch and display empty state immediately.

- [x] Implement `buildSearchQuery(title, labels)` helper (can be a pure function in same file or utils)
- [x] Cover edge cases: blank title, all-system labels, empty labels array

## Task 5: Wire `RufloMemoryPanel` into `TaskDetailPanel`

In `src/components/TaskDetailPanel.tsx`:
- Call `isRufloAvailable()` once at app level (or via a React context/hook `useRufloAvailable`) and store result
- Conditionally render `<RufloMemoryPanel>` after `<OpenSpecPanel>`:

```tsx
{rufloAvailable && (
  <RufloMemoryPanel
    taskId={task.id}
    title={task.title}
    labels={task.labels ?? []}
  />
)}
```

Section ordering in the Details scroll area:
1. OpenSpec panel (existing)
2. Ruflo memory panel (this change)

- [x] Add `useRufloAvailable` hook (or inline call) to resolve availability once
- [x] Import and render `RufloMemoryPanel` in `TaskDetailPanel` after OpenSpec section
- [x] Confirm no extra DOM nodes or whitespace when ruflo unavailable

## Task 6: Manual test checklist

- [x] With ruflo on PATH: open any task — "Related memories" section visible and collapsed
- [x] Click to expand — loading indicator appears, then results (or empty state)
- [x] Collapse and re-expand — no new fetch, results shown immediately
- [x] Click a result — full body expands inline; click again — collapses
- [x] Task with only system labels — query uses title only, no system label leakage
- [x] With ruflo NOT on PATH (rename binary temporarily): section not rendered, no errors
- [x] Switch between tasks — section resets to collapsed idle state for new task

## Task 7: Validate & close

- [x] Run `openspec validate ruflo-memory-panel` and confirm all artifacts pass
- [x] Close this change (mark archived or complete per workflow)
