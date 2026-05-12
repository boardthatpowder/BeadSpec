## ADDED Requirements

### Requirement: No Generic Command Runners
The app SHALL NOT expose a Tauri command that accepts free-form shell command names, arbitrary argument arrays, or renderer-controlled working directories.

#### Scenario: runBdCommand is removed
- **WHEN** `src-tauri/src/lib.rs` is compiled
- **THEN** no Tauri command named `run_bd_command` or `runBdCommand` SHALL be registered
- **AND** the frontend `src/stores/settingsStore.ts` SHALL NOT import or call any such command

#### Scenario: runRufloCommand is removed
- **WHEN** `src-tauri/src/lib.rs` is compiled
- **THEN** no Tauri command named `run_ruflo_command` or `runRufloCommand` SHALL be registered

#### Scenario: Attempting to invoke a removed command fails at compile time
- **WHEN** the TypeScript bindings are regenerated via `tauri-specta`
- **THEN** any frontend code referencing a deleted command SHALL produce a TypeScript type error

---

### Requirement: Named Allowlisted Backend Operations
Each bd or external CLI operation the frontend needs SHALL be exposed as a dedicated, typed Tauri command with fixed semantics.

#### Scenario: bd create task command accepts only typed parameters
- **WHEN** the frontend invokes the bd create task command
- **THEN** it SHALL pass only the typed fields (title, description, type, priority, labels) — no raw args array
- **AND** the Rust command SHALL construct the `bd` invocation from those typed fields internally

#### Scenario: Disallowed argument is rejected
- **WHEN** a caller attempts to inject shell metacharacters or additional flags via any typed field
- **THEN** the Rust command SHALL sanitize or reject the input before passing it to the subprocess
- **AND** an error SHALL be returned to the frontend without executing the command

#### Scenario: Unknown project is rejected
- **WHEN** a command is invoked with a project ID that is not in the backend's project registry
- **THEN** the command SHALL return an error: "project not registered"
- **AND** no subprocess SHALL be spawned

---

### Requirement: Project Path Registry Validation
All IPC commands that operate on a project SHALL resolve the project from the backend registry using its opaque ID, not a frontend-supplied file path.

#### Scenario: Frontend supplies project ID, backend resolves path
- **WHEN** a bd operation command is invoked with a `project_id` argument
- **THEN** the backend SHALL look up the canonical project path from the in-memory registry
- **AND** SHALL use that canonical path as the working directory for the subprocess
- **AND** SHALL NOT use any path string supplied by the frontend as the cwd

#### Scenario: Project ID not in registry
- **WHEN** the frontend supplies a project ID that does not exist in the registry
- **THEN** the backend SHALL return a structured error without spawning any subprocess

---

### Requirement: Binary Override Confirmation
Custom binary paths configured by the user SHALL be validated before being used, and SHALL NOT be accepted at invocation time from the renderer.

#### Scenario: User sets a custom bd binary path in settings
- **WHEN** the user saves a custom `bd` binary path in the settings dialog
- **THEN** the backend SHALL verify the path exists and is executable
- **AND** SHALL display a confirmation: "Allow Beads to use this binary: <path>?"
- **AND** only after the user confirms SHALL the path be persisted to the settings store

#### Scenario: Renderer cannot override binary path at invocation time
- **WHEN** a frontend caller invokes a bd operation command
- **THEN** the command signature SHALL NOT accept a binary path parameter
- **AND** the binary path SHALL be resolved exclusively from validated backend settings state
