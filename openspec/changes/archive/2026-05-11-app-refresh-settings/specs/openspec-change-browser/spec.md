## MODIFIED Requirements

### Requirement: Change browser surface gated on OpenSpec feature flag
The OpenSpec change browser (Changes view, ChangesBrowser component, and OpenSpec doc panel in the tabbed workspace) SHALL only be mounted and accessible when the OpenSpec feature flag is enabled. When the flag is disabled, no OpenSpec-related components SHALL be rendered or initialized.

#### Scenario: ChangesBrowser not mounted when OpenSpec disabled
- **WHEN** OpenSpec is disabled in Settings
- **THEN** the ChangesBrowser component is not mounted in the layout and makes no Tauri IPC calls

#### Scenario: OpenSpec doc panel not openable when OpenSpec disabled
- **WHEN** OpenSpec is disabled in Settings
- **THEN** the LeafPane does not offer the "OpenSpec Doc" panel type and any existing workspace state referencing it is ignored

#### Scenario: ChangesBrowser mounts when OpenSpec enabled
- **WHEN** OpenSpec is enabled in Settings
- **THEN** the ChangesBrowser is mounted in the layout and accessible via the Changes view
