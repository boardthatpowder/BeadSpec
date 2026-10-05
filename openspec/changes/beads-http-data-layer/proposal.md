## Why

GitHub issue #35 identifies Beads 1.3's stable HTTP contract and ordered change journal as replacements for schema-coupled SQL reads and commit polling. Issue-row diffs also miss comment, label, dependency and working-set changes.

## What Changes

- **BREAKING**: require Beads 1.3+; offer native CLI fallback for embedded workspaces.
- Read Beads current state through supervised loopback HTTP; preserve existing task IPC and filtering/search behavior.
- Route writes through HTTP unless hooks, explicit commit policies, command maintenance, unsupported operations or embedded mode require native CLI behavior.
- Offer per-workspace journal opt-in; consume ordered events with recovery and 30-second current-state reconciliation.
- Replace application SQL issue/history reads with HTTP/native CLI adapters; make bounded historical coverage visible.
- Add typed transport status and journal-enable IPC, project-scoped events, and an HTTP epic snapshot source.

## Capabilities

### New Capabilities
- `beads-http-api`: supervised HTTP/CLI transport, compatibility policy and opt-in live updates.

### Modified Capabilities
- `data-layer`: API current-state reads, compatible mutations, journal sync and independent per-project clients replace SQL pools and commit polling.
- `app-refresh`: focus/manual/30-second reconciliation refresh all project-owned caches.
- `task-detail`: native audit/commit history and structured comments preserve task-history behavior.
- `workflow-activity-feed`: project-scoped retained journal/CLI history replaces SQL cold backfill with visible coverage limits.
- `epic-progress-dashboard`: API-backed readiness/progress and truthful HTTP source replace SQL fallback.

## Impact

Rust project/read/write/worker/OpenSpec/epic/GitNexus/activity commands, db registry/poller lifecycle, existing sync hooks, project health controls and docs. Approved dependency: reqwest 0.13.3; approved API additions: backend status, journal enablement and HTTP snapshot source. Existing core task signatures stay compatible. Ready-view and velocity feature gaps are outside this change.
