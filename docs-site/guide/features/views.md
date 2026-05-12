# Views

BeadSpec has five built-in views, selectable from the navigation bar at the top of the window. Each view is a different lens on your project's issues.

## All

Shows every issue in the project. Use the filter bar to narrow down by status, assignee, priority, label, or free text. This is the default view when you open a project.

## Focus

Shows only issues assigned to you. Within Focus, issues are grouped by status so you can see at a glance what is open, in progress, or blocked. This view automatically uses your **Identity → Actor** setting to determine "you".

## Ready

Shows issues with no unresolved blockers — i.e. issues where every dependency is either closed or does not exist. The Ready view also shows dependency lineage hints, so you can see at a glance which chain of work an issue belongs to. Use this view during sprint planning to find what can actually be started now.

## Health

A tabbed panel with two sub-views:

**Checks** — runs `bd` diagnostic commands against the connected project and shows pass/fail results for each:
- **Preflight** — `bd preflight` (combined pre-PR gate)
- **Doctor** — `bd doctor` (project health)
- **Lint** — `bd lint` (issue quality)
- **Stale** — `bd stale` (inactive issues)
- **Orphans** — `bd orphans` (broken dependencies)

Checks run automatically when you open the Health view and can be re-run manually with the **Re-run** button.

**Formulas** — lists `bd` workflow formulas available for the connected project. Click **Pour** next to a formula to run it. A confirmation dialog appears before any formula is executed; output (stdout/stderr) is shown inline after the pour.

## OpenSpec (Changes)

> **Optional.** Requires the `openspec` CLI and **Settings → Features → OpenSpec integration** enabled. If OpenSpec is disabled or not installed, this view does not appear in the navigation.

Browse in-flight and archived change proposals from your project's `openspec/changes/` directory. Click a change to open its artifacts (proposal, spec, design, tasks) as read-only tabs in the workspace. Task completion status is pulled live from the Beads database.

See [Integrations → OpenSpec](/guide/integrations#openspec) for more detail.
