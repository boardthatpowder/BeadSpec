use crate::bd::api::ProjectBackendStatus;
use crate::db::dolt_server::DoltServerRegistry;
use crate::db::poller::BeadsSync;
use crate::db::pool::ProjectRegistry;
use crate::db::watchers::{OpenSpecWatcher, WatcherRegistry};
use crate::settings::AppSettings;
use sha2::{Digest, Sha256};
use std::path::Path;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};

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
    hash[..8].iter().map(|b| format!("{b:02x}")).collect()
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
        assert_ne!(
            id1, id2,
            "different paths should have different project IDs"
        );
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
pub(crate) struct BeadsMetadata {
    pub(crate) dolt_database: Option<String>,
}

pub(crate) fn read_metadata(beads_dir: &Path) -> Option<BeadsMetadata> {
    let content = std::fs::read_to_string(beads_dir.join("metadata.json")).ok()?;
    serde_json::from_str(&content).ok()
}

/// Resolve the Beads database name for an already-canonicalised project path.
/// Prefers `metadata.json`'s `dolt_database` field; falls back to enumerating
/// the data directory only when the metadata file is missing.
pub(crate) fn resolve_db_name(project_path: &str) -> Option<String> {
    let beads_dir = Path::new(project_path).join(".beads");
    read_metadata(&beads_dir)
        .and_then(|m| m.dolt_database)
        .or_else(|| discover_db_name_fallback(&beads_dir))
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

#[tauri::command]
#[specta::specta]
pub async fn connect_project(
    project_path: String,
    app: AppHandle,
    registry: State<'_, Arc<ProjectRegistry>>,
    _server_registry: State<'_, Arc<DoltServerRegistry>>,
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

    let gate = watcher_registry.lifecycle_gate(&canonical_project_path);
    let _lifecycle = gate.lock().await;
    let project_name = Path::new(&canonical_project_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(&canonical_project_path)
        .to_string();
    let (bd_path, actor) = {
        let settings = settings.lock().map_err(|_| "Settings unavailable")?;
        (settings.binary_paths.bd.clone(), settings.actor.clone())
    };
    let source = registry
        .get_or_connect(&canonical_project_path, &bd_path, &actor)
        .await?;
    let prefix = resolve_db_name(&canonical_project_path).unwrap_or_default();
    let poll_handle = BeadsSync::new(source, app.clone()).start();
    let openspec_watch_handle =
        OpenSpecWatcher::new(canonical_project_path.clone(), app.clone()).start();
    watcher_registry.register(
        canonical_project_path.clone(),
        poll_handle,
        openspec_watch_handle,
    );
    Ok(ProjectMeta {
        project_id: project_id_from_path(&canonical_project_path),
        project_path: canonical_project_path,
        name: project_name,
        prefix,
        compatible: true,
        schema_message: "Beads backend compatible".into(),
    })
}

/// Drop any half-spawned sidecar registration and re-run `connect_project`.
/// Used by the recovery dialog's "Retry" button after a spawn failure: the
/// previous attempt may have left a partially-initialised entry that would
/// otherwise short-circuit `spawn_or_get`.
#[tauri::command]
#[specta::specta]
pub async fn retry_connect_project(
    project_path: String,
    app: AppHandle,
    registry: State<'_, Arc<ProjectRegistry>>,
    server_registry: State<'_, Arc<DoltServerRegistry>>,
    watcher_registry: State<'_, Arc<WatcherRegistry>>,
    settings: State<'_, Arc<Mutex<AppSettings>>>,
) -> Result<ProjectMeta, String> {
    {
        let gate = watcher_registry.lifecycle_gate(&project_path);
        let _lifecycle = gate.lock().await;
        watcher_registry.stop_project(&project_path);
        registry.close(&project_path).await;
        server_registry.invalidate(&project_path).await;
    }
    connect_project(
        project_path,
        app,
        registry,
        server_registry,
        watcher_registry,
        settings,
    )
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn disconnect_project(
    project_path: String,
    registry: State<'_, Arc<ProjectRegistry>>,
    _server_registry: State<'_, Arc<DoltServerRegistry>>,
    watcher_registry: State<'_, Arc<WatcherRegistry>>,
) -> Result<(), String> {
    let gate = watcher_registry.lifecycle_gate(&project_path);
    let _lifecycle = gate.lock().await;
    watcher_registry.stop_project(&project_path);
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

#[tauri::command]
#[specta::specta]
pub async fn get_project_backend_status(
    project_path: String,
    registry: State<'_, Arc<ProjectRegistry>>,
) -> Result<ProjectBackendStatus, String> {
    Ok(registry.get(&project_path).await?.status().await)
}
#[tauri::command]
#[specta::specta]
pub async fn enable_project_journal(
    project_path: String,
    app: AppHandle,
    registry: State<'_, Arc<ProjectRegistry>>,
    watcher_registry: State<'_, Arc<WatcherRegistry>>,
) -> Result<ProjectBackendStatus, String> {
    let gate = watcher_registry.lifecycle_gate(&project_path);
    let _lifecycle = gate.lock().await;
    watcher_registry.stop_project(&project_path);
    let source = registry.get(&project_path).await?;
    let result = source.enable_journal().await;
    if registry.get(&project_path).await.is_err() {
        return Err("Project disconnected while enabling live updates".into());
    }
    let project_path = source.project_path.clone();
    let poll = BeadsSync::new(source, app.clone()).start();
    watcher_registry.register(
        project_path.clone(),
        poll,
        OpenSpecWatcher::new(project_path, app.clone()).start(),
    );
    if let Ok(status) = &result {
        app.emit("project_backend_status_changed", status).ok();
    }
    result
}
