# Notifications & Tray App Specification

## Purpose

Defines native OS notifications for task events and the menu bar / system tray mini-app that provides quick task creation and status overview without opening the full window.

---

## Requirements

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
- **WHEN** the user opens notification settings (via the Settings dialog)
- **THEN** they SHALL be able to individually toggle: assignment notifications, unblock notifications, comment notifications
- **AND** a global mute toggle SHALL suppress all notifications
- **AND** preference changes SHALL be persisted to `settings.json` via `@tauri-apps/plugin-store` and survive app restarts

#### Scenario: Legacy localStorage notification prefs are migrated on first load
- **WHEN** the app loads and finds a `notification-prefs` key in `localStorage`
- **THEN** those values are written to `settings.json`, the `localStorage` key is removed, and subsequent reads come from the settings store

---

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

---

### Requirement: Human Queue Chip in Top Bar

The system SHALL display a persistent chip in the top bar showing the count of issues flagged for human decision, so users are aware of pending decisions without leaving the app.

#### Scenario: Chip appears when human queue has items

- **WHEN** `bd human list --json` returns one or more items
- **THEN** a chip SHALL appear in the top bar showing the pending count (e.g. "2 decisions pending")
- **AND** the chip SHALL be visually distinct (e.g. amber/yellow badge) to draw attention

#### Scenario: Chip is hidden when queue is empty

- **WHEN** `bd human list --json` returns an empty array
- **THEN** NO chip SHALL be visible in the top bar
- **AND** the top bar layout SHALL reflow as if the chip is absent

#### Scenario: Chip is hidden when bd is not on PATH

- **WHEN** the `bd` binary is not resolvable from `AppState.bd_path`
- **THEN** NO chip SHALL be visible and NO error SHALL be shown related to the human queue

#### Scenario: Poll fires every 60 seconds when window is focused

- **WHEN** the app window has focus (document.visibilityState === 'visible')
- **THEN** `bd human list --json` SHALL be polled every 60 seconds
- **AND** the chip count SHALL update to reflect the latest result after each poll

#### Scenario: Poll is skipped when window is not focused

- **WHEN** the app window is minimized or hidden (document.visibilityState !== 'visible')
- **THEN** the 60-second poll SHALL be skipped for that tick
- **AND** the chip SHALL retain the last known count

---

### Requirement: Human Queue Decision Popover

The system SHALL provide a popover anchored to the human-queue chip that lists pending decision items and allows the user to respond, dismiss, or view each item.

#### Scenario: User opens the decision popover

- **WHEN** the user clicks the human-queue chip
- **THEN** a popover SHALL appear anchored below the chip
- **AND** the popover SHALL list each pending item with: title, prompt text, "Respond" button, "Dismiss" button, and "View issue" button

#### Scenario: User closes the popover

- **WHEN** the user clicks outside the popover or presses Escape
- **THEN** the popover SHALL close
- **AND** no item state SHALL change

#### Scenario: User responds to a decision item

- **WHEN** the user clicks "Respond" on an item
- **THEN** an inline text input SHALL expand below that item
- **WHEN** the user types a response and presses Enter or clicks "Send"
- **THEN** `bd human respond <id> "<text>"` SHALL be invoked
- **AND** the item SHALL be immediately removed from the popover (optimistic)
- **AND** the chip count SHALL decrement immediately

#### Scenario: User dismisses a decision item

- **WHEN** the user clicks "Dismiss" on an item
- **THEN** `bd human dismiss <id>` SHALL be invoked
- **AND** the item SHALL be immediately removed from the popover (optimistic)
- **AND** the chip count SHALL decrement immediately

#### Scenario: User views the associated issue

- **WHEN** the user clicks "View issue" on an item
- **THEN** the task detail panel SHALL open for that issue ID
- **AND** the popover SHALL close

#### Scenario: Popover is empty after all items are acted upon

- **WHEN** the user responds to or dismisses all items in the popover
- **THEN** the popover SHALL show an empty state: "No pending decisions"
- **AND** the chip SHALL disappear from the top bar

---

## Non-Goals

- Push notifications from a remote server (all notifications are derived from local Dolt sync)
- Email or Slack integration (out of scope for v1)
- `beads://task/123` deep-link URL scheme (deferred to v1.1 due to OS registration complexity on Linux and Windows registry requirements)
