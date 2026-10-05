## Context

Implementation of the plan accepted in this session for GitHub #35. Beads 1.3.0 is the pinned wire contract; capability checks support additive later releases. The installed 1.0.3 remains untouched and is rejected by the new application minimum gate.

## Goals / Non-Goals

Preserve shipped CRUD, filters, fuzzy search, worker provenance, OpenSpec mappings, epic snapshots, issue correlations and task history while replacing schema-coupled data reads. Remote HTTP endpoints, bundled Beads installation, new readiness views and velocity charts are non-goals.

## Decisions

A Rust BeadsDataSource owns resolved binary/workspace identity and dispatches HTTP or CLI. ProjectRegistry remains keyed by canonical project path. HTTP uses reqwest without proxies or redirects, app-owned `bd serve --addr 127.0.0.1:0`, identity verification and upstream project-id stamps. Startup has a 30-second budget. CLI calls inherit the same environment and serialize per resolved embedded Beads directory. Core command return types remain stable. HTTP errors preserve blocker-close UI and writes preserve create-ID output. Uncertain writes never blindly retry or fall back.

Complete issue reads include closed/templates/gates/infra and full notes; adapters retain status OR, labels AND, descending priority, date/id ties and existing fuzzy ranking. Raw edges preserve direction/missing targets. Ancillary issue queries reuse this source rather than SQL. Native history/diff/comments preserve task timelines. Global historical coverage is bounded; buffers remain seven days/5000 events per project.

Probe effective config and executable on_create/on_update/on_close hooks. Native CLI handles relevant hooks, direct-server off/batch commit policies and enabled command-side auto-export/push/backup. Default server auto-commit on allows HTTP. Unknown config selects CLI conservatively. Embedded/unsupported operations use CLI.

ProjectBackendStatus reports read/write transport, live-update mode, journal enablement, historical coverage and reason. `get_project_backend_status` reads it; `enable_project_journal` invokes native config set and restarts the owned serve. Core Task/TaskDetail/WriteResult contracts stay stable; Epic SnapshotSource gains Http. Activity delivery and buffers are project-scoped.

HTTP bootstrap reads head before current state, then replays from that checkpoint. SSE is incrementally decoded; sequence advances only after processing and duplicate delivery is ignored. Disabled, truncated, saturated, malformed and dropped streams have explicit recovery. Embedded uses finite journal probes every two seconds, pre-snapshot drain and subsequent bounded batches. Checkpoints are session-local, reset on workspace/branch/identity changes; validate last-record anchors for CLI regressions. Every 30 seconds and on focus/manual refresh, reconcile complete current-state caches to cover unjournaled pull/merge/raw SQL/restore changes.

## Risks / Trade-offs

Journal is off by default, branch/clone-local and bounded. Enabling it changes workspace config and requires serve restart. Existing scripts can affect writes, so preserve native command behavior instead of emulating hooks. HTTP has no global historical backfill: display coverage limits. Reconciliation is eventually consistent across endpoints, so bootstrap replay and periodic refresh protect races. Preserve recovery safety probes; SQLx may remain for diagnostics/chrono but no Beads data queries or Dolt commit poller remain active.

## Validation

Behavioral Rust adapter/lifecycle/event tests, frontend invalidation/status tests, pinned Beads 1.3 real-server/embedded smoke tests with isolated databases, cargo test, Vitest, typecheck, lint, build, strict OpenSpec validation, independent code review and commit/push verification. User implementation approval includes the planned isolated integration tests.
