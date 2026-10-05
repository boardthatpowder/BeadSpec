# workflow-activity-feed Specification

## Purpose
TBD - created by archiving change beads-http-data-layer. Update Purpose after archive.
## Requirements
### Requirement: Project-scoped bounded Beads activity
The system SHALL merge retained journal and available native history with stable identifiers in independent seven-day/5000-record project buffers. It SHALL display that activity may exclude pre-enable or pruned history and SHALL NOT imply complete historical backfill.

#### Scenario: Journal enabled on an existing workspace
- **WHEN** the activity feed opens after journal enablement
- **THEN** available history SHALL be shown with the historical coverage limit visible

#### Scenario: Another project's event
- **WHEN** another project's activity event is delivered
- **THEN** it SHALL NOT be inserted in the active project's feed

