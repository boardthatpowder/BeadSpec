# Velocity Burndown Specification

### Requirement: KPI bar mode switcher
The KPI bar SHALL expose a mode control allowing the user to switch between `counts` (current default — open/blocked/closed counts), `burndown` (per-change burndown chart), and `velocity` (project-wide throughput). The selected mode SHALL persist via Tauri store (`layout.json`).

#### Scenario: User switches to burndown mode
- **WHEN** the user selects "Burndown" from the KPI bar mode control
- **THEN** the KPI bar replaces its count tiles with a burndown chart for the active OpenSpec change (or a change-selector if multiple are active)

#### Scenario: Default mode on first launch
- **WHEN** the app is opened for the first time with no stored mode preference
- **THEN** the KPI bar shows `counts` mode (preserving current behavior)

### Requirement: Per-change burndown chart
In `burndown` mode, the KPI bar SHALL render a line chart showing open vs. closed tasks over time for the selected OpenSpec change. The data is derived from `task_history` rows filtered to issues carrying the `openspec:<change-name>` label, aggregated by day. The chart uses `recharts`.

#### Scenario: Burndown chart for active change
- **WHEN** burndown mode is active and one OpenSpec change is selected
- **THEN** a line chart appears with date on the x-axis and open/closed task counts on y-axis, covering the span from the oldest task creation date to today

#### Scenario: No tasks yet for the change
- **WHEN** the selected change has no associated beads issues
- **THEN** the chart area shows "No task history yet for this change"

#### Scenario: Multiple active changes — change selector shown
- **WHEN** the project has issues for more than one active OpenSpec change
- **THEN** a compact dropdown appears in the KPI bar to select which change's burndown to display

### Requirement: Project velocity view
In `velocity` mode, the KPI bar SHALL show a bar chart of tasks closed per week over the past 8 weeks across the entire project. Data is derived from `task_history` status-change events (status changed to `closed`).

#### Scenario: Velocity chart rendered
- **WHEN** the user switches to velocity mode
- **THEN** a bar chart shows the count of tasks closed each week for the past 8 weeks

#### Scenario: Insufficient history
- **WHEN** the project has fewer than 2 weeks of closed-task history
- **THEN** the chart renders with the available data and no error; missing weeks show as zero-height bars
