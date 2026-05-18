use crate::commands::gitnexus_processes::{get_gitnexus_index_status, IndexStatus};
use crate::commands::gitnexus_processes::trigger_gitnexus_reanalyze;
use tauri::AppHandle;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct GitnexusStatus {
    pub available: bool,
    pub last_indexed_at: Option<String>,
    pub age_seconds: u32,
    pub stale: bool,
    pub message: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct GitnexusAnalyzeHandle {
    pub started: bool,
}

#[tauri::command]
#[specta::specta]
pub async fn get_gitnexus_status(project_path: String) -> Result<GitnexusStatus, String> {
    match get_gitnexus_index_status(project_path).await {
        Ok(IndexStatus { last_indexed_at, age_seconds, stale }) => Ok(GitnexusStatus {
            available: true,
            last_indexed_at,
            age_seconds,
            stale,
            message: if stale { "GitNexus index is stale" } else { "GitNexus index is fresh" }.into(),
        }),
        Err(e) => Ok(GitnexusStatus {
            available: false,
            last_indexed_at: None,
            age_seconds: 0,
            stale: false,
            message: e,
        }),
    }
}

#[tauri::command]
#[specta::specta]
pub async fn run_gitnexus_analyze(
    project_path: String,
    app: AppHandle,
) -> Result<GitnexusAnalyzeHandle, String> {
    trigger_gitnexus_reanalyze(project_path, app)
        .await
        .map(|h| GitnexusAnalyzeHandle { started: h.started })
}
