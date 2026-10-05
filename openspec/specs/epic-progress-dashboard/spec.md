# epic-progress-dashboard Specification

## Purpose
TBD - created by archiving change beads-http-data-layer. Update Purpose after archive.
## Requirements
### Requirement: API-backed epic readiness
The system SHALL derive existing label-based epic progress and readiness through API/native CLI issues and dependency reads, preserve claim/reread behavior and identify HTTP snapshots with an Http source value.

#### Scenario: HTTP snapshot
- **WHEN** an epic snapshot is loaded through HTTP
- **THEN** existing progress/readiness SHALL remain available and its displayed source SHALL identify HTTP

