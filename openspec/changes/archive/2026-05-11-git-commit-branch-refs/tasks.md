## 1. Rust: get_git_refs_for_issue Command

- [x] 1.1 Create `src-tauri/src/commands/external.rs` (or add to it if it exists) with `CommitRef { hash, subject, date }` and `GitRefs { commits: Vec<CommitRef>, branches: Vec<String> }` structs, both deriving `serde::Serialize`, `serde::Deserialize`, and `specta::Type`
- [x] 1.2 Implement `get_git_refs_for_issue(project_path: String, issue_id: String, ...) -> Result<GitRefs, String>`: check for `.git` directory in `project_path`; if absent return `Ok(GitRefs { commits: vec![], branches: vec![] })` immediately
- [x] 1.3 Implement the commit fetch: run `git log --oneline --all -n 50 --grep=<issue_id> --format=%H|%s|%ci` with `std::process::Command` in `project_path`; parse each output line with `splitn(3, '|')` into `CommitRef`; skip malformed lines
- [x] 1.4 Implement the branch fetch: run `git branch --list "*<issue_id>*" --format=%(refname:short)` with `std::process::Command` in `project_path`; collect non-empty output lines as `Vec<String>`
- [x] 1.5 Wrap both subprocess calls with a `tokio::time::timeout` of 10 seconds; on timeout or OS error return `Ok(GitRefs { commits: vec![], branches: vec![] })`
- [x] 1.6 Expose `external` module in `src-tauri/src/commands/mod.rs`
- [x] 1.7 Register `get_git_refs_for_issue` in the Tauri invoke handler in `src-tauri/src/lib.rs`
- [x] 1.8 Run `cargo check` in `src-tauri/` and confirm no compile errors

## 2. Specta Codegen

- [x] 2.1 Run the specta codegen step (e.g., `cargo test export_bindings` or the project's established codegen command) to regenerate `src/bindings.ts` with the new `GitRefs`, `CommitRef`, and `get_git_refs_for_issue` binding
- [x] 2.2 Verify `src/bindings.ts` contains `GitRefs`, `CommitRef`, and `getGitRefsForIssue` (or equivalent camelCase name)
- [x] 2.3 Run `bun run typecheck` and confirm TypeScript sees the new types without errors

## 3. GitHistoryPanel Component

- [x] 3.1 Create `src/components/task-detail/GitHistoryPanel.tsx` accepting props: `gitRefs: GitRefs | undefined`, `isLoading: boolean`
- [x] 3.2 Render a collapsible section header "Git history" that toggles open/closed on click; include commit count in header when `gitRefs.commits.length > 0`
- [x] 3.3 When expanded and `isLoading` is true: show a subtle loading spinner or skeleton inside the section
- [x] 3.4 When expanded and `gitRefs.commits` is empty: show "No commits found" placeholder text
- [x] 3.5 When expanded and commits exist: render each `CommitRef` as a row with abbreviated hash in monospace, subject text, and date string
- [x] 3.6 When expanded and `gitRefs.branches` is non-empty: render branch name chips above the commit list (or in the section header as sub-label)

## 4. Lazy Fetch (Activity Tab Only)

- [x] 4.1 In `TaskDetailPanel.tsx`, add a TanStack Query for `get_git_refs_for_issue` with key `['gitRefs', project, taskId]`, `staleTime: 60_000`, and `enabled: !!project && !!taskId && activeTab === 'activity'`
- [x] 4.2 Verify the query is NOT invoked when the task detail panel opens on the "Details" tab

## 5. TaskDetailPanel: GitHistoryPanel Integration and Branch Badge

- [x] 5.1 In `TaskDetailPanel.tsx` activity tab render path: import and render `<GitHistoryPanel gitRefs={gitRefsData} isLoading={gitRefsLoading} />` after the existing `<ActivityTimeline>` or `<CommentsSection>`
- [x] 5.2 Add branch badge to the task detail header: if `gitRefsData?.branches.length > 0`, render a badge element showing `gitRefsData.branches[0]` with a git-branch icon prefix; if more than one branch, append `+N more` with a tooltip listing all branch names
- [x] 5.3 Hide branch badge and GitHistoryPanel entirely when `gitRefsData` is undefined and not loading (non-git project fallback: undefined = empty)
- [x] 5.4 Ensure branch badge fetch is also gated on `activeTab === 'activity'` OR pre-fetched with `enabled: !!project && !!taskId` so it can show in the header before the activity tab is opened (prefer pre-fetch for the badge; adjust query `enabled` accordingly)
- [x] 5.5 Run `bun run typecheck` to confirm no TypeScript errors

## 6. Manual Test

- [x] 6.1 Open a task whose ID appears in at least one local Git commit message: verify the "Git history" section appears in the activity tab with the correct commit hash, subject, and date
- [x] 6.2 Verify the branch badge appears in the header when a local branch name contains the task ID, and is absent when none do
- [x] 6.3 Open a task in a project root with no `.git` directory: verify no Git history section and no branch badge are shown
- [x] 6.4 Switch between tabs (Details → Activity → Details → Activity): verify the Git query is not re-fired within the 60s stale window

## 7. Validate and Close

- [x] 7.1 Run `openspec validate git-commit-branch-refs` and resolve any reported issues
- [x] 7.2 Run `cargo check` in `src-tauri/` to confirm no Rust build regressions
- [x] 7.3 Run `bun run typecheck` to confirm no TypeScript build regressions
- [x] 7.4 Close BUI-t63d with `bd close BUI-t63d`
