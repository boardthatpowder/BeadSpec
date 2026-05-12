use crate::bd::runner::{BdError, BdRunner};
use crate::settings::AppSettings;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
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

fn ipc_err(e: BdError) -> String {
    e.to_string()
}

fn make_runner(
    project_path: &str,
    settings: &State<'_, Arc<Mutex<AppSettings>>>,
) -> Result<BdRunner, String> {
    let bd_path = settings.lock().unwrap().binary_paths.bd.clone();
    BdRunner::new_with_override(project_path, &bd_path).map_err(ipc_err)
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
) -> Result<WriteResult, String> {
    let runner = make_runner(&project_path, &settings)?;
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
    runner
        .run(&arg_refs)
        .await
        .map(|output| WriteResult {
            optimistic_id: next_optimistic_id(),
            output,
        })
        .map_err(ipc_err)
}

#[tauri::command]
#[specta::specta]
pub async fn update_task_field(
    project_path: String,
    issue_id: String,
    field: String,
    value: String,
    settings: State<'_, Arc<Mutex<AppSettings>>>,
) -> Result<WriteResult, String> {
    let runner = make_runner(&project_path, &settings)?;
    let flag = format!("--{}={}", field, value);
    runner
        .run(&["update", &issue_id, &flag])
        .await
        .map(|output| WriteResult {
            optimistic_id: next_optimistic_id(),
            output,
        })
        .map_err(ipc_err)
}

#[tauri::command]
#[specta::specta]
pub async fn change_task_status(
    project_path: String,
    issue_id: String,
    status: String,
    force: bool,
    settings: State<'_, Arc<Mutex<AppSettings>>>,
) -> Result<WriteResult, String> {
    let runner = make_runner(&project_path, &settings)?;
    let run_result = match status.as_str() {
        "closed" => {
            let mut args: Vec<&str> = vec!["close", &issue_id];
            if force {
                args.push("--force");
            }
            runner.run(&args).await
        }
        "open" => runner.run(&["reopen", &issue_id]).await,
        _ => {
            runner
                .run(&["update", &issue_id, &format!("--status={}", status)])
                .await
        }
    };
    run_result
        .map(|output| WriteResult {
            optimistic_id: next_optimistic_id(),
            output,
        })
        .map_err(ipc_err)
}

#[tauri::command]
#[specta::specta]
pub async fn add_label(
    project_path: String,
    issue_id: String,
    label: String,
    settings: State<'_, Arc<Mutex<AppSettings>>>,
) -> Result<WriteResult, String> {
    let runner = make_runner(&project_path, &settings)?;
    runner
        .run(&["tag", &issue_id, &label])
        .await
        .map(|output| WriteResult {
            optimistic_id: next_optimistic_id(),
            output,
        })
        .map_err(ipc_err)
}

#[tauri::command]
#[specta::specta]
pub async fn remove_label(
    project_path: String,
    issue_id: String,
    label: String,
    settings: State<'_, Arc<Mutex<AppSettings>>>,
) -> Result<WriteResult, String> {
    let runner = make_runner(&project_path, &settings)?;
    runner
        .run(&["update", &issue_id, &format!("--remove-label={}", label)])
        .await
        .map(|output| WriteResult {
            optimistic_id: next_optimistic_id(),
            output,
        })
        .map_err(ipc_err)
}

#[tauri::command]
#[specta::specta]
pub async fn add_comment(
    project_path: String,
    issue_id: String,
    body: String,
    settings: State<'_, Arc<Mutex<AppSettings>>>,
) -> Result<WriteResult, String> {
    let runner = make_runner(&project_path, &settings)?;
    runner
        .run(&["comment", &issue_id, "--body", &body])
        .await
        .map(|output| WriteResult {
            optimistic_id: next_optimistic_id(),
            output,
        })
        .map_err(ipc_err)
}

#[tauri::command]
#[specta::specta]
pub async fn delete_task(
    project_path: String,
    issue_id: String,
    settings: State<'_, Arc<Mutex<AppSettings>>>,
) -> Result<WriteResult, String> {
    let runner = make_runner(&project_path, &settings)?;
    runner
        .run(&["delete", &issue_id, "--yes"])
        .await
        .map(|output| WriteResult {
            optimistic_id: next_optimistic_id(),
            output,
        })
        .map_err(ipc_err)
}

#[tauri::command]
#[specta::specta]
pub async fn link_dependency(
    project_path: String,
    blocked_id: String,
    blocking_id: String,
    settings: State<'_, Arc<Mutex<AppSettings>>>,
) -> Result<WriteResult, String> {
    let runner = make_runner(&project_path, &settings)?;
    runner
        .run(&["dep", "add", &blocked_id, &blocking_id])
        .await
        .map(|output| WriteResult {
            optimistic_id: next_optimistic_id(),
            output,
        })
        .map_err(ipc_err)
}

#[tauri::command]
#[specta::specta]
pub async fn unlink_dependency(
    project_path: String,
    blocked_id: String,
    blocking_id: String,
    settings: State<'_, Arc<Mutex<AppSettings>>>,
) -> Result<WriteResult, String> {
    let runner = make_runner(&project_path, &settings)?;
    runner
        .run(&["dep", "remove", &blocked_id, &blocking_id])
        .await
        .map(|output| WriteResult {
            optimistic_id: next_optimistic_id(),
            output,
        })
        .map_err(ipc_err)
}
