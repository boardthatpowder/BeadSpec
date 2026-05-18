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
    let json: Value = match serde_json::from_str(raw) {
        Ok(json) => json,
        Err(e) => {
            let table = parse_session_table(raw);
            if !table.is_empty() {
                return Ok(table);
            }
            return Err(format!(
                "session list JSON parse failed: {e}; stdout_prefix={}",
                raw.chars().take(80).collect::<String>()
            ));
        }
    };
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

fn parse_session_table(raw: &str) -> Vec<SessionSnapshot> {
    let rows: Vec<Vec<String>> = raw
        .lines()
        .filter_map(|line| {
            let trimmed = line.trim();
            if !trimmed.starts_with('|') || !trimmed.ends_with('|') {
                return None;
            }
            let cells: Vec<String> = trimmed
                .trim_matches('|')
                .split('|')
                .map(|cell| cell.trim().to_string())
                .collect();
            if cells.iter().all(|cell| cell.chars().all(|c| c == '-')) {
                None
            } else {
                Some(cells)
            }
        })
        .collect();
    let Some(headers) = rows.first() else {
        return Vec::new();
    };
    let id_index = headers.iter().position(|header| header == "ID");
    let name_index = headers.iter().position(|header| header == "Name");
    let updated_index = headers
        .iter()
        .position(|header| matches!(header.as_str(), "Created At" | "Last Updated"));
    let status_index = headers.iter().position(|header| header == "Status");
    let agents_index = headers.iter().position(|header| header == "Agents");
    let tasks_index = headers.iter().position(|header| header == "Tasks");
    let (Some(id_index), Some(name_index)) = (id_index, name_index) else {
        return Vec::new();
    };

    rows.into_iter()
        .skip(1)
        .filter_map(|cells| {
            let id = cells.get(id_index)?.trim();
            let name = cells.get(name_index)?.trim();
            if id.is_empty() || name.is_empty() {
                return None;
            }
            let metadata = serde_json::json!({
                "status": status_index.and_then(|index| cells.get(index)).filter(|value| !value.is_empty()),
                "agents": agents_index.and_then(|index| cells.get(index)).filter(|value| !value.is_empty()),
                "tasks": tasks_index.and_then(|index| cells.get(index)).filter(|value| !value.is_empty()),
            });
            Some(SessionSnapshot {
                id: id.to_string(),
                name: name.to_string(),
                created_at: updated_index
                    .and_then(|index| cells.get(index))
                    .cloned()
                    .unwrap_or_default(),
                is_auto: name.starts_with("auto-"),
                metadata: Some(metadata.to_string()),
            })
        })
        .collect()
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

    #[test]
    fn parses_table_output_when_json_flag_is_ignored() {
        let raw = r#"
Sessions

+----------------------+----------------------+--------+--------+-------+--------------+
| ID                   | Name                 | Status | Agents | Tasks | Last Updated |
+----------------------+----------------------+--------+--------+-------+--------------+
| session-177911058... | auto-20260518-072305 | saved  |      0 |     0 | 0m ago       |
| session-177910899... | manual-checkpoint    | saved  |      0 |     0 | 27m ago      |
+----------------------+----------------------+--------+--------+-------+--------------+

[INFO] Showing 2 of 2 sessions
"#;

        let parsed = parse_session_snapshots(raw).unwrap();

        assert_eq!(parsed.len(), 2);
        assert_eq!(parsed[0].id, "session-177911058...");
        assert_eq!(parsed[0].name, "auto-20260518-072305");
        assert_eq!(parsed[0].created_at, "0m ago");
        assert!(parsed[0].is_auto);
        assert!(!parsed[1].is_auto);
    }
}
