## ADDED Requirements

Defines the interactive dependency graph canvas that visualizes task relationships for the selected task. Built with React Flow (default) or Cytoscape.js (for large graphs), it allows pan/zoom navigation, click-to-open task details, and visual status encoding.

### Requirement: Interactive Dependency Graph Canvas

The system SHALL render an interactive node-graph visualization of the selected task's dependency tree as a tab within the detail panel.

#### Scenario: User opens the Dependency Graph tab
- **WHEN** the user clicks the "Dependencies" tab in the detail panel
- **THEN** a canvas SHALL render showing the selected task and all tasks it depends on (direct and transitive)
- **AND** tasks that depend ON the selected task (dependents) SHALL also be shown in a visually distinct style
- **AND** the selected task node SHALL be visually centered and highlighted

#### Scenario: Graph with no dependencies
- **WHEN** the selected task has no dependencies and no dependents
- **THEN** the canvas SHALL show a single node (the current task) with a message: "No dependencies"

#### Scenario: Large dependency graph (50+ nodes)
- **WHEN** the dependency graph contains more than 50 nodes
- **THEN** the app SHALL use a hierarchical auto-layout algorithm
- **AND** Cytoscape.js SHALL be used instead of React Flow for performance
- **AND** nodes SHALL be clustered by status to reduce visual clutter

### Requirement: Node Visual Encoding

Each node in the dependency graph SHALL visually encode the task's status and priority so the user can assess dependency health at a glance.

#### Scenario: Node color encodes status
- **WHEN** the graph renders a task node
- **THEN** the node border color SHALL reflect status: Open (grey), In Progress (blue), Blocked (orange/amber), Closed (green)
- **AND** the node SHALL display the task ID and a truncated title

#### Scenario: Blocked task in graph
- **WHEN** a task with status Blocked appears in the graph
- **THEN** its node SHALL have a distinct warning visual (amber border + icon)
- **AND** an edge connecting it to the blocking task SHALL be highlighted in amber

#### Scenario: Closed task in graph
- **WHEN** a dependency task is Closed
- **THEN** its node SHALL appear with reduced opacity and a checkmark indicator
- **AND** it SHALL be visually de-emphasized relative to open/in-progress nodes

### Requirement: Graph Navigation and Interaction

The system SHALL allow the user to navigate the graph and open task details directly from graph nodes.

#### Scenario: User clicks a node in the graph
- **WHEN** the user clicks on a task node in the graph
- **THEN** the detail panel SHALL load that task's details
- **AND** the breadcrumb SHALL update to reflect the navigation path
- **AND** the graph SHALL re-center on the newly selected node and redraw its dependency context

#### Scenario: User pans the graph
- **WHEN** the user clicks and drags on the graph canvas
- **THEN** the graph SHALL pan smoothly

#### Scenario: User zooms the graph
- **WHEN** the user scrolls/pinches on the graph canvas
- **THEN** the graph SHALL zoom in or out
- **AND** there SHALL be a "Fit to screen" button that resets the view to show all nodes

#### Scenario: User hovers over a node
- **WHEN** the user hovers over a node
- **THEN** a tooltip SHALL appear with: full task title, status, priority, and assignee
- **AND** the edges connecting to that node SHALL be highlighted

### Requirement: Real-Time Graph Updates

The system SHALL update the dependency graph in real time when task statuses or dependencies change.

#### Scenario: A dependency's status changes while the graph is open
- **WHEN** a real-time sync event updates a task visible in the current graph
- **THEN** that node's visual encoding SHALL update immediately (color, icon)
- **AND** the update SHALL be animated (brief flash or smooth transition)
- **AND** the graph layout SHALL NOT re-run unless the dependency structure itself changed

#### Scenario: A new dependency edge is added
- **WHEN** a real-time sync event indicates a new dependency relationship
- **THEN** the new edge and possibly a new node SHALL be added to the graph
- **AND** the layout SHALL re-run with a smooth animation
