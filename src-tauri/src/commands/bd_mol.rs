use crate::commands::read::{issue_labels, string_field, task_from_issue};
use crate::db::dolt_server::DoltServerRegistry;
use crate::db::pool::ProjectRegistry;
use crate::settings::AppSettings;
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};
use tauri::State;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct EpicReadySnapshot {
    pub ready: Vec<String>,
    pub blocked: Vec<BlockerLink>,
    pub paused_task_ids: Vec<String>,
    pub total_open: u32,
    pub total_in_progress: u32,
    pub source: SnapshotSource,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct BlockerLink {
    pub blocker_id: String,
    pub blocker_title: String,
    pub blocker_status: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type, PartialEq, Eq)]
pub enum SnapshotSource {
    BdCli,
    Dolt,
    Http,
}

fn id_from_value(value: &Value) -> Option<String> {
    value.as_str().map(ToOwned::to_owned).or_else(|| {
        value
            .get("id")
            .and_then(Value::as_str)
            .map(ToOwned::to_owned)
    })
}

pub(crate) fn parse_bd_ready(raw: &str) -> Option<EpicReadySnapshot> {
    let json: Value = serde_json::from_str(raw).ok()?;
    if !json.is_object() {
        return None;
    }
    let ready: Vec<String> = json
        .get("ready")
        .or_else(|| json.get("ready_tasks"))
        .or_else(|| json.get("steps"))
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|item| id_from_value(item.get("issue").unwrap_or(item)))
                .collect()
        })
        .unwrap_or_default();
    let blocked = json
        .get("blocked")
        .or_else(|| json.get("blockers"))
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|item| {
                    Some(BlockerLink {
                        blocker_id: item
                            .get("blocker_id")
                            .or_else(|| item.get("id"))
                            .and_then(Value::as_str)?
                            .to_string(),
                        blocker_title: item
                            .get("blocker_title")
                            .or_else(|| item.get("title"))
                            .and_then(Value::as_str)
                            .unwrap_or_default()
                            .to_string(),
                        blocker_status: item
                            .get("blocker_status")
                            .or_else(|| item.get("status"))
                            .and_then(Value::as_str)
                            .unwrap_or_default()
                            .to_string(),
                    })
                })
                .collect()
        })
        .unwrap_or_default();
    Some(EpicReadySnapshot {
        total_open: json
            .get("total_open")
            .and_then(Value::as_u64)
            .unwrap_or(ready.len() as u64) as u32,
        total_in_progress: json
            .get("total_in_progress")
            .and_then(Value::as_u64)
            .unwrap_or(0) as u32,
        paused_task_ids: Vec::new(),
        ready,
        blocked,
        source: SnapshotSource::BdCli,
    })
}

fn child_ids(issues: &[Value], edges: &[Value], epic_id: &str) -> Vec<String> {
    let label = issues.iter().find(|v| v["id"] == epic_id).and_then(|v| {
        issue_labels(v)
            .into_iter()
            .find(|label| label.starts_with("openspec:"))
    });
    issues
        .iter()
        .filter(|issue| {
            let id = issue["id"].as_str().unwrap_or_default();
            if let Some(label) = &label {
                id != epic_id
                    && issue["status"] != "deleted"
                    && issue["issue_type"] != "epic"
                    && issue["issue_type"] != "feature"
                    && issue_labels(issue).contains(label)
            } else {
                edges
                    .iter()
                    .any(|edge| edge["issue_id"] == id && edge["depends_on_id"] == epic_id)
            }
        })
        .filter_map(|v| v["id"].as_str().map(ToOwned::to_owned))
        .collect()
}

fn snapshot_from_ready(
    issues: &[Value],
    edges: &[Value],
    epic_id: &str,
    ready_ids: &[String],
    source: SnapshotSource,
) -> EpicReadySnapshot {
    let children = child_ids(issues, edges, epic_id);
    let by_id: HashMap<_, _> = issues
        .iter()
        .filter_map(|issue| Some((issue["id"].as_str()?, issue)))
        .collect();
    let mut total_open = 0;
    let mut total_in_progress = 0;
    let mut ready = Vec::new();
    let mut paused_task_ids = Vec::new();
    let mut first_blocked_child = None;
    for id in &children {
        let Some(issue) = by_id.get(id.as_str()) else {
            continue;
        };
        if issue_labels(issue).iter().any(|l| l == "openspec:paused") {
            paused_task_ids.push(id.clone());
        }
        match issue["status"].as_str().unwrap_or_default() {
            "open" => {
                total_open += 1;
                if ready_ids.contains(id) {
                    ready.push(id.clone());
                } else if first_blocked_child.is_none() {
                    first_blocked_child = Some(id);
                }
            }
            "in_progress" => total_in_progress += 1,
            _ => {}
        }
    }
    let blocked = first_blocked_child
        .map(|child| {
            edges
                .iter()
                .filter(|edge| edge["issue_id"] == child.as_str())
                .filter_map(|edge| {
                    let id = edge["depends_on_id"].as_str()?;
                    let kind = edge["type"].as_str().unwrap_or("blocks");
                    let issue = by_id.get(id);
                    let status = issue
                        .map(|v| string_field(v, "status"))
                        .unwrap_or_else(|| "unknown".to_string());
                    let blocking = (kind == "blocks" && status != "closed")
                        || (kind == "parent-child" && status == "closed");
                    if !blocking {
                        return None;
                    }
                    Some(BlockerLink {
                        blocker_id: id.to_string(),
                        blocker_title: issue
                            .map(|v| string_field(v, "title"))
                            .unwrap_or_else(|| id.to_string()),
                        blocker_status: status,
                    })
                })
                .take(5)
                .collect()
        })
        .unwrap_or_default();
    EpicReadySnapshot {
        ready,
        blocked,
        paused_task_ids,
        total_open,
        total_in_progress,
        source,
    }
}

#[tauri::command]
#[specta::specta]
pub async fn get_epic_ready_snapshot(
    project_path: String,
    epic_id: String,
    _settings: State<'_, Arc<Mutex<AppSettings>>>,
    registry: State<'_, Arc<ProjectRegistry>>,
    _server_registry: State<'_, Arc<DoltServerRegistry>>,
) -> Result<EpicReadySnapshot, String> {
    let source = registry
        .get(&project_path)
        .await
        .map_err(|_| format!("project_not_connected: '{project_path}'"))?;
    let issues = source.list_issues().await?;
    let ids: Vec<_> = issues
        .iter()
        .filter_map(|v| v["id"].as_str().map(ToOwned::to_owned))
        .collect();
    let edges = source.dependencies(&ids).await?;
    let children: HashSet<_> = child_ids(&issues, &edges, &epic_id).into_iter().collect();
    let parent_children: HashSet<_> = edges
        .iter()
        .filter(|v| v["depends_on_id"] == epic_id && v["type"] == "parent-child")
        .filter_map(|v| v["issue_id"].as_str().map(ToOwned::to_owned))
        .collect();
    if source.is_http() && children == parent_children {
        let ready: Vec<_> = source
            .ready(Some(&epic_id))
            .await?
            .iter()
            .filter_map(id_from_value)
            .collect();
        return Ok(snapshot_from_ready(
            &issues,
            &edges,
            &epic_id,
            &ready,
            SnapshotSource::Http,
        ));
    }
    let raw = source
        .run_cli(&["ready", "--mol", &epic_id, "--json"])
        .await?;
    let snapshot =
        parse_bd_ready(&raw).ok_or_else(|| "Invalid bd molecule-ready JSON".to_string())?;
    Ok(snapshot_from_ready(
        &issues,
        &edges,
        &epic_id,
        &snapshot.ready,
        SnapshotSource::BdCli,
    ))
}

#[tauri::command]
#[specta::specta]
pub async fn claim_task(
    project_path: String,
    task_id: String,
    _settings: State<'_, Arc<Mutex<AppSettings>>>,
    registry: State<'_, Arc<ProjectRegistry>>,
    _server_registry: State<'_, Arc<DoltServerRegistry>>,
) -> Result<crate::commands::read::Task, String> {
    let source = registry
        .get(&project_path)
        .await
        .map_err(|_| format!("project_not_connected: '{project_path}'"))?;
    let mut encoded = reqwest::Url::parse("http://127.0.0.1/").map_err(|e| e.to_string())?;
    encoded
        .path_segments_mut()
        .map_err(|_| "Invalid claim URL".to_string())?
        .push(&task_id);
    let path = format!("/issues/{}:claim", encoded.path().trim_start_matches('/'));
    source
        .write(
            &["update", &task_id, "--claim"],
            "issues.claim",
            "POST",
            &path,
            serde_json::json!({}),
        )
        .await?;
    Ok(task_from_issue(&source.get_issue(&task_id).await?))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bd_ready_parser_handles_ready_array() {
        let snap =
            parse_bd_ready(r#"{"ready":["A","B"],"total_open":3,"total_in_progress":1}"#).unwrap();
        assert_eq!(snap.ready, vec!["A", "B"]);
        assert_eq!(snap.total_open, 3);
        assert_eq!(snap.source, SnapshotSource::BdCli);
    }

    #[test]
    fn pinned_molecule_ready_parser_reads_nested_step_issues() {
        let snapshot = parse_bd_ready(r#"{"molecule_id":"B-epic","total_steps":3,"ready_steps":2,"steps":[{"issue":{"id":"B-first","status":"open"}},{"issue":{"id":"B-next","status":"open"}}]}"#).unwrap();
        assert_eq!(snapshot.ready, ["B-first", "B-next"]);
    }

    #[test]
    fn http_snapshot_uses_authoritative_ready_ids_and_preserves_counts_paused_and_typed_blockers() {
        let issues = serde_json::json!([
            {"id":"B-epic","issue_type":"epic","status":"open","labels":["openspec:change"]},
            {"id":"B-blocked","issue_type":"task","status":"open","labels":["openspec:change","openspec:paused"]},
            {"id":"B-ready","issue_type":"gate","status":"open","labels":["openspec:change"]},
            {"id":"B-active","issue_type":"bug","status":"in_progress","labels":["openspec:change"]},
            {"id":"B-closed","issue_type":"task","status":"closed","labels":["openspec:change"]},
            {"id":"B-related","title":"Related work","status":"open"}
        ]);
        let edges = serde_json::json!([
            {"issue_id":"B-blocked","depends_on_id":"B-epic","type":"parent-child"},
            {"issue_id":"B-blocked","depends_on_id":"B-related","type":"related"},
            {"issue_id":"B-blocked","depends_on_id":"other:missing","type":"blocks"}
        ]);
        let snapshot = snapshot_from_ready(
            issues.as_array().unwrap(),
            edges.as_array().unwrap(),
            "B-epic",
            &["B-ready".into()],
            SnapshotSource::Http,
        );
        assert_eq!(snapshot.ready, ["B-ready"]);
        assert_eq!(snapshot.total_open, 2);
        assert_eq!(snapshot.total_in_progress, 1);
        assert_eq!(snapshot.paused_task_ids, ["B-blocked"]);
        assert_eq!(snapshot.blocked.len(), 1);
        assert_eq!(snapshot.blocked[0].blocker_id, "other:missing");
        assert_eq!(snapshot.blocked[0].blocker_status, "unknown");
        assert_eq!(snapshot.source, SnapshotSource::Http);
    }
}
