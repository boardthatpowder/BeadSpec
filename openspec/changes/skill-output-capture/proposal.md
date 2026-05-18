## Why

Three review skills — `code-review:code-review`, `security-review`, and `gitnexus-pr-review` — produce rich markdown output that currently lives only in the Claude Code agent transcript. Once the session ends, that output is gone; there is no way to recall what a past review said, correlate it with an issue, or share it with a teammate looking at the same change. The workflow produces high-value signal; the UI surfaces none of it.

Capturing review output into Ruflo memory under a structured key and surfacing it in two existing panels closes the largest remaining gap between "what the workflow produces" and "what BeadSpec shows."

## What Changes

- A new CLI helper `scripts/bd-capture-review.sh` reads a review body from stdin and stores it in Ruflo memory under a structured key (`<ruflo_key_prefix>|review:<kind>|branch:<name>|[pr:<num>|]ts:<epoch>`). No Dolt schema changes are required.
- A new Tauri module `src-tauri/src/commands/reviews.rs` exposes two commands: `list_reviews` (scoped by branch / PR / all) and `get_review` (full body by key). Both shell out to `ruflo memory search --json`.
- `TaskDetailPanel`'s Activity tab gains a **Reviews section** that fetches reviews scoped to the issue's `branch:` label (and `pr:` label if present), rendered using the existing Tiptap markdown component.
- `BdHealthPanel` gains a **Reviews sub-tab** that lists all captured reviews grouped by branch, with kind-filter chips and a text search.

Non-goals (explicit):
- No write / edit / delete from the UI. Reviews are append-only via the CLI; removal is `ruflo memory forget` from the terminal.
- No automatic capture via transcript scraping or hooks. Capture is an explicit user / sub-agent action.
- No new Dolt tables or schema migrations in v1. Ruflo AgentDB is the store.
- No PR-number auto-resolution from `gh`; callers supply `--pr <num>` explicitly.

## Capabilities

### New Capabilities
- `skill-output-capture`: CLI capture helper, Tauri backend commands, and IPC wrappers for storing and retrieving review output.

### Modified Capabilities
- `task-detail`: adds a Reviews section to the Activity tab, gated on Ruflo being enabled.
- `bd-health-panel`: adds a Reviews sub-tab for browsing all captured reviews.

## Impact

- **New shell script**: `scripts/bd-capture-review.sh` — no frontend or Rust changes needed for the capture path.
- **New Rust module**: `src-tauri/src/commands/reviews.rs` with two Tauri commands registered in `src-tauri/src/lib.rs`.
- **Type bindings**: `ReviewKind`, `ReviewEntry`, `ReviewScope` auto-generated via `specta` into `src/bindings.ts`.
- **Frontend IPC**: `listReviews` / `getReview` wrappers added to `src/ipc.ts`.
- **React components**: `src/components/reviews/ReviewsSection.tsx`, `ReviewRow.tsx`, `ReviewMarkdownViewer.tsx`.
- **TaskDetailPanel**: mounts `ReviewsSection` in the Activity tab; no structural changes to other tabs.
- **BdHealthPanel**: adds a Reviews sub-tab alongside existing health sections; no changes to existing check logic.
- **No Dolt schema changes** — read/write path is Ruflo memory via `ruflo memory store` / `ruflo memory search --json`.
