use crate::commands::external::{
    derive_workspace_context, find_ruflo_with_override, run_ruflo_managed, WorkspaceContext,
};
use crate::settings::AppSettings;
use serde_json::Value;
use sqlx::types::chrono::{TimeZone, Utc};
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::State;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type, PartialEq, Eq)]
pub struct ValidationHistoryEntry {
    pub change_slug: String,
    pub valid: bool,
    pub errors: Vec<String>,
    pub ts_epoch: u32,
    pub ts_iso: String,
}

#[derive(Debug, serde::Deserialize)]
struct ValidationResultShape {
    valid: bool,
    errors: Vec<String>,
}

pub(crate) fn build_history_key(
    workspace: &WorkspaceContext,
    change_slug: &str,
    valid: bool,
    ts_ms: u128,
) -> String {
    format!(
        "{}|{}|{}|openspec:{}|type:validate-history|outcome:{}|ts:{}",
        workspace.label_branch,
        workspace.label_worktree,
        workspace.label_repo,
        change_slug,
        if valid { "pass" } else { "fail" },
        ts_ms
    )
}

pub(crate) fn history_value(
    change_slug: &str,
    valid: bool,
    errors: Vec<String>,
    ts_ms: u128,
) -> ValidationHistoryEntry {
    let ts_epoch = ((ts_ms / 1000).min(u32::MAX as u128)) as u32;
    let ts_iso = Utc
        .timestamp_millis_opt(ts_ms as i64)
        .single()
        .unwrap_or_else(Utc::now)
        .to_rfc3339();
    ValidationHistoryEntry { change_slug: change_slug.into(), valid, errors, ts_epoch, ts_iso }
}

fn ruflo(settings: &State<'_, Arc<Mutex<AppSettings>>>) -> Result<std::path::PathBuf, String> {
    let settings_path = settings.lock().unwrap().binary_paths.ruflo.clone();
    find_ruflo_with_override(&settings_path).ok_or_else(|| "ruflo CLI not found".to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn record_openspec_validation(
    project_path: String,
    change_slug: String,
    result_json: String,
    settings: State<'_, Arc<Mutex<AppSettings>>>,
) -> Result<(), String> {
    let parsed: ValidationResultShape =
        serde_json::from_str(&result_json).map_err(|e| format!("invalid validation result JSON: {e}"))?;
    let workspace = derive_workspace_context(&project_path).await?;
    let ts_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let key = build_history_key(&workspace, &change_slug, parsed.valid, ts_ms);
    let value = serde_json::to_string(&history_value(
        &change_slug,
        parsed.valid,
        parsed.errors,
        ts_ms,
    ))
    .map_err(|e| e.to_string())?;
    run_ruflo_managed(
        ruflo(&settings)?,
        &["memory", "store", "-k", &key, "-v", &value],
        Duration::from_secs(10),
    )
    .await
    .map(|_| ())
}

#[tauri::command]
#[specta::specta]
pub async fn list_openspec_validations(
    _project_path: String,
    change_slug: String,
    settings: State<'_, Arc<Mutex<AppSettings>>>,
) -> Result<Vec<ValidationHistoryEntry>, String> {
    let query = format!("openspec:{change_slug} type:validate-history");
    let stdout = run_ruflo_managed(
        ruflo(&settings)?,
        &["memory", "search", "-q", &query, "--format", "json"],
        Duration::from_secs(10),
    )
    .await?;
    Ok(filter_validation_history(&stdout, &change_slug))
}

pub(crate) fn filter_validation_history(raw: &str, change_slug: &str) -> Vec<ValidationHistoryEntry> {
    let Ok(json) = serde_json::from_str::<Value>(raw) else {
        return Vec::new();
    };
    let items = json
        .as_array()
        .cloned()
        .or_else(|| json.get("entries").and_then(Value::as_array).cloned())
        .or_else(|| json.get("results").and_then(Value::as_array).cloned())
        .unwrap_or_default();
    let needle_change = format!("|openspec:{change_slug}|");
    let mut entries: Vec<ValidationHistoryEntry> = items
        .iter()
        .filter_map(|item| {
            let key = item.get("key").and_then(Value::as_str)?;
            if !key.contains(&needle_change) || !key.contains("|type:validate-history|") {
                return None;
            }
            let value = item
                .get("value")
                .or_else(|| item.get("body"))
                .or_else(|| item.get("content"))
                .and_then(Value::as_str)?;
            let entry: ValidationHistoryEntry = serde_json::from_str(value).ok()?;
            (entry.change_slug == change_slug).then_some(entry)
        })
        .collect();
    entries.sort_by_key(|e| std::cmp::Reverse(e.ts_epoch));
    entries.truncate(50);
    entries
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ctx() -> WorkspaceContext {
        WorkspaceContext {
            branch: "feat/x".into(),
            label_branch: "branch:feat/x".into(),
            label_worktree: "worktree:wt".into(),
            label_repo: "repo:BeadSpec".into(),
        }
    }

    #[test]
    fn key_format_is_pipe_delimited() {
        assert_eq!(
            build_history_key(&ctx(), "change-a", true, 1234),
            "branch:feat/x|worktree:wt|repo:BeadSpec|openspec:change-a|type:validate-history|outcome:pass|ts:1234"
        );
    }

    #[test]
    fn history_value_uses_seconds_epoch() {
        let value = history_value("change", false, vec!["err".into()], 2000);
        assert_eq!(value.ts_epoch, 2);
        assert!(sqlx::types::chrono::DateTime::parse_from_rfc3339(&value.ts_iso).is_ok());
    }

    #[test]
    fn filter_skips_bad_entries() {
        let good = serde_json::to_string(&history_value("a", true, vec![], 1000)).unwrap();
        let raw = serde_json::json!([
            {"key":"x|openspec:a|type:validate-history|ts:1","value":good},
            {"key":"x|openspec:b|type:validate-history|ts:2","value":"{}"},
            {"key":"x|openspec:a|type:trajectory|ts:3","value":"{}"},
            {"key":"x|openspec:a|type:validate-history|ts:4","value":"not-json"}
        ])
        .to_string();
        assert_eq!(filter_validation_history(&raw, "a").len(), 1);
    }
}
