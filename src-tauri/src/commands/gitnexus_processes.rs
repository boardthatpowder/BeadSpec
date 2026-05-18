use crate::bd::runner::spawn_managed;
use crate::db::pool::ProjectRegistry;
use serde_json::Value;
use sqlx::Row;
use std::collections::{BTreeMap, HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, State};
use crate::events::activity::{emit_event, ActivityEvent};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct ProcessSummary {
    pub name: String,
    pub cluster: String,
    pub step_count: u32,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct ProcessStep {
    pub symbol: String,
    pub file: String,
    pub line: u32,
    pub snippet: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct ProcessDetail {
    pub name: String,
    pub cluster: String,
    pub steps: Vec<ProcessStep>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct Cluster {
    pub name: String,
    pub process_count: u32,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct IssueMatch {
    pub id: String,
    pub title: String,
    pub overlap_count: u32,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct IndexStatus {
    pub last_indexed_at: Option<String>,
    pub age_seconds: u32,
    pub stale: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct ReanalyzeHandle {
    pub started: bool,
}

#[derive(Debug, Clone, serde::Serialize)]
struct ReanalyzeProgress {
    stage: String,
    message: String,
}

static CACHE: OnceLock<Mutex<HashMap<String, (Instant, Value)>>> = OnceLock::new();

fn find_npx() -> Option<PathBuf> {
    let bin = if cfg!(windows) { "npx.cmd" } else { "npx" };
    std::env::var_os("PATH").and_then(|path_var| {
        std::env::split_paths(&path_var).find_map(|dir| {
            let candidate = dir.join(bin);
            if candidate.is_file() {
                Some(candidate)
            } else {
                None
            }
        })
    })
}

pub(crate) async fn gitnexus_cli_json(
    project_path: &str,
    args: &[&str],
    ttl_secs: u64,
) -> Result<Value, String> {
    let key = format!("{}::{:?}", project_path, args);
    let cache = CACHE.get_or_init(|| Mutex::new(HashMap::new()));
    if ttl_secs > 0 {
        if let Some((created, value)) = cache.lock().unwrap().get(&key) {
            if created.elapsed() <= Duration::from_secs(ttl_secs) {
                return Ok(value.clone());
            }
        }
    }

    let npx = find_npx().ok_or_else(|| "gitnexus_cli_unavailable: npx not found".to_string())?;
    let mut full_args = vec!["gitnexus"];
    full_args.extend_from_slice(args);
    let out = spawn_managed(
        &npx.to_string_lossy(),
        &full_args,
        Path::new(project_path),
        Duration::from_secs(15),
        &[],
    )
    .await
    .map_err(|e| format!("gitnexus_spawn_failed: {e}"))?;
    if out.exit_code != Some(0) {
        return Err(format!(
            "gitnexus_nonzero: {}",
            String::from_utf8_lossy(&out.stderr).trim()
        ));
    }
    let parsed: Value = serde_json::from_slice(&out.stdout).map_err(|e| {
        let raw = String::from_utf8_lossy(&out.stdout);
        format!("gitnexus_json_parse_failed: {e}; stdout_prefix={}", &raw.chars().take(120).collect::<String>())
    })?;
    if ttl_secs > 0 {
        cache.lock().unwrap().insert(key, (Instant::now(), parsed.clone()));
    }
    Ok(parsed)
}

fn val_str(v: &Value, names: &[&str]) -> Option<String> {
    names
        .iter()
        .find_map(|name| v.get(*name).and_then(Value::as_str).map(ToOwned::to_owned))
}

fn parse_step(value: &Value) -> Option<ProcessStep> {
    Some(ProcessStep {
        symbol: val_str(value, &["symbol", "name"])?,
        file: val_str(value, &["file", "filePath", "file_path"]).unwrap_or_default(),
        line: value.get("line").and_then(Value::as_u64).unwrap_or(0) as u32,
        snippet: val_str(value, &["snippet", "signature", "content"]),
    })
}

fn process_items(value: &Value) -> Vec<Value> {
    if let Some(arr) = value.as_array() {
        return arr.clone();
    }
    value
        .get("processes")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
}

pub(crate) fn parse_process_summaries(value: &Value) -> Vec<ProcessSummary> {
    process_items(value)
        .iter()
        .filter_map(|item| {
            let steps_len = item
                .get("steps")
                .and_then(Value::as_array)
                .map(|a| a.len() as u32)
                .unwrap_or(0);
            Some(ProcessSummary {
                name: val_str(item, &["name", "process"])?,
                cluster: val_str(item, &["cluster", "module"]).unwrap_or_else(|| "Unclustered".into()),
                step_count: item
                    .get("step_count")
                    .or_else(|| item.get("stepCount"))
                    .and_then(Value::as_u64)
                    .unwrap_or(steps_len as u64) as u32,
            })
        })
        .collect()
}

pub(crate) fn parse_process_detail(value: &Value, fallback_name: &str) -> ProcessDetail {
    let process = value.get("process").unwrap_or(value);
    let steps = process
        .get("steps")
        .and_then(Value::as_array)
        .map(|items| items.iter().filter_map(parse_step).collect())
        .unwrap_or_default();
    ProcessDetail {
        name: val_str(process, &["name", "process"]).unwrap_or_else(|| fallback_name.to_string()),
        cluster: val_str(process, &["cluster", "module"]).unwrap_or_else(|| "Unclustered".into()),
        steps,
    }
}

#[tauri::command]
#[specta::specta]
pub async fn list_gitnexus_processes(project_path: String) -> Result<Vec<ProcessSummary>, String> {
    gitnexus_cli_json(&project_path, &["processes", "--json"], 60)
        .await
        .map(|v| parse_process_summaries(&v))
}

#[tauri::command]
#[specta::specta]
pub async fn get_gitnexus_process(
    project_path: String,
    name: String,
) -> Result<ProcessDetail, String> {
    gitnexus_cli_json(&project_path, &["process", &name, "--json"], 60)
        .await
        .map(|v| parse_process_detail(&v, &name))
}

#[tauri::command]
#[specta::specta]
pub async fn list_gitnexus_clusters(project_path: String) -> Result<Vec<Cluster>, String> {
    let value = gitnexus_cli_json(&project_path, &["clusters", "--json"], 60).await;
    if let Ok(value) = value {
        let items = value
            .as_array()
            .or_else(|| value.get("clusters").and_then(Value::as_array))
            .cloned()
            .unwrap_or_default();
        let clusters: Vec<Cluster> = items
            .iter()
            .filter_map(|item| {
                Some(Cluster {
                    name: val_str(item, &["name", "cluster"])?,
                    process_count: item
                        .get("process_count")
                        .or_else(|| item.get("processCount"))
                        .and_then(Value::as_u64)
                        .unwrap_or(0) as u32,
                })
            })
            .collect();
        if !clusters.is_empty() {
            return Ok(clusters);
        }
    }
    let processes = list_gitnexus_processes(project_path).await?;
    Ok(clusters_from_processes(&processes))
}

pub(crate) fn clusters_from_processes(processes: &[ProcessSummary]) -> Vec<Cluster> {
    let mut counts: BTreeMap<String, u32> = BTreeMap::new();
    for p in processes {
        *counts.entry(p.cluster.clone()).or_default() += 1;
    }
    counts
        .into_iter()
        .map(|(name, process_count)| Cluster { name, process_count })
        .collect()
}

#[tauri::command]
#[specta::specta]
pub async fn find_issues_touching_process(
    project_path: String,
    process_name: String,
    registry: State<'_, Arc<ProjectRegistry>>,
) -> Result<Vec<IssueMatch>, String> {
    let detail = get_gitnexus_process(project_path.clone(), process_name).await?;
    let process_files: HashSet<String> = detail.steps.into_iter().map(|s| s.file).collect();
    if process_files.is_empty() {
        return Ok(vec![]);
    }
    let pool = registry
        .get(&project_path)
        .await
        .map_err(|_| format!("project_not_connected: '{project_path}'"))?;
    let rows = sqlx::query(
        "SELECT DISTINCT i.id, i.title \
         FROM issues i JOIN labels l ON l.issue_id = i.id \
         WHERE i.status != 'deleted' AND l.label LIKE 'branch:%' LIMIT 200",
    )
    .fetch_all(pool.pool())
    .await
    .map_err(|e| format!("Query failed: {e}"))?;

    let mut matches = Vec::new();
    for row in rows {
        let id: String = row.try_get("id").unwrap_or_default();
        let title: String = row.try_get("title").unwrap_or_default();
        let files = files_for_issue(&project_path, &id).await;
        let overlap = files.intersection(&process_files).count() as u32;
        if overlap > 0 {
            matches.push(IssueMatch { id, title, overlap_count: overlap });
        }
    }
    matches.sort_by_key(|m| std::cmp::Reverse(m.overlap_count));
    matches.truncate(20);
    Ok(matches)
}

async fn files_for_issue(project_path: &str, issue_id: &str) -> HashSet<String> {
    let cwd = Path::new(project_path);
    let grep_arg = format!("--grep={issue_id}");
    let log_args = [
        "-C",
        project_path,
        "log",
        "--all",
        "--format=%H",
        &grep_arg,
        "-n",
        "20",
    ];
    let Ok(out) = spawn_managed("git", &log_args, cwd, Duration::from_secs(10), &[]).await else {
        return HashSet::new();
    };
    if out.exit_code != Some(0) {
        return HashSet::new();
    }
    let mut files = HashSet::new();
    for hash in String::from_utf8_lossy(&out.stdout).lines().filter(|l| !l.trim().is_empty()) {
        let show_args = ["-C", project_path, "show", "--format=", "--name-only", hash.trim()];
        if let Ok(show) = spawn_managed("git", &show_args, cwd, Duration::from_secs(10), &[]).await {
            if show.exit_code == Some(0) {
                files.extend(
                    String::from_utf8_lossy(&show.stdout)
                        .lines()
                        .map(str::trim)
                        .filter(|s| !s.is_empty())
                        .map(ToOwned::to_owned),
                );
            }
        }
    }
    files
}

#[tauri::command]
#[specta::specta]
pub async fn get_gitnexus_index_status(project_path: String) -> Result<IndexStatus, String> {
    let value = gitnexus_cli_json(&project_path, &["list", "--json"], 60).await.ok();
    let last_indexed_at = value.as_ref().and_then(find_last_indexed_at);
    let age_seconds = last_indexed_at
        .as_ref()
        .and_then(|s| parse_ts_age_seconds(s))
        .unwrap_or_else(cache_age_seconds);
    Ok(IndexStatus {
        last_indexed_at,
        age_seconds,
        stale: age_seconds > 14_400,
    })
}

fn find_last_indexed_at(value: &Value) -> Option<String> {
    let repos = value.as_array().or_else(|| value.get("repos").and_then(Value::as_array))?;
    repos.iter().find_map(|repo| {
        val_str(
            repo,
            &["indexed_at", "indexedAt", "last_indexed_at", "lastIndexedAt", "updated_at"],
        )
    })
}

fn parse_ts_age_seconds(ts: &str) -> Option<u32> {
    if let Ok(epoch) = ts.parse::<u64>() {
        let now = SystemTime::now().duration_since(UNIX_EPOCH).ok()?.as_secs();
        return Some(now.saturating_sub(epoch).min(u32::MAX as u64) as u32);
    }
    let parsed = sqlx::types::chrono::DateTime::parse_from_rfc3339(ts).ok()?;
    let now = sqlx::types::chrono::Utc::now();
    Some((now - parsed.with_timezone(&sqlx::types::chrono::Utc)).num_seconds().max(0).min(u32::MAX as i64) as u32)
}

fn cache_age_seconds() -> u32 {
    0
}

#[tauri::command]
#[specta::specta]
pub async fn trigger_gitnexus_reanalyze(
    project_path: String,
    app: AppHandle,
) -> Result<ReanalyzeHandle, String> {
    let npx = find_npx().ok_or_else(|| "gitnexus_cli_unavailable: npx not found".to_string())?;
    let cwd = project_path.clone();
    app.emit(
        "gitnexus_reanalyze_progress",
        ReanalyzeProgress { stage: "started".into(), message: "GitNexus analyze started".into() },
    )
    .ok();
    emit_event(
        &app,
        ActivityEvent {
            id: format!("gitnexus.analyze.started:{}", sqlx::types::chrono::Utc::now().timestamp_millis()),
            ts: sqlx::types::chrono::Utc::now().to_rfc3339(),
            kind: "gitnexus.analyze_started".into(),
            source: "gitnexus".into(),
            summary: "GitNexus analyze started".into(),
            detail: serde_json::json!({}).to_string(),
            correlation_id: None,
        },
    );
    tokio::spawn(async move {
        let _ = app.emit(
            "gitnexus_reanalyze_progress",
            ReanalyzeProgress { stage: "running".into(), message: "Indexing repository".into() },
        );
        let result = spawn_managed(
            &npx.to_string_lossy(),
            &["gitnexus", "analyze"],
            Path::new(&cwd),
            Duration::from_secs(300),
            &[],
        )
        .await;
        let payload = match result {
            Ok(out) if out.exit_code == Some(0) => ReanalyzeProgress {
                stage: "finished".into(),
                message: "GitNexus analyze finished".into(),
            },
            Ok(out) => ReanalyzeProgress {
                stage: "error".into(),
                message: String::from_utf8_lossy(&out.stderr).trim().to_string(),
            },
            Err(e) => ReanalyzeProgress { stage: "error".into(), message: e.to_string() },
        };
        emit_event(
            &app,
            ActivityEvent {
                id: format!("gitnexus.analyze.{}:{}", payload.stage, sqlx::types::chrono::Utc::now().timestamp_millis()),
                ts: sqlx::types::chrono::Utc::now().to_rfc3339(),
                kind: if payload.stage == "finished" { "gitnexus.index_refreshed" } else { "gitnexus.analyze_error" }.into(),
                source: "gitnexus".into(),
                summary: payload.message.clone(),
                detail: serde_json::json!({}).to_string(),
                correlation_id: None,
            },
        );
        let _ = app.emit("gitnexus_reanalyze_progress", payload);
    });
    Ok(ReanalyzeHandle { started: true })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_processes_tolerates_empty() {
        assert!(parse_process_summaries(&serde_json::json!({})).is_empty());
    }

    #[test]
    fn cluster_counts_are_sorted() {
        let clusters = clusters_from_processes(&[
            ProcessSummary { name: "b".into(), cluster: "z".into(), step_count: 1 },
            ProcessSummary { name: "a".into(), cluster: "a".into(), step_count: 1 },
            ProcessSummary { name: "c".into(), cluster: "z".into(), step_count: 1 },
        ]);
        assert_eq!(clusters[0].name, "a");
        assert_eq!(clusters[1].process_count, 2);
    }

    #[test]
    fn stale_threshold() {
        let status = IndexStatus {
            last_indexed_at: Some("0".into()),
            age_seconds: 14_401,
            stale: 14_401 > 14_400,
        };
        assert!(status.stale);
    }
}
