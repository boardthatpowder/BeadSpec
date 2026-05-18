use crate::bd::runner::spawn_managed;
use crate::db::pool::ProjectRegistry;
use serde_json::Value;
use sqlx::types::chrono::{DateTime, Utc};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::State;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type, PartialEq, Eq)]
pub enum GitnexusRisk {
    Low,
    Medium,
    High,
    Critical,
    Unknown,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct GitnexusCaller {
    pub name: String,
    pub location: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct GitnexusProcessGroup {
    pub process: String,
    pub callers: Vec<GitnexusCaller>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type, PartialEq, Eq)]
pub enum GitnexusIndexStatus {
    Fresh,
    Stale,
    Unknown,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct GitnexusImpactReport {
    pub symbol: String,
    pub risk: GitnexusRisk,
    pub upstream_by_process: Vec<GitnexusProcessGroup>,
    pub downstream: Vec<GitnexusCaller>,
    pub affected_processes: Vec<String>,
    pub index_status: GitnexusIndexStatus,
}

fn find_on_path(bin: &str) -> Option<PathBuf> {
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

fn risk_from_str(raw: &str) -> GitnexusRisk {
    match raw.to_ascii_lowercase().as_str() {
        "low" => GitnexusRisk::Low,
        "medium" => GitnexusRisk::Medium,
        "high" => GitnexusRisk::High,
        "critical" => GitnexusRisk::Critical,
        _ => GitnexusRisk::Unknown,
    }
}

fn string_field(v: &Value, names: &[&str]) -> Option<String> {
    names
        .iter()
        .find_map(|name| v.get(*name).and_then(Value::as_str).map(ToOwned::to_owned))
}

fn location_for(v: &Value) -> String {
    if let Some(loc) = string_field(v, &["location", "file", "filePath", "file_path"]) {
        let line = v.get("line").and_then(Value::as_i64).unwrap_or_default();
        return if line > 0 { format!("{loc}:{line}") } else { loc };
    }
    string_field(v, &["id", "uid"]).unwrap_or_default()
}

fn caller_from_value(v: &Value) -> Option<GitnexusCaller> {
    Some(GitnexusCaller {
        name: string_field(v, &["name", "symbol", "target"])?,
        location: location_for(v),
    })
}

fn parse_callers(arr: Option<&Value>) -> Vec<GitnexusCaller> {
    arr.and_then(Value::as_array)
        .map(|items| items.iter().filter_map(caller_from_value).collect())
        .unwrap_or_default()
}

pub(crate) fn parse_impact_json(
    symbol: &str,
    value: &Value,
    index_status: GitnexusIndexStatus,
) -> GitnexusImpactReport {
    let risk = value
        .get("risk")
        .and_then(|v| {
            v.as_str()
                .map(ToOwned::to_owned)
                .or_else(|| v.get("level").and_then(Value::as_str).map(ToOwned::to_owned))
        })
        .map(|s| risk_from_str(&s))
        .unwrap_or(GitnexusRisk::Unknown);

    let affected_processes = value
        .get("affected_processes")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|item| {
                    item.as_str()
                        .map(ToOwned::to_owned)
                        .or_else(|| string_field(item, &["name", "process"]))
                })
                .collect()
        })
        .unwrap_or_default();

    let upstream_by_process = value
        .get("upstream_by_process")
        .and_then(Value::as_array)
        .map(|groups| {
            groups
                .iter()
                .filter_map(|g| {
                    Some(GitnexusProcessGroup {
                        process: string_field(g, &["process", "name"])?,
                        callers: parse_callers(g.get("callers").or_else(|| g.get("symbols"))),
                    })
                })
                .collect::<Vec<_>>()
        })
        .filter(|v| !v.is_empty())
        .unwrap_or_else(|| {
            let callers = value
                .get("byDepth")
                .and_then(|d| d.get("1"))
                .map(|v| parse_callers(Some(v)))
                .unwrap_or_default();
            if callers.is_empty() {
                Vec::new()
            } else {
                vec![GitnexusProcessGroup {
                    process: "Direct callers".to_string(),
                    callers,
                }]
            }
        });

    let downstream = parse_callers(
        value
            .get("downstream")
            .or_else(|| value.get("callees"))
            .or_else(|| value.get("dependencies")),
    );

    GitnexusImpactReport {
        symbol: symbol.to_string(),
        risk,
        upstream_by_process,
        downstream,
        affected_processes,
        index_status,
    }
}

pub(crate) fn classify_gitnexus_error(stderr: &str) -> String {
    let lower = stderr.to_ascii_lowercase();
    if lower.contains("timed out") || lower.contains("timeout") {
        "Timeout: GitNexus impact timed out after 15 seconds".to_string()
    } else if lower.contains("symbol") && lower.contains("not found") {
        "SymbolNotFound: GitNexus could not resolve that symbol".to_string()
    } else if lower.contains("could not determine executable") || lower.contains("command not found") {
        "MissingCli: npx gitnexus is not available".to_string()
    } else if lower.contains("no index") || lower.contains("not indexed") {
        "NoIndex: GitNexus index not found; run npx gitnexus analyze".to_string()
    } else {
        format!("Other: {}", stderr.trim())
    }
}

pub(crate) async fn detect_index_status(project_path: &str) -> GitnexusIndexStatus {
    let cache = Path::new(project_path).join(".claude/cache");
    let newest_ack = std::fs::read_dir(cache)
        .ok()
        .into_iter()
        .flatten()
        .flatten()
        .filter_map(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            if name.starts_with("gitnexus-") && name.ends_with("-ack") {
                e.metadata().ok()?.modified().ok()
            } else {
                None
            }
        })
        .max();

    let cwd = Path::new(project_path);
    let args = ["-C", project_path, "log", "-1", "--format=%cI"];
    let head_time: Option<SystemTime> =
        match spawn_managed("git", &args, cwd, Duration::from_secs(5), &[]).await {
        Ok(out) if out.exit_code == Some(0) => {
            let raw = String::from_utf8_lossy(&out.stdout).trim().to_string();
            DateTime::parse_from_rfc3339(&raw)
                .ok()
                .and_then(|dt| {
                    let secs = dt.with_timezone(&Utc).timestamp();
                    (secs >= 0).then(|| UNIX_EPOCH + Duration::from_secs(secs as u64))
                })
        }
        _ => None,
    };

    match (newest_ack, head_time) {
        (Some(ack), Some(head)) => {
            if ack >= head {
                GitnexusIndexStatus::Fresh
            } else {
                GitnexusIndexStatus::Stale
            }
        }
        _ => GitnexusIndexStatus::Unknown,
    }
}

#[tauri::command]
#[specta::specta]
pub async fn run_gitnexus_impact(
    project_path: String,
    symbol: String,
    registry: State<'_, Arc<ProjectRegistry>>,
) -> Result<GitnexusImpactReport, String> {
    let _ = registry
        .get(&project_path)
        .await
        .map_err(|_| format!("project_not_connected: '{project_path}'"))?;

    let npx = find_on_path(if cfg!(windows) { "npx.cmd" } else { "npx" })
        .ok_or_else(|| "MissingCli: npx gitnexus is not available".to_string())?;
    let cwd = Path::new(&project_path);
    let out = spawn_managed(
        &npx.to_string_lossy(),
        &["gitnexus", "impact", "--target", &symbol, "--json"],
        cwd,
        Duration::from_secs(15),
        &[],
    )
    .await
    .map_err(|e| classify_gitnexus_error(&e.to_string()))?;

    if out.exit_code != Some(0) {
        return Err(classify_gitnexus_error(&String::from_utf8_lossy(&out.stderr)));
    }

    let json: Value = serde_json::from_slice(&out.stdout)
        .map_err(|e| format!("Other: failed to parse GitNexus impact JSON: {e}"))?;
    let index_status = detect_index_status(&project_path).await;
    Ok(parse_impact_json(&symbol, &json, index_status))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parser_handles_by_depth_callers() {
        let json = serde_json::json!({
            "risk": "HIGH",
            "affected_processes": [{"name": "Open task"}],
            "byDepth": {
                "1": [{"name": "Caller", "filePath": "src/a.ts", "line": 12}]
            }
        });
        let parsed = parse_impact_json("Target", &json, GitnexusIndexStatus::Stale);
        assert_eq!(parsed.risk, GitnexusRisk::High);
        assert_eq!(parsed.affected_processes, vec!["Open task"]);
        assert_eq!(parsed.upstream_by_process[0].callers[0].name, "Caller");
        assert_eq!(parsed.index_status, GitnexusIndexStatus::Stale);
    }

    #[test]
    fn error_classifier_is_explicit() {
        assert!(classify_gitnexus_error("command timed out").starts_with("Timeout"));
        assert!(classify_gitnexus_error("no index found").starts_with("NoIndex"));
        assert!(classify_gitnexus_error("symbol not found").starts_with("SymbolNotFound"));
    }
}
