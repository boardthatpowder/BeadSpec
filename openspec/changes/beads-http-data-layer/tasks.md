## 1. Implement and test supervised Beads HTTP/CLI data source, compatibility policy, status and registry

- [ ] 1.1 Implement and test supervised Beads HTTP/CLI data source, compatibility policy, status and registry. Owned files: src-tauri/src/bd/api.rs; src-tauri/src/db/pool.rs; src-tauri/Cargo.toml; src-tauri/Cargo.lock. Verify cargo test / bun run test:unit as applicable.

## 2. Migrate core and ancillary issue, dependency, readiness and task-history reads to the data source

- [ ] 2.1 Migrate core and ancillary issue, dependency, readiness and task-history reads to the data source. Owned files: src-tauri/src/commands/read.rs; workers.rs; openspec.rs; bd_mol.rs; gitnexus_processes.rs; external.rs. Verify cargo test / bun run test:unit as applicable.

## 2. Implement frontend transport status, journal opt-in, complete cache invalidation and project-scoped activity

- [ ] 2.2 Implement frontend transport status, journal opt-in, complete cache invalidation and project-scoped activity. Owned files: src/ hooks, health/activity/epic components, ipc wrappers and tests; README.md; docs-site. Verify cargo test / bun run test:unit as applicable.

## 3. Wire project lifecycle, compatible writes, checkpointed journal sync and bounded activity history

- [ ] 3.1 Wire project lifecycle, compatible writes, checkpointed journal sync and bounded activity history. Owned files: src-tauri/src/commands/project.rs; write.rs; src-tauri/src/db/poller.rs; watchers.rs; events/activity.rs; lib.rs; bd/mod.rs. Verify cargo test / bun run test:unit as applicable.

## 4. Run contract and isolated real-Beads integration checks, full quality gates, review and delivery

- [ ] 4.1 Run contract and isolated real-Beads integration checks, full quality gates, review and delivery. Owned files: integration tests; generated bindings; OpenSpec completion and Beads issue state. Verify cargo test / bun run test:unit as applicable.
