## ADDED Requirements

Defines native OS notifications for task events and the menu bar / system tray mini-app that provides quick task creation and status overview without opening the full window.

### Requirement: Native OS Notifications

The system SHALL deliver native OS notifications for task events relevant to the current user, using Tauri's notification plugin.

#### Scenario: User is assigned to a task
- **WHEN** a real-time sync event shows the current user has been assigned to a task
- **THEN** a native OS notification SHALL be delivered with: task ID, title, and assigner name
- **AND** clicking the notification SHALL bring the app to the foreground and open that task

#### Scenario: A blocking dependency closes
- **GIVEN** the current user has an In Progress task T that was blocked by dependency D
- **WHEN** D's status changes to Closed via real-time sync
- **THEN** a native OS notification SHALL be delivered: "Task D closed — T is now unblocked"
- **AND** clicking the notification SHALL open Task T in the app

#### Scenario: Task is commented on
- **WHEN** a comment is added to a task assigned to or created by the current user
- **THEN** a native OS notification SHALL be delivered with the commenter's name and a preview of the comment
- **AND** clicking the notification SHALL open that task's activity tab

#### Scenario: User controls notification preferences
- **WHEN** the user opens notification settings
- **THEN** they SHALL be able to individually toggle: assignment notifications, unblock notifications, comment notifications
- **AND** a global mute toggle SHALL suppress all notifications

### Requirement: Menu Bar / System Tray Mini-App

The system SHALL provide a menu bar item (macOS) and system tray icon (Windows/Linux) that shows an open task count badge and allows quick task creation and status overview without opening the main window.

#### Scenario: Tray icon displays open task count
- **WHEN** the app is running in the background
- **THEN** the menu bar / tray icon SHALL display the count of tasks assigned to the current user with status Open or In Progress
- **AND** the count SHALL update in real time with the 2-second sync poll

#### Scenario: User clicks the tray icon
- **WHEN** the user clicks the menu bar / tray icon
- **THEN** a compact popover SHALL appear showing:
  - Count of open tasks assigned to the user
  - Quick-create task form (title + priority only)
  - "Open Beads UI" button to bring the main window to the foreground

#### Scenario: User creates a task from the tray
- **WHEN** the user fills in the quick-create form and submits
- **THEN** `bd create` SHALL be invoked with the provided title and priority
- **AND** a success toast SHALL appear in the tray popover with the new task ID
- **AND** the main window's task list SHALL reflect the new task on next sync

#### Scenario: App is launched with the main window closed
- **WHEN** the user starts the machine and the app is configured to start at login
- **THEN** the app SHALL launch directly to the tray without showing the main window
- **AND** the main window SHALL be openable via the tray popover

## Non-Goals

- Push notifications from a remote server (all notifications are derived from local Dolt sync)
- Email or Slack integration (out of scope for v1)
- `beads://task/123` deep-link URL scheme (deferred to v1.1 due to OS registration complexity on Linux and Windows registry requirements)
