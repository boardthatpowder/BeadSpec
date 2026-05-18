## MODIFIED Requirements

### Requirement: KPI bar Paused chip integrates with the label-filter dimension
The `openspec:paused` label SHALL be treated as a recognised value within the `openspec` label-prefix dimension of the smart-views filter engine. Toggling the KPI bar Paused chip SHALL be equivalent to selecting `openspec:paused` through any other label-filter path (palette, URL hash). The label SHALL be parsed using the canonical "split on first colon only" rule: prefix `openspec`, value `paused`.

#### Scenario: KPI bar chip toggles the label filter
- **WHEN** the user clicks the `"⏸ N Paused"` chip on the KPI bar
- **THEN** `openspec:paused` is added to `state.filters.labels` if it was absent, or removed if it was present
- **AND** the task list re-renders using the updated filter state
- **AND** `applyFilters` evaluates the label predicate using AND-of-OR semantics consistent with all other label filters

#### Scenario: Filter set externally reflects on the KPI bar chip
- **WHEN** `state.filters.labels` includes `openspec:paused` (set via URL hash, palette, or any other mechanism)
- **THEN** the Paused chip on the KPI bar renders with the ring-active treatment
- **AND** the chip count reflects the number of tasks matching the label in the full (unfiltered) task set

#### Scenario: Label-parsing rule applied correctly
- **WHEN** the label string `openspec:paused` is parsed by the filter engine
- **THEN** the prefix is `openspec` and the value is `paused` (split on the first colon only)
- **AND** a hypothetical label `openspec:paused:extra` would parse to prefix `openspec`, value `paused:extra` — not misidentified as the Paused chip value

#### Scenario: Paused filter co-exists with other active filters
- **WHEN** `state.filters.labels` includes `openspec:paused` AND a status filter is also active (e.g. `status = ['open', 'in-progress']`)
- **THEN** the task list shows only tasks that satisfy BOTH the status filter AND the paused label predicate
- **AND** the AND-of-OR semantics in `applyFilters` ensure the two dimensions are independent — adding the paused filter does not clear the status filter

#### Scenario: Paused filter state survives a full task-cache refresh
- **WHEN** the real-time Tauri event fires and TanStack Query invalidates the task cache while the paused filter is active
- **THEN** the filter state in Zustand is preserved
- **AND** the refreshed task list re-applies the paused label predicate against the new cache
- **AND** the KPI chip count updates to reflect the refreshed task count
