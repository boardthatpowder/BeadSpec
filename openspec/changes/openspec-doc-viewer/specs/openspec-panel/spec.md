## MODIFIED Requirements

### Requirement: Artifact links open in workspace tab

The OpenSpec panel SHALL list the artifact files that exist for the detected change (`proposal.md`, `design.md`, `tasks.md`, and any `specs/<id>/spec.md` delta files). Each listed file SHALL be a clickable link that opens the file as a read-only markdown tab in the active workspace pane. Files that do not yet exist for the change SHALL be listed in a muted/disabled style.

#### Scenario: All artifacts present — all links active
- **WHEN** the OpenSpec panel is rendered for a change that has all four artifact types
- **THEN** all artifact links are clickable and opening one opens it as a workspace tab
- **AND** no OS file manager or external editor is launched

#### Scenario: Partial artifacts — missing files shown as disabled
- **WHEN** the change has only `proposal.md` (design and specs not yet written)
- **THEN** proposal link is active; design and specs links are visible but muted and non-clickable

#### Scenario: Delta-spec files listed under Specs sub-heading
- **WHEN** the change has specs in `specs/list-grouping/spec.md` and `specs/workspace-context/spec.md`
- **THEN** each spec file is listed individually under a "Specs" sub-heading
- **AND** clicking a spec file link opens that delta-spec as a workspace tab

#### Scenario: Delta-spec chips reflect ChangeInfo.specs
- **WHEN** the backend returns `specs: ["list-grouping", "workspace-context"]` in `ChangeInfo`
- **THEN** both spec ids appear as clickable links in the Specs sub-heading
- **AND** a change with no delta specs shows no Specs sub-heading
