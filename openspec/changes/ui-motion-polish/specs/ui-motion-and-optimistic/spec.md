## ADDED Requirements

### Requirement: Dialog, Popover, and Tooltip have enter/exit animations
`<Dialog>`, `<Popover>`, and `<Tooltip>` content SHALL animate on open and close using CSS keyframe animations driven by Radix `data-[state=open/closed]` attributes. Animations SHALL respect `prefers-reduced-motion: reduce` via `motion-reduce:animate-none motion-reduce:transition-none` overrides.

#### Scenario: Dialog content fades and scales in on open
- **WHEN** a Dialog opens
- **THEN** the content animates from opacity 0 + scale 95% to opacity 1 + scale 100% over ~150ms

#### Scenario: Dialog content fades and scales out on close
- **WHEN** a Dialog closes
- **THEN** the content animates from opacity 1 + scale 100% to opacity 0 + scale 95% before unmounting

#### Scenario: Animations are suppressed for reduced-motion preference
- **WHEN** the OS `prefers-reduced-motion: reduce` preference is active
- **THEN** all Dialog/Popover/Tooltip animations are instant (no keyframe interpolation)

### Requirement: Toast notifications slide in from bottom-right
`Toast` notifications SHALL animate in from the bottom-right of the screen (slide-in-from-bottom + fade-in) and animate out (slide-out-to-bottom + fade-out) before being removed from the DOM.

#### Scenario: Toast slides in on appear
- **WHEN** a new Toast notification is added
- **THEN** it slides in from below with a fade-in animation over ~200ms

#### Scenario: Toast slides out on dismiss
- **WHEN** a Toast is dismissed (auto-timeout or user close)
- **THEN** it slides out downward with a fade-out animation before removal from DOM

### Requirement: CommandPalette has open/close scale animation
The CommandPalette overlay SHALL animate with scale 95%→100% + fade-in on open and scale 100%→95% + fade-out on close.

#### Scenario: CommandPalette scales in on open
- **WHEN** the CommandPalette opens (Cmd+K or action trigger)
- **THEN** the content panel scales from 95% to 100% with fade-in over ~150ms

### Requirement: Task status changes are optimistic in TaskDetailPanel
When the user claims or closes a task via the TaskDetailPanel, the UI SHALL reflect the new status immediately without waiting for the Tauri IPC round-trip. If the mutation fails, the previous status SHALL be restored and an error toast SHALL appear.

#### Scenario: Claim updates status immediately
- **WHEN** the user clicks "Claim" on a task
- **THEN** the status chip updates to "in_progress" immediately (before server confirmation)

#### Scenario: Failed claim rolls back status
- **WHEN** a claim mutation fails
- **THEN** the status chip reverts to its previous value and an error toast appears

#### Scenario: Close updates status immediately
- **WHEN** the user closes a task
- **THEN** the status chip updates to "done" immediately

### Requirement: Memory entry delete is optimistic
When the user deletes a memory entry in MemoryBrowser, the entry SHALL be removed from the list immediately. If the mutation fails, the entry SHALL reappear and an error toast SHALL appear.

#### Scenario: Delete removes entry immediately
- **WHEN** the user confirms deletion of a memory entry
- **THEN** the entry disappears from the list immediately

#### Scenario: Failed delete restores entry
- **WHEN** a delete mutation fails
- **THEN** the entry reappears in the list and an error toast appears
