use crate::commands::external::{find_ruflo_with_override, run_ruflo_managed};
use crate::settings::AppSettings;
use serde_json::Value;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::State;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct MemoryEntry {
    pub key: String,
    pub score: f32,
    pub namespace: String,
    pub preview: String,
    pub body: String,
    pub ts: Option<f64>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct MemoryListResponse {
    pub entries: Vec<MemoryEntry>,
    pub total: u32,
}

pub(crate) fn is_valid_memory_key(key: &str) -> bool {
    !key.is_empty()
        && key.len() <= 1024
        && key
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b':' | b'|' | b'=' | b'.' | b'_' | b'/' | b'-'))
}

pub(crate) fn is_valid_memory_value(value: &str) -> bool {
    !value.is_empty() && value.len() <= 65_536
}

pub(crate) fn list_args(prefix: Option<&str>, limit: Option<u32>) -> Vec<String> {
    let mut args = vec!["memory".into(), "list".into(), "--format".into(), "json".into()];
    if let Some(prefix) = prefix.filter(|p| !p.is_empty()) {
        args.push("--prefix".into());
        args.push(prefix.to_string());
    }
    args.push("--limit".into());
    args.push(limit.unwrap_or(500).to_string());
    args
}

fn parse_ts(key: &str) -> Option<f64> {
    key.split('|')
        .find_map(|part| part.strip_prefix("ts:")?.parse::<f64>().ok())
}

fn namespace_for(key: &str) -> String {
    key.split('|').next().unwrap_or(key).to_string()
}

fn preview_for(body: &str) -> String {
    body.chars().take(160).collect()
}

pub(crate) fn parse_memory_list(raw: &str) -> Result<MemoryListResponse, String> {
    let json: Value = serde_json::from_str(raw).map_err(|e| format!("memory list JSON parse failed: {e}"))?;
    let items = json
        .as_array()
        .cloned()
        .or_else(|| json.get("entries").and_then(Value::as_array).cloned())
        .or_else(|| json.get("results").and_then(Value::as_array).cloned())
        .unwrap_or_default();
    let entries: Vec<MemoryEntry> = items
        .iter()
        .filter_map(|item| {
            let key = item.get("key").and_then(Value::as_str)?.to_string();
            let body = item
                .get("value")
                .or_else(|| item.get("body"))
                .or_else(|| item.get("content"))
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string();
            Some(MemoryEntry {
                namespace: namespace_for(&key),
                preview: item
                    .get("preview")
                    .and_then(Value::as_str)
                    .map(ToOwned::to_owned)
                    .unwrap_or_else(|| preview_for(&body)),
                score: item.get("score").and_then(Value::as_f64).unwrap_or(0.0) as f32,
                ts: item.get("ts").and_then(Value::as_f64).or_else(|| parse_ts(&key)),
                key,
                body,
            })
        })
        .collect();
    Ok(MemoryListResponse { total: entries.len() as u32, entries })
}

fn ruflo_from_settings(settings: &State<'_, Arc<Mutex<AppSettings>>>) -> Result<std::path::PathBuf, String> {
    let settings_path = settings.lock().unwrap().binary_paths.ruflo.clone();
    find_ruflo_with_override(&settings_path).ok_or_else(|| "ruflo CLI not found".to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn ruflo_memory_list(
    namespace_prefix: Option<String>,
    limit: Option<u32>,
    settings: State<'_, Arc<Mutex<AppSettings>>>,
) -> Result<MemoryListResponse, String> {
    let ruflo = ruflo_from_settings(&settings)?;
    let args = list_args(namespace_prefix.as_deref(), limit);
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let stdout = run_ruflo_managed(ruflo, &refs, Duration::from_secs(10)).await?;
    parse_memory_list(&stdout)
}

#[tauri::command]
#[specta::specta]
pub async fn ruflo_memory_store(
    key: String,
    value: String,
    settings: State<'_, Arc<Mutex<AppSettings>>>,
) -> Result<(), String> {
    if !is_valid_memory_key(&key) {
        return Err("invalid memory key".into());
    }
    if !is_valid_memory_value(&value) {
        return Err("invalid memory value".into());
    }
    let ruflo = ruflo_from_settings(&settings)?;
    run_ruflo_managed(
        ruflo,
        &["memory", "store", "-k", &key, "-v", &value],
        Duration::from_secs(10),
    )
    .await
    .map(|_| ())
}

#[tauri::command]
#[specta::specta]
pub async fn ruflo_memory_delete(
    key: String,
    settings: State<'_, Arc<Mutex<AppSettings>>>,
) -> Result<(), String> {
    if !is_valid_memory_key(&key) {
        return Err("invalid memory key".into());
    }
    let ruflo = ruflo_from_settings(&settings)?;
    run_ruflo_managed(ruflo, &["memory", "delete", "-k", &key], Duration::from_secs(10))
        .await
        .map(|_| ())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn memory_key_validator_rejects_shell_chars() {
        assert!(is_valid_memory_key("branch:foo|repo:bar|type:note"));
        assert!(is_valid_memory_key("openspec:abc-def|issue:BEADSPEC-xqf|type:trajectory|ts:1700000000"));
        for bad in ["", "a b", "a;b", "$x", "`x`", "x\ny"] {
            assert!(!is_valid_memory_key(bad), "{bad}");
        }
    }

    #[test]
    fn memory_value_validator_enforces_size() {
        assert!(is_valid_memory_value("body"));
        assert!(is_valid_memory_value(&"x".repeat(65_536)));
        assert!(!is_valid_memory_value(""));
        assert!(!is_valid_memory_value(&"x".repeat(65_537)));
    }

    #[test]
    fn list_argv_is_exact() {
        assert_eq!(
            list_args(Some("branch:foo"), Some(250)),
            vec!["memory", "list", "--format", "json", "--prefix", "branch:foo", "--limit", "250"]
        );
        assert_eq!(
            list_args(None, None),
            vec!["memory", "list", "--format", "json", "--limit", "500"]
        );
    }
}
