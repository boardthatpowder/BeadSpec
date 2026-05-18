use crate::bd::runner::spawn_managed;
use crate::commands::external::find_ruflo_with_override;
use crate::settings::AppSettings;
use serde_json::Value;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::State;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type, PartialEq)]
pub struct SessionSnapshot {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub is_auto: bool,
    pub metadata: Option<String>,
}

pub(crate) fn parse_session_snapshots(raw: &str) -> Result<Vec<SessionSnapshot>, String> {
    let json: Value = serde_json::from_str(raw).map_err(|e| {
        format!(
            "session list JSON parse failed: {e}; stdout_prefix={}",
            raw.chars().take(80).collect::<String>()
        )
    })?;
    let items = json
        .as_array()
        .cloned()
        .or_else(|| json.get("sessions").and_then(Value::as_array).cloned())
        .unwrap_or_default();
    let mut out: Vec<SessionSnapshot> = items
        .iter()
        .filter_map(|item| {
            let name = item
                .get("name")
                .and_then(Value::as_str)
                .or_else(|| item.get("id").and_then(Value::as_str))?
                .to_string();
            Some(SessionSnapshot {
                id: item
                    .get("id")
                    .and_then(Value::as_str)
                    .unwrap_or(&name)
                    .to_string(),
                created_at: item
                    .get("created_at")
                    .or_else(|| item.get("createdAt"))
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string(),
                is_auto: name.starts_with("auto-"),
                metadata: item.get("metadata").map(Value::to_string),
                name,
            })
        })
        .collect();
    out.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(out)
}

#[tauri::command]
#[specta::specta]
pub async fn list_session_snapshots(
    project_path: String,
    settings: State<'_, Arc<Mutex<AppSettings>>>,
) -> Result<Vec<SessionSnapshot>, String> {
    let settings_path = settings.lock().unwrap().binary_paths.ruflo.clone();
    let ruflo = find_ruflo_with_override(&settings_path).ok_or("ruflo CLI not found")?;
    let out = spawn_managed(
        &ruflo.to_string_lossy(),
        &["session", "list", "--json"],
        std::path::Path::new(&project_path),
        Duration::from_secs(10),
        &[],
    )
    .await
    .map_err(|e| e.to_string())?;
    if out.exit_code != Some(0) {
        return Err(String::from_utf8_lossy(&out.stderr).to_string());
    }
    parse_session_snapshots(&String::from_utf8_lossy(&out.stdout))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_auto_flag() {
        let parsed = parse_session_snapshots(
            r#"[{"id":"1","name":"auto-abc","created_at":"2026-01-01T00:00:00Z"},{"id":"2","name":"manual","created_at":"2026-01-02T00:00:00Z"}]"#,
        )
        .unwrap();
        assert!(!parsed[0].is_auto);
        assert!(parsed[1].is_auto);
    }

    #[test]
    fn malformed_json_includes_prefix() {
        let err = parse_session_snapshots("{not-json").unwrap_err();
        assert!(err.contains("JSON parse failed"));
        assert!(err.contains("{not-json"));
    }
}
