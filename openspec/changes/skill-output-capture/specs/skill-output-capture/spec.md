## ADDED Requirements

### Requirement: CLI helper captures review markdown into Ruflo memory

`scripts/bd-capture-review.sh` SHALL accept `--kind <pr-review|code-review|security-review>` and `--branch <name>` as required arguments, read the full review body from stdin, and store it in Ruflo memory under a structured key of the form `<ruflo_key_prefix>|review:<kind>|branch:<name>|[pr:<num>|]ts:<epoch>`. The script SHALL print the stored key and a one-line confirmation on success. It SHALL fail fast on missing required args (exit 2), on prefix-lookup failure (exit 3), or on `ruflo memory store` failure (exit 4).

#### Scenario: Happy path capture
- **WHEN** the user runs `echo "# My Review\nbody" | scripts/bd-capture-review.sh --kind code-review --branch feat/my-feature`
- **THEN** the script resolves the Ruflo key prefix, builds a structured key, stores the body via `ruflo memory store`, and prints the key + "stored" to stdout
- **AND** exits with code 0

#### Scenario: Missing required --branch argument
- **WHEN** the user runs `echo "body" | scripts/bd-capture-review.sh --kind code-review` (omitting `--branch`)
- **THEN** the script prints a usage error to stderr
- **AND** exits with code 2

#### Scenario: Missing required --kind argument
- **WHEN** the user runs `echo "body" | scripts/bd-capture-review.sh --branch feat/x` (omitting `--kind`)
- **THEN** the script prints a usage error to stderr
- **AND** exits with code 2

#### Scenario: Ruflo prefix lookup fails
- **WHEN** `~/.claude/ruflo/lib/tags.sh` is absent or `ruflo_key_prefix` returns an error
- **THEN** the script prints an error message to stderr
- **AND** exits with code 3
- **AND** no memory store call is made

#### Scenario: ruflo memory store fails
- **WHEN** `ruflo memory store` returns a non-zero exit code
- **THEN** the script prints the error output to stderr
- **AND** exits with code 4

#### Scenario: Deduplication via --dedupe-sha
- **WHEN** the user runs the script with `--dedupe-sha` and a `sha256` of the body matches an existing key substring `sha:<digest>` in memory
- **THEN** the script prints a "duplicate body detected, skipping" warning to stdout
- **AND** exits with code 0 without writing a new entry

#### Scenario: Empty stdin
- **WHEN** stdin is empty (zero bytes)
- **THEN** the script prints an error "Review body is empty — nothing to capture" to stderr
- **AND** exits with code 2

---

### Requirement: Reviews are queryable by branch, PR, and kind via Tauri commands

The Tauri commands `list_reviews` and `get_review` SHALL expose captured reviews to the frontend. `list_reviews` SHALL accept a `ReviewScope` (Branch, Pr, TaskId, or All) and return `Vec<ReviewEntry>`. `get_review` SHALL accept a memory key and return a `ReviewEntry` with the full body. Both commands SHALL be unavailable (not called) when Ruflo is not enabled in Settings.

#### Scenario: List reviews by branch
- **WHEN** `list_reviews` is called with scope `Branch("feat/my-feature")`
- **THEN** it returns all `ReviewEntry` items whose key contains `branch:feat/my-feature`
- **AND** entries from other branches are excluded

#### Scenario: List reviews by PR number
- **WHEN** `list_reviews` is called with scope `Pr(42)`
- **THEN** it returns all entries whose key contains `pr:42`

#### Scenario: Get full review body
- **WHEN** `get_review` is called with a valid key
- **THEN** it returns the `ReviewEntry` with the `body` field populated with the full stored markdown

#### Scenario: Unparseable key entries are skipped gracefully
- **WHEN** `ruflo memory search` returns an entry with a malformed key that cannot be parsed into a `ReviewEntry`
- **THEN** that entry is skipped and a warning is logged
- **AND** the remaining valid entries are returned normally

---

### Requirement: Append-only model — no UI write, edit, or delete in v1

The UI SHALL provide no controls to create, edit, or delete review entries. Reviews are written exclusively via `scripts/bd-capture-review.sh`. Deletion is performed via `ruflo memory forget -k <key>` in the terminal.

#### Scenario: No write controls in Reviews section
- **WHEN** the user views the Reviews section in TaskDetailPanel or the Reviews sub-tab in BdHealthPanel
- **THEN** no "Add review", "Edit", or "Delete" button or control is present in either surface

#### Scenario: Review count stable across re-loads
- **WHEN** no new `bd-capture-review.sh` call has been made
- **THEN** the set of entries returned by `list_reviews` is identical across successive calls (append-only guarantee, no silent mutations)
