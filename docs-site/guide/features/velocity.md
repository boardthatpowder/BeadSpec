# Velocity & Burndown

The Velocity view shows charts of issue throughput over time, helping you understand pace and spot slowdowns before they become problems.

## Opening velocity

Click the **Velocity** tab in the main navigation.

## Charts

### Throughput (velocity)

A bar chart showing the number of issues closed per time period (day, week, or month — selectable). Use this to see whether your team's pace is accelerating, stable, or declining.

### Cumulative flow

A stacked area chart showing the count of issues in each status over time. A widening "in progress" band indicates a growing work-in-progress problem. A narrowing "open" band means you're making progress on the backlog.

### Burndown

A line chart showing remaining open issues over time vs. an ideal linear burndown. Useful during sprints when you have a fixed scope.

## Time range

Use the date range picker to zoom into a sprint window or zoom out to see quarters.

## Filtering

Apply the same filter syntax as the task list to scope charts to a label, assignee, or any other field. For example, `label:sprint-3` shows velocity only for sprint 3 issues.

## Data source

All charts are computed directly from the Dolt SQL database. BeadSpec queries `closed_at` timestamps and current status to build the chart data — no separate time-tracking setup is needed.
