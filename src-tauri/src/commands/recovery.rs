/// Tauri commands for the recovery layer.
/// Implements tasks 6.2 and 6.3.
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};

use crate::db::dolt_server::DoltServerRegistry;
use crate::db::pool::ProjectRegistry;
use crate::db::recovery::{self, DoltHealth, HealthReport, OrphanInfo, RecoveryResult};
use crate::recovery_log::{append, LogEntry, LogEvent};

/// Build a `HealthReport` for the recovery dialog. Caller supplies a pre-computed
/// `DoltHealth` so this helper never re-probes — that matters for the
/// `SpawnFailed` case where probing is meaningless.
pub(crate) async fn build_health_report(
    project_path: String,
    configured_port: u16,
    health: DoltHealth,
) -> HealthReport {
    let data_dir = dolt_data_dir(&project_path);
    let candidates = recovery::enumerate_dolt_processes(&data_dir);
    let sup = recovery::read_supervisor_pid(&project_path);
    let orphans_raw = recovery::classify(candidates, sup.as_ref());

    // Prefer metadata.json's dolt_database — directory enumeration can pick
    // the wrong DB when embeddeddolt/ contains more than one database.
    let db_name = crate::commands::project::resolve_db_name(&project_path)
        .or_else(|| recovery::discover_db_name(&data_dir))
        .unwrap_or_default();
    let mut orphans: Vec<OrphanInfo> = Vec::new();
    for c in &orphans_raw {
        let safety = recovery::is_safe_to_auto_kill(c, &data_dir, false, &db_name).await;
        orphans.push(OrphanInfo {
            pid: c.pid.as_u32(),
            port: c.port,
            data_dir: c.data_dir.clone(),
            safety,
        });
    }

    HealthReport {
        health,
        project_path,
        configured_port,
        orphans,
    }
}

// ── Task 6.2 ─────────────────────────────────────────────────────────────────

/// Probe health of the dolt server for a given project without side effects.
/// Used by the frontend "Try again" button in the recovery modal.
#[tauri::command]
#[specta::specta]
pub async fn probe_dolt_health(
    project_path: String,
    _registry: State<'_, Arc<ProjectRegistry>>,
    server_registry: State<'_, Arc<DoltServerRegistry>>,
) -> Result<HealthReport, String> {
    // Resolve the port: check if a server is already registered, otherwise
    // look up the embedded-dolt port from the project config.
    let port = resolve_port(&project_path, &server_registry).await?;
    let health = recovery::probe_with_deadline(port).await;

    let outcome = match &health {
        DoltHealth::Ok => "ok",
        DoltHealth::NotRunning => "not_running",
        DoltHealth::PortBoundButNotResponding { .. } => "port_bound_not_responding",
        DoltHealth::ForeignProcessHoldingPort { .. } => "foreign_process",
        DoltHealth::PortUnboundButOrphanRunning { .. } => "orphan_running",
        DoltHealth::SpawnFailed { .. } => "spawn_failed",
    };
    let _ = append(&LogEntry::new(&project_path, LogEvent::ProbeOk, outcome));

    Ok(build_health_report(project_path, port, health).await)
}

// ── Task 6.3 ─────────────────────────────────────────────────────────────────

/// Attempt to recover a wedged dolt server. If `force = true`, skips
/// predicates 3 (no-clients) and 4 (clean working set) but never skips
/// ownership or data-dir checks.
///
/// On success, the caller should call `connect_project` again.
#[tauri::command]
#[specta::specta]
pub async fn attempt_dolt_recovery(
    project_path: String,
    force: bool,
    app: AppHandle,
    server_registry: State<'_, Arc<DoltServerRegistry>>,
) -> Result<RecoveryResult, String> {
    let data_dir = dolt_data_dir(&project_path);
    let sup = recovery::read_supervisor_pid(&project_path);
    let candidates = recovery::enumerate_dolt_processes(&data_dir);
    let orphans = recovery::classify(candidates, sup.as_ref());

    if orphans.is_empty() {
        return Ok(RecoveryResult::Success {
            port: resolve_port(&project_path, &server_registry)
                .await
                .unwrap_or(0),
        });
    }

    let db_name = crate::commands::project::resolve_db_name(&project_path)
        .or_else(|| recovery::discover_db_name(&data_dir))
        .unwrap_or_default();
    for orphan in &orphans {
        let safety = recovery::is_safe_to_auto_kill(orphan, &data_dir, force, &db_name).await;
        match safety {
            crate::db::recovery::SafetyDecision::Escalate { reason } => {
                // Re-emit so the dialog updates with the fresh state.
                let port = resolve_port(&project_path, &server_registry)
                    .await
                    .unwrap_or(0);
                let health = recovery::probe_with_deadline(port).await;
                let report = build_health_report(project_path.clone(), port, health).await;
                let _ = app.emit("dolt-recovery-required", report);
                return Ok(RecoveryResult::StillUnsafe { reason });
            }
            crate::db::recovery::SafetyDecision::Allowed => {}
        }
    }

    // All safe — kill and clean up.
    for orphan in &orphans {
        recovery::terminate_graceful(orphan.pid);
        let exited = recovery::wait_for_exit(orphan.pid, std::time::Duration::from_secs(5)).await;
        let kill_event = if !exited {
            recovery::terminate_forceful(orphan.pid);
            LogEvent::ForceKill
        } else if force {
            LogEvent::UserForce
        } else {
            LogEvent::AutoKill
        };
        let _ = append(&LogEntry {
            pid: Some(orphan.pid.as_u32()),
            ..LogEntry::new(
                &project_path,
                kill_event,
                format!("pid {}", orphan.pid.as_u32()),
            )
        });
    }
    recovery::cleanup_lock_files(&project_path);

    Ok(RecoveryResult::Success { port: 0 }) // port assigned by spawn_or_get on retry
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async fn resolve_port(
    project_path: &str,
    _server_registry: &DoltServerRegistry,
) -> Result<u16, String> {
    // Read the configured port from the dolt-server config.
    let config_path = std::path::Path::new(project_path).join(".beads/embeddeddolt/config.yaml");
    if let Ok(content) = std::fs::read_to_string(&config_path) {
        for line in content.lines() {
            let line = line.trim();
            if let Some(rest) = line.strip_prefix("port:") {
                if let Ok(p) = rest.trim().parse::<u16>() {
                    return Ok(p);
                }
            }
        }
    }
    Err("Cannot determine dolt port — no config.yaml found".to_string())
}

fn dolt_data_dir(project_path: &str) -> std::path::PathBuf {
    std::path::Path::new(project_path).join(".beads/embeddeddolt")
}
