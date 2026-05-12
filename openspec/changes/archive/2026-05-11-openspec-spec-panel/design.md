## Architecture

### Tauri Command Module: `openspec.rs`

A new Rust module at `src-tauri/src/commands/openspec.rs` handles all filesystem and shell operations needed by the OpenSpec panel. It follows the same `State<ProjectRegistry>` injection pattern used in `read.rs` and `project.rs`.

**Project root resolution**

The commands do not accept a project path from the frontend. Instead they resolve the path from the first entry of the `ProjectRegistry` managed by `AppState`. This keeps the IPC surface minimal and prevents path-injection attacks. The helper `resolve_project_root(registry: &ProjectRegistry) -> Result<PathBuf, String>` is a private function used by all four commands.

```rust
fn resolve_project_root(registry: &ProjectRegistry) -> Result<PathBuf, String> {
    // ProjectRegistry holds a map from beads_dir string → pool.
    // The first key (alphabetically or insertion-ordered) is the current project.
    // (Refined once multi-project switching lands; acceptable for the single-project MVP.)
    registry
        .current_project_path()   // TBD method — or read from a dedicated CurrentProject state cell
        .ok_or_else(|| "No project open".to_string())
}
```

If `AppState` does not yet expose a `current_project_path()` method, the command falls back to reading the first key from the `ProjectRegistry` HashMap. This is acceptable because beads-ui currently supports one active project at a time.

**`list_changes` command**

Reads `<project_root>/openspec/changes/` and returns a `Vec<ChangeInfo>`. Skips the `archive/` subdirectory for the main list; sets `archived: true` for entries found under `archive/`. Files are not recursed — only immediate subdirectories of `changes/` and `changes/archive/` are listed.

```rust
pub struct ChangeInfo {
    pub name: String,
    pub archived: bool,
    pub path: String, // absolute path to the change directory
}
```

**`read_change_artifact` command**

Reads `<project_root>/openspec/changes/<change>/<artifact>` as a UTF-8 string. Artifact paths are validated against a whitelist: `proposal.md`, `design.md`, `tasks.md`, and `specs/**/*.md`. Paths containing `..` are rejected with an error. Returns the file content or an error string if absent.

**`get_change_progress` command**

Reads `tasks.md` for the named change and counts:
- Checked: lines matching the regex `^\s*- \[x\]` (case-insensitive on the `x`)
- Total: lines matching `^\s*- \[[ x]\]`

Returns `ChangeProgress { done: u32, total: u32 }`. If `tasks.md` is absent, returns `{ done: 0, total: 0 }` and the frontend hides the progress bar.

**`run_openspec_validate` command**

Shells out using `std::process::Command` to:

```bash
openspec validate --change <name> --json
```

The command is looked up via `which openspec` at call time (no PATH caching — the binary is expected on the PATH inherited by the Tauri process on macOS, which includes `/usr/local/bin` and Homebrew paths). Stdout is parsed as JSON `{ "valid": bool, "errors": [string] }`. If the binary is not found or the process fails to spawn, returns `ValidationResult { valid: false, errors: vec!["openspec not found on PATH".to_string()] }`.

Output format expected from `openspec validate --json`:

```json
{ "valid": true, "errors": [] }
{ "valid": false, "errors": ["tasks.md missing required section", "..."] }
```

If `openspec` does not support `--json` in the version present, the command falls back to parsing the exit code (0 = valid) and returning the raw stderr as a single error string.

### Progress Parsing

The regex approach is used rather than a full Markdown parser to avoid adding a Rust dependency. The pattern is:

```
^\s*-\s+\[([ xX])\]\s+
```

Matched against each line. Groups on the checkbox character: space = unchecked, `x`/`X` = checked. Lines that match neither (headings, blank lines, prose) are ignored.

### Drift Detection Algorithm

Drift is detected entirely in the frontend component after the artifact content and issue metadata are both available:

1. Extract the change name from the first `openspec:<name>` label on the current task.
2. Call `get_change_progress` (or reuse the already-fetched `tasks.md` content from `read_change_artifact`).
3. Scan the raw `tasks.md` content line by line for the checkbox entry whose text is a **case-insensitive substring** of the current task's title, or vice versa (either direction, trimmed).
4. Compare:
   - Task `status === 'closed'` AND matched checkbox is unchecked → drift type `CLOSED_BUT_UNCHECKED`
   - Task `status !== 'closed'` AND matched checkbox is checked → drift type `OPEN_BUT_CHECKED`
   - Matched status: no warning.
   - No match found: no warning (the task may not correspond to a checkbox entry).

The match is intentionally fuzzy (substring) because issue titles often contain prefixes like task numbers that are absent from the checkbox text.

### Validate Caching

The validate result is stored in React component state (`useState<ValidationResult | null>`). It persists for the lifetime of the component mount. When the user navigates away and back (the component unmounts and remounts), the cache is cleared and the panel shows "Not yet validated". This is acceptable for the MVP; a longer-lived cache (e.g. Zustand or TanStack Query with a long `staleTime`) is a follow-up improvement.

### `containerMode` Prop Contract

```tsx
type ContainerMode = 'section' | 'tab';

interface OpenSpecPanelProps {
  changeName: string;
  containerMode: ContainerMode;
  projectRoot: string; // passed from TaskDetailPanel; used for artifact path construction
}
```

In `'section'` mode the component renders as a `<details>` / `<summary>` collapsible block inside the details tab scroll area.

In `'tab'` mode (used by the future `multi-tab-task-detail-workspace` migration) the component renders as a full-height scrollable pane without the collapsible wrapper.

The `containerMode` prop is not stored in URL state — it is determined by the parent layout at render time.

### Artifact File Discovery

The `read_change_artifact` command handles file existence checks individually. The frontend always requests these four artifact names in order:

1. `proposal.md`
2. `design.md`
3. `tasks.md`
4. `specs/**/*.md` — discovered via `list_change_specs(change: String) -> Vec<String>` (a lightweight helper that globs `openspec/changes/<change>/specs/**/*.md` and returns relative paths)

A fifth Tauri command `list_change_specs` is added to support the glob. It returns an empty vec if the `specs/` directory is absent, removing the need for the frontend to speculatively request unknown paths.

### Archive Awareness

`list_changes` returns `archived: bool`. When `archived: true`, the frontend renders all artifact links with:
- 50% opacity
- An "archived" badge (grey pill) next to the change name header
- Links remain clickable (files still exist in the archive directory)
- The validate button is hidden (archived changes are frozen)

### Open Questions

1. **`current_project_path()` API**: `AppState` / `ProjectRegistry` may not yet expose a typed method for the project root path. The initial implementation will read the beads metadata directory from the first key in the registry HashMap. A follow-up issue should add a proper `current_project()` accessor.
2. **`openspec --json` flag availability**: the `openspec` CLI version in the dev environment should be confirmed to support `--json`. The fallback (exit code + stderr) is implemented unconditionally but the JSON path is preferred.
3. **Windows PATH**: Tauri on Windows does not inherit the user's shell PATH by default. This iteration targets macOS only; a follow-up issue will handle Windows PATH injection for `openspec` and other CLI tools.
