use crate::bd::runner::{find_bd, invoke_bd_in_project};
use crate::db::dolt_server::DoltServerRegistry;
use crate::settings::AppSettings;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::State;

static OPTIMISTIC_COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_optimistic_id() -> String {
    format!("opt-{}", OPTIMISTIC_COUNTER.fetch_add(1, Ordering::Relaxed))
}

/// Returned by write commands. The frontend uses this to track pending mutations
/// and roll back the optimistic update if the command fails.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, specta::Type)]
pub struct WriteResult {
    pub optimistic_id: String,
    pub output: String,
}

/// 30-second timeout for all write operations (matches the historical
/// `classify_bd_timeout` behavior for write subcommands).
const WRITE_TIMEOUT: Duration = Duration::from_secs(30);

fn resolve_bd_and_overrides(
    settings: &State<'_, Arc<Mutex<AppSettings>>>,
) -> Result<(std::path::PathBuf, String), String> {
    let guard = settings.lock().unwrap();
    let bd_path_override = guard.binary_paths.bd.clone();
    let dolt_path_override = guard.binary_paths.dolt.clone();
    drop(guard);
    let bd = find_bd(&bd_path_override).ok_or_else(|| "bd CLI not found".to_string())?;
    Ok((bd, dolt_path_override))
}

async fn run_write(
    project_path: &str,
    args: &[&str],
    settings: &State<'_, Arc<Mutex<AppSettings>>>,
    server_registry: &State<'_, Arc<DoltServerRegistry>>,
) -> Result<WriteResult, String> {
    let (bd, dolt_override) = resolve_bd_and_overrides(settings)?;
    let output = invoke_bd_in_project(
        &bd,
        args,
        project_path,
        server_registry,
        &dolt_override,
        WRITE_TIMEOUT,
    )
    .await?;
    Ok(WriteResult {
        optimistic_id: next_optimistic_id(),
        output,
    })
}

#[tauri::command]
#[specta::specta]
pub async fn create_task(
    project_path: String,
    title: String,
    description: Option<String>,
    priority: Option<u8>,
    task_type: Option<String>,
    settings: State<'_, Arc<Mutex<AppSettings>>>,
    server_registry: State<'_, Arc<DoltServerRegistry>>,
) -> Result<WriteResult, String> {
    let mut args: Vec<String> = vec!["create".into(), format!("--title={}", title)];
    if let Some(desc) = description {
        args.push(format!("--description={}", desc));
    }
    if let Some(p) = priority {
        args.push(format!("--priority={}", p));
    }
    if let Some(t) = task_type {
        args.push(format!("--type={}", t));
    }
    let arg_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    run_write(&project_path, &arg_refs, &settings, &server_registry).await
}

#[tauri::command]
#[specta::specta]
pub async fn update_task_field(
    project_path: String,
    issue_id: String,
    field: String,
    value: String,
    settings: State<'_, Arc<Mutex<AppSettings>>>,
    server_registry: State<'_, Arc<DoltServerRegistry>>,
) -> Result<WriteResult, String> {
    let flag = format!("--{}={}", field, value);
    run_write(
        &project_path,
        &["update", &issue_id, &flag],
        &settings,
        &server_registry,
    )
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn change_task_status(
    project_path: String,
    issue_id: String,
    status: String,
    force: bool,
    settings: State<'_, Arc<Mutex<AppSettings>>>,
    server_registry: State<'_, Arc<DoltServerRegistry>>,
) -> Result<WriteResult, String> {
    match status.as_str() {
        "closed" => {
            let mut args: Vec<&str> = vec!["close", &issue_id];
            if force {
                args.push("--force");
            }
            run_write(&project_path, &args, &settings, &server_registry).await
        }
        "open" => run_write(&project_path, &["reopen", &issue_id], &settings, &server_registry).await,
        _ => {
            let flag = format!("--status={}", status);
            run_write(
                &project_path,
                &["update", &issue_id, &flag],
                &settings,
                &server_registry,
            )
            .await
        }
    }
}

#[tauri::command]
#[specta::specta]
pub async fn add_label(
    project_path: String,
    issue_id: String,
    label: String,
    settings: State<'_, Arc<Mutex<AppSettings>>>,
    server_registry: State<'_, Arc<DoltServerRegistry>>,
) -> Result<WriteResult, String> {
    run_write(
        &project_path,
        &["tag", &issue_id, &label],
        &settings,
        &server_registry,
    )
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn remove_label(
    project_path: String,
    issue_id: String,
    label: String,
    settings: State<'_, Arc<Mutex<AppSettings>>>,
    server_registry: State<'_, Arc<DoltServerRegistry>>,
) -> Result<WriteResult, String> {
    let flag = format!("--remove-label={}", label);
    run_write(
        &project_path,
        &["update", &issue_id, &flag],
        &settings,
        &server_registry,
    )
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn add_comment(
    project_path: String,
    issue_id: String,
    body: String,
    settings: State<'_, Arc<Mutex<AppSettings>>>,
    server_registry: State<'_, Arc<DoltServerRegistry>>,
) -> Result<WriteResult, String> {
    run_write(
        &project_path,
        &["comment", &issue_id, "--body", &body],
        &settings,
        &server_registry,
    )
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn delete_task(
    project_path: String,
    issue_id: String,
    settings: State<'_, Arc<Mutex<AppSettings>>>,
    server_registry: State<'_, Arc<DoltServerRegistry>>,
) -> Result<WriteResult, String> {
    run_write(
        &project_path,
        &["delete", &issue_id, "--yes"],
        &settings,
        &server_registry,
    )
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn link_dependency(
    project_path: String,
    blocked_id: String,
    blocking_id: String,
    settings: State<'_, Arc<Mutex<AppSettings>>>,
    server_registry: State<'_, Arc<DoltServerRegistry>>,
) -> Result<WriteResult, String> {
    run_write(
        &project_path,
        &["dep", "add", &blocked_id, &blocking_id],
        &settings,
        &server_registry,
    )
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn unlink_dependency(
    project_path: String,
    blocked_id: String,
    blocking_id: String,
    settings: State<'_, Arc<Mutex<AppSettings>>>,
    server_registry: State<'_, Arc<DoltServerRegistry>>,
) -> Result<WriteResult, String> {
    run_write(
        &project_path,
        &["dep", "remove", &blocked_id, &blocking_id],
        &settings,
        &server_registry,
    )
    .await
}
