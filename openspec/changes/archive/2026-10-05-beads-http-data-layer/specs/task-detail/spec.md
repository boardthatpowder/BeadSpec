## ADDED Requirements

### Requirement: Native history transport
The system SHALL merge structured comments, native audit history and available commit snapshots into existing typed task history in timestamp order, using native diff for optional revisions where supported.

#### Scenario: Embedded task history
- **WHEN** task history is opened in an embedded workspace
- **THEN** native history and comments SHALL populate the timeline without SQL reads
