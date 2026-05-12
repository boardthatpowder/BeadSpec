# Smart Views

Smart Views are saved filter queries with live issue counts. They appear in the sidebar and let you jump to commonly-used views with a single click.

## Creating a smart view

1. Enter a filter in the task list filter bar (e.g. `status:open assignee:dean`)
2. Click **Save as view** (bookmark icon, or press `S` while the filter bar is focused)
3. Give the view a name
4. The view appears in the sidebar under **Smart Views**

## Built-in views

BeadSpec includes a few built-in views that can't be deleted:
- **All open** — `status:open`
- **My work** — `assignee:me status:in_progress`
- **Blocked** — `status:blocked`

## Reordering views

Drag and drop smart views in the sidebar to reorder them.

## Editing and deleting

Right-click (or long-press) a smart view in the sidebar to rename or delete it.

## Live counts

Each smart view shows a count badge that updates automatically as issues change. The count reflects the current number of issues matching the filter — not a snapshot.
