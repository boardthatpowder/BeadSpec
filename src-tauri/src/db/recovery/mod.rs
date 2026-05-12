pub mod enumerate;
pub mod kill;
pub mod predicates;

// Re-export the public surface so callers use `db::recovery::*` unchanged.
pub use enumerate::{
    classify, enumerate_dolt_processes, read_supervisor_pid, DoltCandidate, SupervisorRecord,
};
pub use kill::{
    cleanup_lock_files, format_epoch_rfc3339, terminate_forceful, terminate_graceful,
    wait_for_exit, write_supervisor_pid,
};
pub use predicates::{is_safe_to_auto_kill, SafetyDecision};

use std::path::PathBuf;
use std::time::Duration;
use thiserror::Error;
use tokio::net::TcpStream;
use tokio::time::timeout;

// ── Shared types ─────────────────────────────────────────────────────────────

/// Classification of a dolt SQL server's health at startup probe time.
#[derive(Debug, Clone, serde::Serialize, specta::Type)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum DoltHealth {
    Ok,
    PortBoundButNotResponding {
        pid: Option<u32>,
    },
    PortUnboundButOrphanRunning {
        pid: u32,
        port: u16,
        data_dir: PathBuf,
    },
    NotRunning,
    ForeignProcessHoldingPort {
        pid: u32,
        exe: String,
    },
}

/// Full diagnostic report returned to the frontend on project open.
#[derive(Debug, Clone, serde::Serialize, specta::Type)]
pub struct HealthReport {
    pub health: DoltHealth,
    pub project_path: String,
    pub configured_port: u16,
    pub orphans: Vec<OrphanInfo>,
}

/// A dolt sql-server process that is running but should not be.
#[derive(Debug, Clone, serde::Serialize, specta::Type)]
pub struct OrphanInfo {
    pub pid: u32,
    pub port: Option<u16>,
    pub data_dir: PathBuf,
    pub safety: SafetyDecision,
}

/// Errors emitted by the recovery layer.
#[derive(Debug, Error)]
pub enum RecoveryError {
    #[error("probe timed out")]
    ProbeTimeout,
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("SQL error: {0}")]
    Sql(#[from] sqlx::Error),
    #[error("escalated to user: {reason}")]
    Escalated { reason: String },
    #[error("foreign process on port {port} (pid {pid})")]
    ForeignProcess { pid: u32, port: u16 },
}

/// Result of an attempted recovery operation.
#[derive(Debug, serde::Serialize, specta::Type)]
#[serde(tag = "outcome", rename_all = "snake_case")]
pub enum RecoveryResult {
    Success { port: u16 },
    StillUnsafe { reason: String },
    Error { message: String },
}

// ── Probe ────────────────────────────────────────────────────────────────────

pub async fn probe(port: u16) -> DoltHealth {
    let addr = format!("127.0.0.1:{port}");
    let tcp_result = timeout(Duration::from_secs(1), TcpStream::connect(&addr)).await;
    match tcp_result {
        Err(_) | Ok(Err(_)) => return DoltHealth::NotRunning,
        Ok(Ok(_)) => {}
    }
    let url = format!("mysql://root:@127.0.0.1:{port}/information_schema");
    let sql_ok = timeout(Duration::from_secs(2), async {
        let pool = sqlx::MySqlPool::connect(&url).await?;
        let r = sqlx::query("SELECT 1").execute(&pool).await;
        pool.close().await;
        r
    })
    .await;
    match sql_ok {
        Ok(Ok(_)) => DoltHealth::Ok,
        _ => DoltHealth::PortBoundButNotResponding { pid: None },
    }
}

pub async fn probe_with_deadline(port: u16) -> DoltHealth {
    timeout(Duration::from_secs(3), probe(port))
        .await
        .unwrap_or(DoltHealth::NotRunning)
}

// ── Entry point (task 6.1) ────────────────────────────────────────────────────

/// Run the health probe + orphan-detection + safe-kill sequence before opening
/// a connection pool. Returns `Ok(())` when healthy or successfully recovered.
/// Returns `Err(RecoveryError::Escalated)` when the situation requires the user
/// to confirm via the frontend `RecoveryDialog`.
pub async fn guard(
    project_path: &str,
    embeddeddolt_dir: &std::path::Path,
) -> Result<(), RecoveryError> {
    use crate::recovery_log::{append, LogEntry, LogEvent};
    use std::time::Duration;

    // Step 1: Probe the configured port. If healthy, nothing to do.
    let port = read_configured_port(embeddeddolt_dir);
    if let Some(port) = port {
        let health = probe_with_deadline(port).await;
        if matches!(health, DoltHealth::Ok) {
            let _ = append(&LogEntry::new(project_path, LogEvent::ProbeOk, "healthy"));
            return Ok(());
        }
    }

    // Step 2: Enumerate and classify orphans.
    let candidates = enumerate::enumerate_dolt_processes(embeddeddolt_dir);
    let sup = enumerate::read_supervisor_pid(project_path);
    let orphans = enumerate::classify(candidates, sup.as_ref());

    if orphans.is_empty() {
        // No orphans — safe to let spawn_or_get start a fresh server.
        return Ok(());
    }

    for orphan in &orphans {
        let _ = append(&LogEntry {
            pid: Some(orphan.pid.as_u32()),
            port: orphan.port,
            data_dir: Some(orphan.data_dir.to_string_lossy().into_owned()),
            ..LogEntry::new(project_path, LogEvent::OrphanDetected, "found")
        });
    }

    // Step 3: Check safety predicates.
    // Discover the database name so working_set_clean connects to the correct DB.
    // If we cannot determine the name, we escalate rather than skipping the check.
    let db_name = match discover_db_name(embeddeddolt_dir) {
        Some(n) => n,
        None => {
            let reason =
                "cannot_verify_working_set: could not determine Beads DB name from data dir"
                    .to_string();
            let _ = append(&LogEntry::new(project_path, LogEvent::ModalShown, &reason));
            return Err(RecoveryError::Escalated { reason });
        }
    };
    for orphan in &orphans {
        let decision =
            predicates::is_safe_to_auto_kill(orphan, embeddeddolt_dir, false, &db_name).await;
        if let predicates::SafetyDecision::Escalate { reason } = decision {
            let _ = append(&LogEntry::new(project_path, LogEvent::ModalShown, &reason));
            return Err(RecoveryError::Escalated { reason });
        }
    }

    // Step 4: All safe — kill and clean up.
    for orphan in &orphans {
        kill::terminate_graceful(orphan.pid);
        let exited = kill::wait_for_exit(orphan.pid, Duration::from_secs(5)).await;
        if exited {
            let _ = append(&LogEntry {
                pid: Some(orphan.pid.as_u32()),
                ..LogEntry::new(project_path, LogEvent::AutoKill, "graceful")
            });
        } else {
            kill::terminate_forceful(orphan.pid);
            let _ = append(&LogEntry {
                pid: Some(orphan.pid.as_u32()),
                ..LogEntry::new(project_path, LogEvent::ForceKill, "sigkill")
            });
        }
    }
    kill::cleanup_lock_files(project_path);
    Ok(())
}

/// Discover the Beads database name for an embedded-dolt project.
///
/// Dolt stores each database as a subdirectory inside the data directory.
/// We look for the first non-hidden subdirectory of `embeddeddolt_dir`, which
/// is the database name Dolt will accept as a connection target.
///
/// Returns `None` when the directory is absent or contains no database yet.
pub fn discover_db_name(embeddeddolt_dir: &std::path::Path) -> Option<String> {
    // The Beads DB lives one level up (at .beads/), not inside embeddeddolt/.
    // However, Dolt's data directory IS embeddeddolt/, so the per-database dirs
    // are direct children of it.
    if let Ok(entries) = std::fs::read_dir(embeddeddolt_dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_dir() {
                if let Some(name) = p.file_name().and_then(|n| n.to_str()) {
                    if !name.starts_with('.') {
                        return Some(name.to_string());
                    }
                }
            }
        }
    }
    None
}

fn read_configured_port(embeddeddolt_dir: &std::path::Path) -> Option<u16> {
    let config = embeddeddolt_dir.join("config.yaml");
    let content = std::fs::read_to_string(config).ok()?;
    for line in content.lines() {
        let line = line.trim();
        if let Some(rest) = line.strip_prefix("port:") {
            if let Ok(p) = rest.trim().parse::<u16>() {
                return Some(p);
            }
        }
    }
    None
}

// ── Probe tests (tasks 2.4, 2.5) ─────────────────────────────────────────────

#[cfg(test)]
mod probe_tests {
    use super::{probe_with_deadline, DoltHealth};
    use std::net::TcpListener;
    use std::time::Instant;

    #[tokio::test]
    async fn probe_closed_port_returns_not_running() {
        let port = {
            let l = TcpListener::bind("127.0.0.1:0").expect("bind");
            l.local_addr().unwrap().port()
        };
        let start = Instant::now();
        let health = probe_with_deadline(port).await;
        assert!(matches!(health, DoltHealth::NotRunning), "got {health:?}");
        assert!(start.elapsed().as_secs() < 2);
    }

    #[tokio::test]
    async fn probe_hung_tcp_listener_returns_port_bound_not_responding() {
        use std::net::TcpListener as StdListener;
        let listener = StdListener::bind("127.0.0.1:0").expect("bind");
        let port = listener.local_addr().unwrap().port();
        listener.set_nonblocking(true).ok();
        std::thread::spawn(move || {
            for stream in listener.incoming() {
                match stream {
                    Ok(_s) => std::thread::sleep(std::time::Duration::from_secs(10)),
                    Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                        std::thread::sleep(std::time::Duration::from_millis(10));
                    }
                    Err(_) => break,
                }
            }
        });
        let start = Instant::now();
        let health = probe_with_deadline(port).await;
        assert!(
            matches!(health, DoltHealth::PortBoundButNotResponding { .. }),
            "got {health:?}"
        );
        assert!(start.elapsed().as_secs() < 4);
    }
}
