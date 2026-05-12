# Proposal: Ruflo Memory Panel

## Why

Ruflo stores rich workflow context (decisions, rationale, notes) as named memories, but those memories are only accessible from the CLI. When a developer opens a task in BeadSpec the relevant memories — why the approach was chosen, what was tried, what was decided — are invisible. The developer either has to remember to run `ruflo memory search` manually, or that context is simply lost. A collapsible "Related memories" section in the task detail pane surfaces the right context at the right time, without making ruflo a hard dependency.

## What

The task detail panel gains a collapsible "Related memories" section. The section is hidden entirely when `ruflo` is not on `PATH`. When visible, it is lazy-loaded on first expand (not on task open, to avoid slowing the panel). On expand it runs `ruflo memory search "<title + non-system labels>" --json` via a new `run_ruflo_command` Tauri command. Each result is shown as a title + 120-character excerpt; clicking a result expands the full body inline.

System labels (`branch:*`, `worktree:*`, `repo:*`, `openspec:*`) are excluded from the search query so they do not pollute the semantic signal.

## Capabilities

### New
- **ruflo-memory-panel**: Collapsible "Related memories" section in task detail; lazy load, ruflo PATH gating, inline expand.

### Modified
- **task-detail**: Task detail panel gains a "Related memories" section below the OpenSpec section. Section hidden when ruflo unavailable.

## Impact

| Area | Change |
|------|--------|
| `src-tauri/src/commands/external.rs` | Add `run_ruflo_command(args)` + ruflo PATH resolution + `AppState` caching |
| `src-tauri/src/lib.rs` | Resolve and cache ruflo PATH in `AppState` at startup |
| `src/components/RufloMemoryPanel.tsx` | New component: lazy fetch, result list, expand-in-place |
| `src/components/TaskDetailPanel.tsx` | Wire `RufloMemoryPanel` in, gated on ruflo availability |
| tauri-specta bindings | Regenerate after adding `run_ruflo_command` |
