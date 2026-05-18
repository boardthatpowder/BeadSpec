## ADDED Requirements

### Requirement: Hook writeback convention

Hooks MAY append a `ruflo memory store` write at the end of their run to export a structured event to the activity feed. The write SHALL use a key with segments `branch:<b>|worktree:<w>|repo:<r>|type:event|kind:<k>|ts:<unix>` and a value of `{"summary": "...", "detail": {...}, "correlation_id"?: "..."}`. Hooks SHALL NOT depend on this writeback for their own correctness — it is observation-only and does not affect hook exit codes or block the workflow.

#### Scenario: Hook writes event row and feed surfaces it

- **WHEN** a hook appends a ruflo memory store write matching the `type:event` key schema
- **THEN** the activity-feed memory poller SHALL emit an `ActivityEvent` from it within 3 seconds
- **AND** the event SHALL appear in the Activity feed

#### Scenario: Hook does not write event row

- **WHEN** a hook completes without appending a `type:event` ruflo memory write
- **THEN** hook behaviour SHALL be completely unchanged
- **AND** no error or warning SHALL be emitted by the poller for the absent row

#### Scenario: Malformed JSON value is ignored

- **WHEN** a ruflo memory row with `type:event` contains a value that is not valid JSON
- **THEN** the poller SHALL log a warning (WARN level) and skip that row
- **AND** the feed SHALL not crash or emit a partial event

---

### Requirement: Kind namespace

`kind` values SHALL be dotted, lowercase, and namespaced by source using the prefixes: `bd.*`, `hook.*`, `gitnexus.*`, `worker.*`, `session.*`. Any `kind` value that does not conform to this schema is still accepted by the poller but rendered with a default neutral badge.

#### Scenario: Known kind renders with source colour badge

- **WHEN** an event with `kind: "hook.pre_commit_risk"` appears in the feed
- **THEN** the row SHALL render with the `hook` source colour badge from `LABEL_CHIP_COLORS`

#### Scenario: Unknown kind renders with neutral badge

- **WHEN** an event with `kind: "custom.experimental"` (no matching source prefix) appears
- **THEN** the row SHALL render with a default neutral badge and not crash

---

### Requirement: Memory poller watermarking

The activity-feed memory poller SHALL track the highest `ts:` segment value seen since the last process start and SHALL only emit rows strictly newer than that watermark. The watermark is not persisted — it resets to the startup instant on each app launch.

#### Scenario: Poller skips already-emitted rows

- **WHEN** the poller runs a second time and finds the same ruflo memory rows as the first poll
- **THEN** no duplicate `ActivityEvent` SHALL be emitted

#### Scenario: Event with ts slightly in the future is emitted once

- **WHEN** a ruflo memory row has a `ts:` segment 2 seconds in the future (minor clock skew)
- **THEN** the poller SHALL emit the event once on the first poll where `ts > current_watermark`
- **AND** it SHALL NOT emit it a second time on subsequent polls

#### Scenario: Watermark resets on restart

- **WHEN** the app is restarted
- **THEN** the poller SHALL emit ruflo memory rows from the last 7 days that were not seen in the current ring buffer (i.e. backfill is bounded by the ruflo memory search result, not by a persisted watermark)

---

### Requirement: No deletion of underlying memory rows

The activity feed SHALL NOT delete or modify ruflo memory rows when evicting events from its 7-day ring buffer. Ring-buffer eviction is purely an in-process operation.

#### Scenario: Evicted event still retrievable via ruflo memory

- **WHEN** an event is evicted from the in-process ring buffer (age > 7 days)
- **THEN** running `ruflo memory search -q "type:event"` SHALL still return the original row
- **AND** `ruflo memory retrieve <key>` SHALL still return the original value
