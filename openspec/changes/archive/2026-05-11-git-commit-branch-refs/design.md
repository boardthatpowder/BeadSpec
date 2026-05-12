## Context

The BeadSpec already resolves a project root path from `AppState` for Dolt server management. That same path is used as the working directory for Git subprocess calls. Git is invoked via `std::process::Command` (not via a Git library), keeping the Rust dependency surface minimal. The feature is additive: no existing commands or schemas are modified.

## Goals / Non-Goals

**Goals:**
- Expose commit refs (hash, subject, date) and branch names that contain the issue ID.
- Show a branch badge in the task detail header if a match exists.
- Collapsible "Git history" section in the activity tab.
- Lazy load: only fetch when the activity tab is opened.
- Graceful fallback: return empty results for non-git project roots without surfacing an error.
- 10-second subprocess timeout.

**Non-Goals:**
- Git diff or blame views.
- Pushing, committing, or any write operation via Git.
- Linking Git commits to Dolt commits.
- Parsing Git history for projects with non-standard log formats.
- SSH/HTTPS Git authentication (local repos only).

## Decisions

### get_git_refs_for_issue Command

**Decision**: Add `get_git_refs_for_issue(issue_id: String) -> Result<GitRefs, String>` to `src-tauri/src/commands/external.rs`.

**Rationale**: Follows the same pattern as other external commands (`run_bd_command`). Keeps Rust side thin by delegating to Git subprocess. `external.rs` is the correct home for OS-level subprocess commands that are not Dolt SQL queries.

```rust
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct CommitRef {
    pub hash: String,
    pub subject: String,
    pub date: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct GitRefs {
    pub commits: Vec<CommitRef>,
    pub branches: Vec<String>,
}
```

### Non-Git Graceful Fallback

**Decision**: Check for the presence of a `.git` directory in the project root before invoking any Git subprocess. If absent, return `Ok(GitRefs { commits: vec![], branches: vec![] })` immediately.

**Rationale**: Some Beads projects may not live in a Git repository. Silently returning empty data is preferable to showing an error for a legitimately non-git project. The UI hides the section entirely when both vecs are empty.

### Git Subprocess Execution

**Decision**: Use `std::process::Command` with a 10-second timeout (via `tokio::time::timeout` wrapping `tokio::task::spawn_blocking`).

**Commit fetch**:
```
git log --oneline --all --grep=<issue_id> --format="%H|%s|%ci"
```
Each output line is split on `|` (first two splits only) to extract hash, subject, and date.

**Branch fetch**:
```
git branch --list "*<issue_id>*" --format="%(refname:short)"
```
Output lines are collected as-is.

**Rationale**: `--format` with a delimiter avoids ambiguity in subject parsing. `--all` includes remote-tracking branches in commit search. Branch listing uses glob matching against local branches.

### Project Root from AppState

**Decision**: Resolve project root from the `project_path` argument (same as other commands). The `.git` check and subprocess working directory both use this path.

**Rationale**: Consistent with existing command patterns. No new state needed.

### CommitRef Parsing

**Decision**: Split `git log` output lines on `|` with a limit of 3 parts: `[hash, subject, date]`. Lines that don't split into exactly 3 parts are skipped silently.

**Rationale**: Defensive parsing avoids panics on malformed output. The `|` delimiter is unlikely to appear in commit hashes or ISO 8601 dates; subjects containing `|` will be truncated at the first `|` but this is an acceptable trade-off for simple implementation.

### Branch Badge Placement

**Decision**: A small badge is rendered in the task detail header immediately after the task ID span, visible when `GitRefs.branches` is non-empty. Shows the first matching branch name. If more than one branch matches, shows the first followed by `+N more` tooltip.

**Rationale**: Header placement provides at-a-glance visibility without requiring the user to open the activity tab. One badge keeps the header compact.

### Lazy Fetch on Activity Tab Open

**Decision**: The `get_git_refs_for_issue` TanStack Query is enabled only when `activeTab === 'activity'`. Cache key: `['gitRefs', project, taskId]` with `staleTime: 60_000`.

**Rationale**: Avoids unnecessary subprocess spawning for tasks where the user never opens the activity tab. 60s stale time is sufficient for a read-only Git history that changes infrequently.

### Section Ordering

**Decision**: In the activity tab, section order is: beads history entries first, then Git history collapsible section last.

**Rationale**: Beads history is the primary activity feed; Git history is supplementary. Collapsible keeps it unobtrusive when not needed.

## Risks / Trade-offs

- **[Risk] Git not installed** → Mitigation: `std::process::Command` returns an OS error; catch it and return empty `GitRefs`.
- **[Risk] Large repo with many commits matching the issue ID** → Mitigation: Limit `git log` output to 50 entries (`-n 50`).
- **[Risk] Slow git log on very large repos** → Mitigation: 10-second timeout; on timeout return empty `GitRefs` with no error shown.
- **[Risk] `|` in commit subject breaks parsing** → Mitigation: Split with `splitn(3, '|')` so only the first two `|` delimiters are used; subject may be slightly truncated but hash and date are always correct.

## Migration Plan

1. Add `external.rs` with `get_git_refs_for_issue`, `GitRefs`, `CommitRef`.
2. Register command in `lib.rs` invoke handler.
3. Run specta codegen to regenerate TypeScript bindings.
4. Implement `GitHistoryPanel.tsx` and wire into `TaskDetailPanel.tsx`.
5. Manual smoke test: open a task whose ID appears in local git log.
6. No database migrations; rollback is a revert of `external.rs` additions and component files.
