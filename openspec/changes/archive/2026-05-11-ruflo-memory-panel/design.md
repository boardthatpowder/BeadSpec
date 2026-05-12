## Context

Beads-UI is a Tauri 2 + React 19 + TypeScript + Tailwind v4 desktop app. `run_bd_command` in `external.rs` is the established pattern for shelling out to CLI tools and returning structured output. Ruflo stores workflow context as named memories accessible via `ruflo memory search "<query>" --json`. This change wires that CLI into the task detail panel without making ruflo a hard dependency.

## Goals / Non-Goals

**Goals:**
- Surface ruflo memories relevant to the current task in the detail panel
- Lazy load: no fetch until user explicitly expands the section
- Hard-gate on ruflo PATH availability — zero UI surface when ruflo absent
- Filter system label prefixes from query to preserve semantic signal
- Inline expand of full memory body on click

**Non-Goals:**
- Writing new memories from the UI
- Editing or deleting memories from the UI
- Real-time refresh of memories while the panel is open
- Displaying memories in the task list (only in detail panel)

---

## Decisions

### Decision: `run_ruflo_command` in `external.rs` — same pattern as `run_bd_command`

`run_bd_command` in `external.rs` already shells out to a CLI tool, captures stdout/stderr, and returns a `CommandOutput`. `run_ruflo_command` uses the same pattern:

```rust
#[derive(Serialize, Deserialize, Clone)]
pub struct CommandOutput {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

#[tauri::command]
pub async fn run_ruflo_command(
    args: Vec<String>,
    state: State<'_, AppState>,
) -> Result<CommandOutput, String> {
    let ruflo_path = state.ruflo_path.as_ref().ok_or("ruflo not available")?;
    let output = Command::new(ruflo_path).args(&args).output()...;
    Ok(CommandOutput { ... })
}
```

**Ruflo PATH resolution** happens once at startup in `setup()`:
```rust
AppState.ruflo_path = which::which("ruflo").ok().map(|p| p.to_string_lossy().to_string());
```

The `which` crate is already available (used for `bd`); if not, fall back to `std::process::Command::new("ruflo").arg("--version").status().is_ok()` to confirm availability and store `"ruflo"` as the path.

**Why cache in AppState:** avoids repeated PATH lookups per search; correct for the application lifetime (PATH does not change while the app is running).

---

### Decision: Result JSON schema from `ruflo memory search --json`

Assumed shape (align with actual ruflo output when implementing):
```json
{
  "memories": [
    {
      "title": "Why we chose Dolt for storage",
      "body": "Full text of the memory...",
      "created_at": "2026-05-01T10:00:00Z"
    }
  ]
}
```

The frontend parses `stdout` as JSON and reads `result.memories`. If parsing fails or `memories` is missing, treat as an error.

---

### Decision: Lazy load with per-task cache in component state

`RufloMemoryPanel` holds:
```ts
type LoadState = { status: 'idle' } | { status: 'loading' } | { status: 'loaded'; memories: Memory[] } | { status: 'error'; message: string };
```

On first expand (`status === 'idle'`), set `status = 'loading'`, call `run_ruflo_command(['memory', 'search', query, '--json'])`, then transition to `loaded` or `error`. On subsequent expands the status is already `loaded` — no re-fetch.

**Why not reset on task change:** `RufloMemoryPanel` receives `taskId` as a prop. When `taskId` changes, a `useEffect([taskId])` resets state to `{ status: 'idle' }` so the next expand fetches fresh results for the new task.

---

### Decision: Query construction — filter system prefixes

System label prefixes to exclude: `branch:`, `worktree:`, `repo:`, `openspec:`.

```ts
const SYSTEM_PREFIXES = ['branch:', 'worktree:', 'repo:', 'openspec:'];
const userLabels = labels.filter(l => !SYSTEM_PREFIXES.some(p => l.startsWith(p)));
const query = [title, ...userLabels].join(' ');
```

If `query` is empty after filtering (title is blank and all labels are system labels), skip the fetch and show "No related memories found" immediately.

---

### Decision: Expand state stored in component — `Map<number, boolean>`

Each result has an array index. Expanded state is a `Set<number>` (or `Record<number, boolean>`) in component state. Clicking toggles the index. This is local UI state — no need to persist across sessions.

---

### Decision: 120-character excerpt truncation

```ts
const excerpt = (body: string) =>
  body.length > 120 ? body.slice(0, 120).trimEnd() + '…' : body;
```

Applied at render time, not stored. Full body is always available in the memory object.

---

### Decision: Section hidden via conditional render, not CSS display

```tsx
{rufloAvailable && <RufloMemoryPanel task={task} />}
```

`rufloAvailable` is derived from a Tauri command `get_app_state()` (or a dedicated `is_ruflo_available()` command) called once at app startup and stored in React context. Using conditional render (not `display: none`) ensures no DOM nodes or event listeners exist when ruflo is absent.

**Why at startup:** avoiding the command per-task-open; PATH availability is stable for the app's lifetime.

---

## Data Flow

```
App startup
  └─ resolve ruflo PATH → AppState.ruflo_path
  └─ frontend calls is_ruflo_available() → stores in RufloContext

User opens task
  └─ TaskDetailPanel renders
  └─ if rufloAvailable: render <RufloMemoryPanel taskId={id} title={title} labels={labels} />
  └─ section renders collapsed, status = 'idle'

User clicks "Related memories" to expand (first time)
  └─ status → 'loading'
  └─ construct query: filter system labels, join title + userLabels
  └─ run_ruflo_command(['memory', 'search', query, '--json'])
  └─ parse stdout → memories[]
  └─ status → 'loaded' | 'error'

User clicks a memory result
  └─ toggle expandedSet.has(index) → show/hide full body inline
```
