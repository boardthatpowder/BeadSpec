# Quick Start

This guide gets you from zero to a running BeadSpec session in under five minutes.

## Prerequisites

- `bd` installed and on your `PATH` (see [Installation](/guide/installation))
- BeadSpec installed

## 1. Create or open a Beads project

If you don't have a Beads project yet, create one:

```bash
mkdir my-project && cd my-project
bd init
```

This creates a `.beads/` directory with a Dolt database inside.

If you have an existing project, just navigate to its directory.

## 2. Launch BeadSpec

Open BeadSpec from your Applications folder, Launchpad, or Start Menu. On first launch it will ask you to open a project folder — select the directory containing the `.beads/` folder.

## 3. Explore your issues

The **task list** shows all issues from your Beads project, grouped by status by default. Use the filter bar at the top to narrow down by assignee, label, priority, or any custom field.

## 4. Create your first issue

**From the task list**: click the **+** button in any group header, or press `N` (when no input is focused) to open a new issue dialog.

**Quick Capture** (fastest): use the global keyboard shortcut to open a floating capture window without switching apps:
- macOS: `⌘ Shift Space`
- Windows/Linux: `Ctrl Shift Space`

## 5. View the dependency graph

Click the **Graph** tab (or press `G`) to see all issues as an interactive graph. Drag nodes to rearrange, click an issue to open its detail panel.

## 6. Switch projects

Use **File → Open Project** (or the project switcher in the sidebar) to open another Beads project. Each project gets its own isolated database connection.

## What's next?

- [Keyboard shortcuts](/guide/keyboard-shortcuts) — learn the full shortcut list
- [Smart views](/guide/features/smart-views) — save your common filter queries
- [Relationship with bd](/guide/relationship-with-bd) — understand what BeadSpec does vs what `bd` does
