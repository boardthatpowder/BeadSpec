## MODIFIED Requirements

### Requirement: Typed IPC Contract
The system SHALL use `specta` + `tauri-specta` to auto-generate TypeScript type bindings from all Rust Tauri command signatures. The TypeScript frontend SHALL NOT call any Tauri command via a raw `invoke()` string; all calls SHALL go through the auto-generated typed wrapper in `src/bindings.ts`.

#### Scenario: Rust command signature changes
- **WHEN** a developer changes the return type or parameters of a Tauri command in Rust
- **THEN** the TypeScript binding generation SHALL fail to compile if the frontend uses the old types
- **AND** the mismatch SHALL be caught before runtime

#### Scenario: Frontend calls a Tauri command
- **WHEN** the TypeScript frontend invokes a Tauri command
- **THEN** it SHALL use the auto-generated typed wrapper, not a raw `invoke()` string call
- **AND** all parameters and return values SHALL be fully typed

#### Scenario: Raw invoke() import outside bindings.ts fails lint
- **WHEN** a TypeScript file outside `src/bindings.ts` imports from `@tauri-apps/api/core`
- **THEN** the ESLint `no-restricted-imports` rule SHALL report an error
- **AND** CI SHALL fail on this lint violation

---

### Requirement: Multi-Project Connection Management
The system SHALL maintain one independent Dolt connection pool per open project, with no shared singleton. Projects SHALL be identified by a canonicalized filesystem path as the registry key, and the frontend SHALL receive an opaque project ID rather than the database connection URL.

#### Scenario: User opens a second project
- **GIVEN** Project A is open with its own connection pool
- **WHEN** the user opens Project B
- **THEN** a new independent connection pool SHALL be created for Project B
- **AND** Project A's pool SHALL remain active and unaffected

#### Scenario: User closes a project
- **WHEN** the user closes a project
- **THEN** that project's Dolt connection pool SHALL be gracefully drained and closed
- **AND** no connections SHALL be leaked

#### Scenario: Project list discovery
- **WHEN** the app starts
- **THEN** it SHALL invoke `bd list` (or equivalent) to discover available Beads projects on the machine
- **AND** the discovered projects SHALL be shown in the project switcher

#### Scenario: Project path is canonicalized before use
- **WHEN** the user opens a project via a relative path or symlink
- **THEN** the backend SHALL resolve the path to its canonical absolute form via `std::fs::canonicalize`
- **AND** the canonical path SHALL be used as the registry key
- **AND** opening the same project via a symlink and its target SHALL result in one pool, not two

#### Scenario: Frontend receives opaque project ID, not database URL
- **WHEN** `open_project` returns metadata to the frontend
- **THEN** the response SHALL include an opaque project ID (e.g., a UUID or SHA-256 of the canonical path)
- **AND** the response SHALL NOT include `database_url` or any other database connection string
- **AND** the status bar MAY display the canonical project path (not the DB URL)

---

## ADDED Requirements

### Requirement: Parameterized SQL Queries
All SQL queries constructed dynamically from frontend-supplied data SHALL use bound parameters; string interpolation of external values into SQL text is prohibited.

#### Scenario: Label fetch for multiple issues uses bound parameters
- **WHEN** the backend fetches labels for a set of issue IDs
- **THEN** the `IN (...)` clause SHALL be constructed with `sqlx::QueryBuilder` and `.push_bind()` for each ID
- **AND** no issue ID value SHALL appear as literal text in the SQL string

#### Scenario: Issue ID containing SQL metacharacters is handled safely
- **WHEN** an issue ID containing a single quote, comma, or semicolon is passed to the label fetch
- **THEN** labels SHALL be fetched without error
- **AND** the query SHALL NOT produce unexpected SQL syntax or return wrong results
