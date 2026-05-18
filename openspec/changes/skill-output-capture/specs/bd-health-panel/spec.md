## ADDED Requirements

### Requirement: Reviews sub-tab on the Health view

`BdHealthPanel` SHALL expose a **Reviews** sub-tab alongside the existing health check sections. The sub-tab SHALL display all captured reviews retrieved via `list_reviews(scope: All)`, grouped by branch (collapsible), with kind-filter chips (PR / Code / Security) and a text search over titles. An empty state SHALL be shown when no reviews exist.

#### Scenario: User opens the Reviews sub-tab
- **WHEN** the user clicks the "Reviews" sub-tab in the Health view
- **THEN** the panel calls `list_reviews` with scope `All`
- **AND** results are rendered grouped by branch in collapsible rows
- **AND** each group header shows the branch name and a count of reviews

#### Scenario: User filters by kind chip
- **WHEN** the user deselects the "Security" filter chip
- **THEN** only PR-review and code-review entries remain visible
- **AND** the branch group counts update to reflect the active filter

#### Scenario: User searches by title text
- **WHEN** the user types "auth" in the search input
- **THEN** only review rows whose title contains "auth" (case-insensitive) are shown
- **AND** branch groups with no matching rows are hidden

#### Scenario: Empty state
- **WHEN** `list_reviews` returns an empty array
- **THEN** the sub-tab displays the message "No reviews captured yet. Run a review skill and pipe through `scripts/bd-capture-review.sh`."
- **AND** no branch groups or filter chips are rendered

#### Scenario: User clicks a review row to view full markdown
- **WHEN** the user clicks a review row in the Reviews sub-tab
- **THEN** the full review markdown body is shown inline below the row using the Tiptap markdown renderer
- **AND** clicking the row again collapses the body
