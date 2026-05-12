# Task List

The task list is BeadSpec's primary view — a virtualized, filterable list of all issues in your Beads project.

## Layout

The task list shows issues grouped by a configurable field (status, assignee, priority, or label). Each group shows a count and can be collapsed. Scroll performance is maintained via virtualization even with thousands of issues.

## Grouping

Use the **Group by** selector in the toolbar to change grouping. Common groupings:
- **Status** (default) — open, in progress, blocked, closed
- **Assignee** — see each person's workload
- **Priority** — P0 through P4
- **Label** — any label prefix (e.g. `type:*`, `scope:*`)

## Filtering

The filter bar accepts:
- Free text (searches title and description)
- `status:open`, `status:in_progress`, `status:blocked`, `status:closed`
- `assignee:username`
- `priority:0` through `priority:4`
- `label:bug`, `label:enhancement`, or any label value
- Combinations: `status:open priority:0`

Save a filter as a [Smart View](/guide/features/smart-views) to jump to it instantly.

## Issue detail

Click any issue to open its detail panel on the right. From the detail panel you can:
- Edit the title, description, status, assignee, and priority inline
- View and manage labels
- See the issue's dependencies (and open the [dependency graph](/guide/features/dependency-graph))
- Read the full Markdown description with the rich editor

## Keyboard navigation

| Shortcut | Action |
|---|---|
| `↑` / `↓` | Move between issues |
| `Enter` | Open selected issue detail |
| `N` | New issue (when no input is focused) |
| `Escape` | Close detail panel |
| `/` | Focus filter input |

See [Keyboard Shortcuts](/guide/keyboard-shortcuts) for the full list.
