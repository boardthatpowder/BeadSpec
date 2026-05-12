/// Safety predicates for orphan auto-kill decisions.
/// Implements tasks 4.1 – 4.7.
use super::enumerate::DoltCandidate;
use sysinfo::{ProcessRefreshKind, ProcessesToUpdate, UpdateKind};

/// Whether it is safe to automatically kill an orphan.
#[derive(Debug, Clone, serde::Serialize, specta::Type)]
#[serde(tag = "decision", rename_all = "snake_case")]
pub enum SafetyDecision {
    Allowed,
    Escalate { reason: String },
}

// ── Task 4.1 ─────────────────────────────────────────────────────────────────

/// Predicate 1 — owned by the current user. Never bypassed with `force`. Task 4.1.
pub fn same_user(candidate: &DoltCandidate) -> bool {
    use sysinfo::System;

    let mut sys = System::new();
    let current_uid = {
        let cur = match sysinfo::get_current_pid() {
            Ok(p) => p,
            Err(_) => return false,
        };
        sys.refresh_processes_specifics(
            ProcessesToUpdate::Some(&[cur]),
            false,
            ProcessRefreshKind::nothing().with_user(UpdateKind::OnlyIfNotSet),
        );
        match sys.process(cur).and_then(|p| p.user_id().cloned()) {
            Some(u) => u,
            None => return false,
        }
    };

    sys.refresh_processes_specifics(
        ProcessesToUpdate::Some(&[candidate.pid]),
        false,
        ProcessRefreshKind::nothing().with_user(UpdateKind::OnlyIfNotSet),
    );
    sys.process(candidate.pid)
        .and_then(|p| p.user_id().cloned())
        .map(|uid| uid == current_uid)
        .unwrap_or(false)
}

// ── Task 4.2 ─────────────────────────────────────────────────────────────────

/// Predicate 2 — the candidate's recorded data-dir canonicalizes to `expected_dir`.
/// Never bypassed with `force`. Task 4.2.
pub fn data_dir_matches(candidate: &DoltCandidate, expected_dir: &std::path::Path) -> bool {
    let expected = expected_dir
        .canonicalize()
        .unwrap_or_else(|_| expected_dir.to_path_buf());
    let actual = candidate
        .data_dir
        .canonicalize()
        .unwrap_or_else(|_| candidate.data_dir.clone());
    actual == expected
}

// ── Task 4.3 ─────────────────────────────────────────────────────────────────

/// Predicate 3 — no external clients connected. Returns `true` (safe to kill)
/// when the port is unreachable. Task 4.3.
pub async fn no_clients_connected(port: u16) -> bool {
    use std::time::Duration;
    use tokio::time::timeout;

    let url = format!("mysql://root:@127.0.0.1:{port}/information_schema");
    let result = timeout(Duration::from_secs(2), async {
        let pool = sqlx::MySqlPool::connect(&url).await?;
        let rows = sqlx::query("SHOW PROCESSLIST").fetch_all(&pool).await?;
        pool.close().await;
        Ok::<usize, sqlx::Error>(rows.len())
    })
    .await;

    match result {
        Ok(Ok(count)) => count <= 1, // only our own probe
        _ => true,                   // unreachable → no clients by definition
    }
}

// ── Task 4.4 (tasks 7.1, 7.2) ────────────────────────────────────────────────

/// Predicate 4 — clean dolt working set. Connects to the project's Beads DB
/// (not `information_schema`) and counts staged or working changes.
///
/// Returns:
/// - `Ok(true)`  — working set is clean (zero staged/working changes).
/// - `Ok(false)` — working set has uncommitted changes.
/// - `Err(...)`  — connection failed or timed out; caller must escalate to the
///                 user rather than assuming clean (task 7.2 safe escalation).
pub async fn working_set_clean(port: u16, db_name: &str) -> Result<bool, String> {
    use std::time::Duration;
    use tokio::time::timeout;

    // Connect directly to the Beads DB so that `dolt_status` resolves to the
    // correct per-database table — querying it from `information_schema` always
    // returns an empty result set (wrong database context).
    let url = format!("mysql://root:@127.0.0.1:{port}/{db_name}");
    let result = timeout(Duration::from_secs(2), async {
        // Return Err (escalate) if the DB is unreachable — never assume clean.
        let pool = sqlx::MySqlPool::connect(&url).await?;
        let row: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM dolt_status WHERE staged = 1 OR working = 1")
                .fetch_one(&pool)
                .await?;
        pool.close().await;
        Ok::<bool, sqlx::Error>(row.0 == 0)
    })
    .await;

    match result {
        Ok(Ok(clean)) => Ok(clean),
        Ok(Err(e)) => Err(format!("dolt_status query failed (db={db_name}): {e}")),
        Err(_) => Err(format!(
            "working set check timed out — cannot verify safety (db={db_name})"
        )),
    }
}

// ── Task 4.5 ─────────────────────────────────────────────────────────────────

/// Composite safety decision. `force = true` skips predicates 3 and 4 but
/// NEVER skips predicates 1 (ownership) or 2 (data-dir). Task 4.5.
///
/// `db_name` is the Beads database name used by `working_set_clean` to connect
/// to the correct Dolt database for the dolt_status check (tasks 7.1, 7.2).
pub async fn is_safe_to_auto_kill(
    candidate: &DoltCandidate,
    expected_dir: &std::path::Path,
    force: bool,
    db_name: &str,
) -> SafetyDecision {
    if !same_user(candidate) {
        return SafetyDecision::Escalate {
            reason: "different_user: process is owned by another user".to_string(),
        };
    }
    if !data_dir_matches(candidate, expected_dir) {
        return SafetyDecision::Escalate {
            reason: "data_dir_mismatch: process references a different project".to_string(),
        };
    }
    if force {
        return SafetyDecision::Allowed;
    }
    if let Some(port) = candidate.port {
        if !no_clients_connected(port).await {
            return SafetyDecision::Escalate {
                reason: "clients_connected: other processes are connected".to_string(),
            };
        }
        match working_set_clean(port, db_name).await {
            Ok(true) => {}
            Ok(false) => {
                return SafetyDecision::Escalate {
                    reason: "dirty_working_set: dolt has uncommitted changes".to_string(),
                };
            }
            Err(msg) => {
                return SafetyDecision::Escalate {
                    reason: format!("cannot_verify_working_set: {msg}"),
                };
            }
        }
    }
    SafetyDecision::Allowed
}

// ── Tests (tasks 4.6, 4.7, 7.5) ─────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use sysinfo::Pid;

    fn fake(pid: u32, data_dir: &str) -> DoltCandidate {
        DoltCandidate {
            pid: Pid::from(pid as usize),
            port: None,
            data_dir: PathBuf::from(data_dir),
            start_time: 1000,
        }
    }

    /// 4.6 — data-dir mismatch escalates even when force = true via is_safe_to_auto_kill,
    ///        but we test data_dir_matches directly since same_user will also fail for
    ///        a non-existent PID first (which is the correct ordering).
    #[test]
    fn data_dir_mismatch_predicate() {
        let c = fake(99999, "/project-a/.beads/embeddeddolt");
        let expected = std::path::Path::new("/project-b/.beads/embeddeddolt");
        assert!(
            !data_dir_matches(&c, expected),
            "data_dir_matches must be false when dirs differ"
        );
    }

    /// 4.7 — PID 1 (init/launchd, owned by root) fails same_user for a non-root runner.
    #[test]
    #[cfg(unix)]
    fn root_pid_fails_same_user() {
        let c = fake(1, "/");
        assert!(
            !same_user(&c),
            "PID 1 (root) must fail same_user for a non-root test runner"
        );
    }

    // ── Task 7.5: working_set_clean tests ────────────────────────────────────

    /// 7.5(b) — working_set_clean returns Err when the Beads DB is unreachable.
    /// Port 1 is guaranteed unreachable (privileged and not listening).
    #[tokio::test]
    async fn working_set_clean_returns_err_when_db_unreachable() {
        let result = working_set_clean(1, "nonexistent_db").await;
        assert!(
            result.is_err(),
            "should Err when DB is unreachable, got: {result:?}"
        );
    }

    /// 7.5 compile-time check — ensure `working_set_clean` accepts (u16, &str) and
    /// returns a Future resolving to Result<bool, String>.  If this compiles the
    /// signature is correct.
    #[test]
    fn working_set_clean_signature_accepts_port_and_db_name() {
        // Verifying the call expression compiles with (u16, &str) arguments is
        // sufficient — the returned future is just dropped (never awaited) so no
        // runtime connection is attempted.
        let port: u16 = 0;
        let db: &str = "test_db";
        let _fut = working_set_clean(port, db);
        // If this function compiles, the signature (u16, &str) is correct.
    }
}
