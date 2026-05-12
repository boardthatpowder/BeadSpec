## ADDED Requirements

### Requirement: Restrictive Content Security Policy
The app SHALL set a `Content-Security-Policy` header that blocks inline scripts, restricts resource origins to `'self'` and Tauri's required IPC origins, and is not `null`.

#### Scenario: CSP is present and non-null
- **WHEN** `src-tauri/tauri.conf.json` is parsed
- **THEN** `app.security.csp` SHALL NOT be `null`
- **AND** SHALL include `default-src 'self'`
- **AND** SHALL include `script-src 'self'`
- **AND** SHALL include `connect-src ipc: http://ipc.localhost`
- **AND** SHALL NOT include `'unsafe-eval'`

#### Scenario: Config snapshot test fails on csp null
- **WHEN** a test reads `src-tauri/tauri.conf.json`
- **THEN** the test SHALL fail if `app.security.csp` is `null` or absent
- **AND** the test SHALL fail if `app.security.csp` contains `'unsafe-eval'` or `'unsafe-inline'` in `script-src`

---

### Requirement: Per-Window Capability Files
Each window type SHALL have its own capability file granting only the permissions it uses.

#### Scenario: Main window capability is scoped to main window only
- **WHEN** `src-tauri/capabilities/main-window.json` is parsed
- **THEN** its `windows` array SHALL contain only the main window identifier
- **AND** it SHALL NOT grant capabilities intended solely for quick-capture

#### Scenario: Quick-capture window capability is scoped to quick-capture only
- **WHEN** `src-tauri/capabilities/quick-capture.json` is parsed
- **THEN** its `windows` array SHALL contain only the quick-capture window identifier
- **AND** it SHALL NOT grant `shell:allow-execute`, `shell:allow-open`, or `opener:default`

#### Scenario: No shared catch-all capability grants shell access
- **WHEN** all files in `src-tauri/capabilities/` are parsed
- **THEN** no capability file SHALL grant `shell:allow-execute` or `shell:allow-open` to a wildcard window pattern (`*`)

---

### Requirement: Shell and Opener Permission Scoping
Shell and opener permissions SHALL be removed unless strictly required, and any retained instances SHALL be scoped to the minimum necessary target.

#### Scenario: shell:allow-execute absent from all capabilities
- **WHEN** the set of all granted permissions across all capability files is enumerated
- **THEN** `shell:allow-execute` SHALL NOT appear unless a specific documented requirement is met
- **AND** any retained instance SHALL list the exact binary path in its `allow` list (not a wildcard)

#### Scenario: opener:default retained only for main window external links
- **WHEN** `opener:default` is granted
- **THEN** it SHALL be granted only in `main-window.json`
- **AND** the grant SHALL be accompanied by a comment documenting why it is required

#### Scenario: Config snapshot test fails on broad shell permissions
- **WHEN** a test enumerates all capability files
- **THEN** the test SHALL fail if any file grants `shell:allow-execute` or `shell:allow-open` without a specific `allow` list
- **AND** the test SHALL fail if `quick-capture.json` grants `opener:default`
