use crate::db::dolt_server::DoltServerRegistry;
use crate::db::poller::DoltPoller;
use crate::db::pool::ProjectRegistry;
use crate::db::recovery;
use crate::db::watchers::{JsonlWatcher, OpenSpecWatcher, WatcherRegistry};
use crate::settings::AppSettings;
use sha2::{Digest, Sha256};
use std::path::Path;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, State};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct ProjectMeta {
    /// Canonical filesystem path to the project root (user-displayable).
    pub project_path: String,
    /// Opaque identifier derived from the canonical project path (hex-encoded
    /// first 8 bytes of SHA-256). Never contains connection secrets.
    pub project_id: String,
    pub name: String,
    pub prefix: String,
    pub compatible: bool,
    pub schema_message: String,
}

/// Derive an opaque, stable project identifier from the canonical project path.
/// Returns the hex-encoded first 8 bytes of SHA-256(path).
fn project_id_from_path(canonical_path: &str) -> String {
    let hash = Sha256::digest(canonical_path.as_bytes());
    hash[..8]
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn project_id_from_path_is_deterministic() {
        let path = "/tmp/test-project";
        let id1 = project_id_from_path(path);
        let id2 = project_id_from_path(path);
        assert_eq!(id1, id2, "project_id should be deterministic");
    }

    #[test]
    fn project_id_differs_for_different_paths() {
        let id1 = project_id_from_path("/tmp/project-a");
        let id2 = project_id_from_path("/tmp/project-b");
        assert_ne!(id1, id2, "different paths should have different project IDs");
    }

    #[test]
    fn project_id_is_16_hex_chars() {
        // 8 bytes × 2 hex digits = 16 characters
        let id = project_id_from_path("/tmp/some-project");
        assert_eq!(id.len(), 16, "project_id should be 16 hex chars");
        assert!(
            id.chars().all(|c| c.is_ascii_hexdigit()),
            "project_id should contain only hex digits"
        );
    }

    #[test]
    fn project_meta_has_no_database_url_field() {
        // Compile-time check: ProjectMeta must not have a database_url field.
        // If this compiles, the field was successfully removed (or never existed).
        let meta = ProjectMeta {
            project_id: "test01".to_string(),
            project_path: "/tmp".to_string(),
            name: "test".to_string(),
            prefix: "beads".to_string(),
            compatible: true,
            schema_message: "ok".to_string(),
        };
        // Verify project_path is accessible (not database_url)
        assert_eq!(meta.project_path, "/tmp");
        assert_eq!(meta.project_id, "test01");
    }
}

#[derive(serde::Deserialize)]
struct BeadsMetadata {
    dolt_mode: Option<String>,
    dolt_database: Option<String>,
    dolt_port: Option<u16>,
}

fn read_metadata(beads_dir: &Path) -> Option<BeadsMetadata> {
    let content = std::fs::read_to_string(beads_dir.join("metadata.json")).ok()?;
    serde_json::from_str(&content).ok()
}

/// Fallback db-name discovery for projects without metadata.json.
fn discover_db_name_fallback(beads_dir: &Path) -> Option<String> {
    for data_dir in [beads_dir.join("dolt"), beads_dir.join("embeddeddolt")] {
        if let Ok(entries) = std::fs::read_dir(&data_dir) {
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
    }
    None
}

fn server_url(
    beads_dir: &Path,
    db_name: &str,
    metadata_port: Option<u16>,
) -> Result<(String, u16), String> {
    // dolt-server.port is written fresh by bd on every start — check it first.
    // metadata.json dolt_port is a static hint that can go stale across restarts.
    let port = if let Ok(s) = std::fs::read_to_string(beads_dir.join("dolt-server.port")) {
        s.trim().parse::<u16>().map_err(|_| {
            "port_not_configured: .beads/dolt-server.port contains an invalid port number"
                .to_string()
        })?
    } else if let Ok(s) = std::fs::read_to_string(beads_dir.join("port")) {
        s.trim().parse::<u16>().map_err(|_| {
            "port_not_configured: .beads/port contains an invalid port number".to_string()
        })?
    } else if let Some(p) = metadata_port {
        p
    } else {
        return Err("port_not_configured: no .beads/dolt-server.port, .beads/port, or dolt_port in metadata.json — start the server with `bd dolt-start`".to_string());
    };
    Ok((format!("mysql://root:@127.0.0.1:{port}/{db_name}"), port))
}

/// Ensure bd's managed Dolt server is running. Calls `bd dolt start` if the
/// server is absent or the port file is missing, then probes for readiness.
/// Returns the MySQL connection URL.
async fn ensure_bd_server(
    beads_dir: &Path,
    db_name: &str,
    metadata_port: Option<u16>,
    project_path: &str,
    bd_path: &str,
) -> Result<String, String> {
    // Fast path: port file exists and server is already healthy.
    if let Ok((url, port)) = server_url(beads_dir, db_name, metadata_port) {
        if matches!(recovery::probe_with_deadline(port).await, recovery::DoltHealth::Ok) {
            return Ok(url);
        }
    }
    // Server is absent or not responding — start it via bd.
    let runner = crate::bd::runner::BdRunner::new_with_override(project_path, bd_path)
        .map_err(|e| format!("bd not found, cannot start Dolt server: {e}"))?;
    runner.run(&["dolt", "start"]).await
        .map_err(|e| format!("bd dolt start failed: {e}"))?;
    // Give the server a moment to bind if bd dolt start returns before the port is open.
    tokio::time::sleep(std::time::Duration::from_millis(300)).await;
    // Re-read the fresh port file written by bd dolt start.
    let (url, port) = server_url(beads_dir, db_name, metadata_port)?;
    match recovery::probe_with_deadline(port).await {
        recovery::DoltHealth::Ok => Ok(url),
        other => Err(format!(
            "Dolt server not ready after `bd dolt start` (port {port}): {other:?}"
        )),
    }
}

#[tauri::command]
#[specta::specta]
pub async fn connect_project(
    project_path: String,
    app: AppHandle,
    registry: State<'_, Arc<ProjectRegistry>>,
    server_registry: State<'_, Arc<DoltServerRegistry>>,
    watcher_registry: State<'_, Arc<WatcherRegistry>>,
    settings: State<'_, Arc<Mutex<AppSettings>>>,
) -> Result<ProjectMeta, String> {
    let beads_dir_raw = Path::new(&project_path).join(".beads");
    // Canonicalize the .beads directory to resolve symlinks and relative segments.
    // This prevents path aliases from creating duplicate pools, watchers, or sidecars.
    let beads_dir = std::fs::canonicalize(&beads_dir_raw).map_err(|e| {
        format!(
            "invalid_project: cannot resolve .beads directory at {}: {e}",
            beads_dir_raw.display()
        )
    })?;
    // The canonical project root is the parent of the canonical .beads directory.
    let canonical_project_path = beads_dir
        .parent()
        .ok_or_else(|| "invalid_project: .beads directory has no parent".to_string())?
        .to_string_lossy()
        .into_owned();

    let meta = read_metadata(&beads_dir);
    let dolt_mode = meta
        .as_ref()
        .and_then(|m| m.dolt_mode.as_deref())
        .unwrap_or("server");
    let db_name = meta
        .as_ref()
        .and_then(|m| m.dolt_database.clone())
        .or_else(|| discover_db_name_fallback(&beads_dir))
        .ok_or("Cannot determine database name — no metadata.json or Dolt data directory found")?;

    let project_name = Path::new(&canonical_project_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(&canonical_project_path)
        .to_string();

    let bd_path = settings.lock().unwrap().binary_paths.bd.clone();
    let dolt_path_override = settings.lock().unwrap().binary_paths.dolt.clone();

    // Determine effective mode: if metadata says "server" but the database only
    // exists in embeddeddolt/ (bd dolt start uses dolt/ as its data dir), fall
    // back to embedded so we spawn from the correct directory.
    let effective_dolt_mode = if dolt_mode == "server"
        && !beads_dir.join("dolt").join(&db_name).is_dir()
        && beads_dir.join("embeddeddolt").join(&db_name).is_dir()
    {
        eprintln!("[project] server mode requested but db only in embeddeddolt/ — using embedded");
        "embedded"
    } else {
        dolt_mode
    };

    let database_url = if effective_dolt_mode == "embedded" {
        // Embedded mode: BeadSpec spawns its own Dolt sidecar from embeddeddolt/.
        // Write dolt-server.port so bd CLI commands can discover this sidecar.
        let embeddeddolt_dir = beads_dir.join("embeddeddolt");
        // Skip recovery when the sidecar is already registered by this session.
        // The guard's no_clients_connected check would escalate on our own open pool.
        if server_registry.get_port(&canonical_project_path).await.is_none() {
            recovery::guard(&canonical_project_path, &embeddeddolt_dir)
                .await
                .map_err(|e| format!("Dolt recovery failed: {e}"))?;
        }
        let port = server_registry
            .spawn_or_get(
                &canonical_project_path,
                &embeddeddolt_dir,
                &dolt_path_override,
            )
            .await?;
        let _ = std::fs::write(beads_dir.join("dolt-server.port"), port.to_string());
        format!("mysql://root:@127.0.0.1:{port}/{db_name}")
    } else {
        let metadata_port = meta.as_ref().and_then(|m| m.dolt_port);
        ensure_bd_server(
            &beads_dir,
            &db_name,
            metadata_port,
            &canonical_project_path,
            &bd_path,
        )
        .await?
    };

    let pool = registry
        .get_or_connect(&canonical_project_path, &database_url)
        .await
        .map_err(|e| format!("connection_failed:{e}"))?;

    let poll_handle = DoltPoller::new(pool, app.clone()).start();
    let watch_handle = JsonlWatcher::new(
        canonical_project_path.clone(),
        app.clone(),
        settings.inner().clone(),
    )
    .start();
    let openspec_watch_handle = OpenSpecWatcher::new(canonical_project_path.clone(), app).start();
    watcher_registry.register(
        canonical_project_path.clone(),
        poll_handle,
        watch_handle,
        openspec_watch_handle,
    );

    Ok(ProjectMeta {
        project_id: project_id_from_path(&canonical_project_path),
        project_path: canonical_project_path,
        name: project_name,
        prefix: db_name,
        compatible: true,
        schema_message: "Schema compatible".into(),
    })
}

#[tauri::command]
#[specta::specta]
pub async fn disconnect_project(
    project_path: String,
    registry: State<'_, Arc<ProjectRegistry>>,
    _server_registry: State<'_, Arc<DoltServerRegistry>>,
    watcher_registry: State<'_, Arc<WatcherRegistry>>,
) -> Result<(), String> {
    // Stop the poller and file watcher before closing the pool.
    watcher_registry.stop_project(&project_path);
    // Close the SQL pool so queries stop, but leave the dolt sidecar running.
    // Sidecars live for the app session and are killed together on exit via stop_all().
    // Killing and immediately respawning causes a lock conflict on the data dir.
    registry.close(&project_path).await;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn list_projects() -> Result<Vec<ProjectMeta>, String> {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
    let search_dirs = vec![
        format!("{home}/workspaces"),
        format!("{home}/Projects"),
        format!("{home}/projects"),
        format!("{home}/code"),
        format!("{home}/dev"),
    ];

    let mut projects = Vec::new();
    for dir in search_dirs {
        let dir_path = Path::new(&dir);
        if let Ok(entries) = std::fs::read_dir(dir_path) {
            for entry in entries.flatten() {
                let path = entry.path();
                let beads_dir = path.join(".beads");
                if beads_dir.is_dir() {
                    let project_path = path.to_string_lossy().to_string();
                    let name = path
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("unknown")
                        .to_string();

                    let meta = read_metadata(&beads_dir);
                    let prefix = meta
                        .as_ref()
                        .and_then(|m| m.dolt_database.clone())
                        .or_else(|| discover_db_name_fallback(&beads_dir))
                        .unwrap_or_default();

                    projects.push(ProjectMeta {
                        project_id: project_id_from_path(&project_path),
                        project_path,
                        name,
                        prefix,
                        compatible: false,
                        schema_message: "Not connected".into(),
                    });
                }
            }
        }
    }
    Ok(projects)
}
