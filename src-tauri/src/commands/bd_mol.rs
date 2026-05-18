use crate::bd::runner::{find_bd, invoke_bd_in_project};
use crate::db::dolt_server::DoltServerRegistry;
use crate::db::pool::ProjectRegistry;
use crate::settings::AppSettings;
use serde_json::Value;
use sqlx::Row;
use std::sync::{Arc, Mutex};
use std::time::Duration;
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
}

fn settings_paths(settings: &State<'_, Arc<Mutex<AppSettings>>>) -> (String, String) {
    let guard = settings.lock().unwrap();
    (guard.binary_paths.bd.clone(), guard.binary_paths.dolt.clone())
}

fn id_from_value(value: &Value) -> Option<String> {
    value
        .as_str()
        .map(ToOwned::to_owned)
        .or_else(|| value.get("id").and_then(Value::as_str).map(ToOwned::to_owned))
}

pub(crate) fn parse_bd_ready(raw: &str) -> Option<EpicReadySnapshot> {
    let json: Value = serde_json::from_str(raw).ok()?;
    let ready: Vec<String> = json
        .get("ready")
        .or_else(|| json.get("ready_tasks"))
        .and_then(Value::as_array)
        .map(|items| items.iter().filter_map(id_from_value).collect())
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
        total_open: json.get("total_open").and_then(Value::as_u64).unwrap_or(ready.len() as u64) as u32,
        total_in_progress: json.get("total_in_progress").and_then(Value::as_u64).unwrap_or(0) as u32,
        paused_task_ids: Vec::new(),
        ready,
        blocked,
        source: SnapshotSource::BdCli,
    })
}

#[tauri::command]
#[specta::specta]
pub async fn get_epic_ready_snapshot(
    project_path: String,
    epic_id: String,
    settings: State<'_, Arc<Mutex<AppSettings>>>,
    registry: State<'_, Arc<ProjectRegistry>>,
    server_registry: State<'_, Arc<DoltServerRegistry>>,
) -> Result<EpicReadySnapshot, String> {
    let (bd_override, dolt_override) = settings_paths(&settings);
    if let Some(bd) = find_bd(&bd_override) {
        let cli = invoke_bd_in_project(
            &bd,
            &["ready", "--mol", &epic_id, "--json"],
            &project_path,
            &server_registry,
            &dolt_override,
            Duration::from_secs(10),
        )
        .await;
        if let Ok(stdout) = cli {
            if let Some(mut parsed) = parse_bd_ready(&stdout) {
                parsed.paused_task_ids = paused_children(&project_path, &epic_id, registry.inner()).await;
                return Ok(parsed);
            }
        }
    }
    dolt_snapshot(&project_path, &epic_id, registry.inner()).await
}

async fn epic_openspec_label(
    project_path: &str,
    epic_id: &str,
    registry: &Arc<ProjectRegistry>,
) -> Option<String> {
    let pool = registry.get(project_path).await.ok()?;
    sqlx::query("SELECT label FROM labels WHERE issue_id = ? AND label LIKE 'openspec:%' LIMIT 1")
        .bind(epic_id)
        .fetch_optional(pool.pool())
        .await
        .ok()
        .flatten()
        .and_then(|r| r.try_get("label").ok())
}

async fn child_ids(
    project_path: &str,
    epic_id: &str,
    registry: &Arc<ProjectRegistry>,
) -> Vec<String> {
    let pool = match registry.get(project_path).await {
        Ok(pool) => pool,
        Err(_) => return Vec::new(),
    };
    let label = epic_openspec_label(project_path, epic_id, registry).await;
    if let Some(label) = label {
        let rows = sqlx::query(
            "SELECT i.id FROM issues i JOIN labels l ON l.issue_id = i.id \
             WHERE l.label = ? AND i.id != ? AND i.status != 'deleted' \
             AND COALESCE(i.issue_type, '') NOT IN ('epic','feature')",
        )
        .bind(label)
        .bind(epic_id)
        .fetch_all(pool.pool())
        .await
        .unwrap_or_default();
        return rows.iter().filter_map(|r| r.try_get("id").ok()).collect();
    }
    let rows = sqlx::query("SELECT issue_id FROM dependencies WHERE depends_on_id = ?")
        .bind(epic_id)
        .fetch_all(pool.pool())
        .await
        .unwrap_or_default();
    rows.iter().filter_map(|r| r.try_get("issue_id").ok()).collect()
}

async fn paused_children(
    project_path: &str,
    epic_id: &str,
    registry: &Arc<ProjectRegistry>,
) -> Vec<String> {
    let ids = child_ids(project_path, epic_id, registry).await;
    if ids.is_empty() {
        return Vec::new();
    }
    let pool = match registry.get(project_path).await {
        Ok(pool) => pool,
        Err(_) => return Vec::new(),
    };
    let mut qb = sqlx::QueryBuilder::<sqlx::MySql>::new(
        "SELECT issue_id FROM labels WHERE label = 'openspec:paused' AND issue_id IN (",
    );
    let mut sep = qb.separated(", ");
    for id in ids {
        sep.push_bind(id);
    }
    qb.push(")");
    qb.build()
        .fetch_all(pool.pool())
        .await
        .unwrap_or_default()
        .iter()
        .filter_map(|r| r.try_get("issue_id").ok())
        .collect()
}

async fn dolt_snapshot(
    project_path: &str,
    epic_id: &str,
    registry: &Arc<ProjectRegistry>,
) -> Result<EpicReadySnapshot, String> {
    let pool = registry
        .get(project_path)
        .await
        .map_err(|_| format!("project_not_connected: '{project_path}'"))?;
    let ids = child_ids(project_path, epic_id, registry).await;
    if ids.is_empty() {
        return Ok(EpicReadySnapshot {
            ready: Vec::new(),
            blocked: Vec::new(),
            paused_task_ids: Vec::new(),
            total_open: 0,
            total_in_progress: 0,
            source: SnapshotSource::Dolt,
        });
    }
    let mut total_open = 0;
    let mut total_in_progress = 0;
    let mut ready = Vec::new();
    let mut first_blocked_child: Option<String> = None;
    for id in &ids {
        let row = sqlx::query("SELECT status FROM issues WHERE id = ?")
            .bind(id)
            .fetch_optional(pool.pool())
            .await
            .ok()
            .flatten();
        let status: String = row.and_then(|r| r.try_get("status").ok()).unwrap_or_default();
        if status == "open" {
            total_open += 1;
            let blocker_count: i64 = sqlx::query(
                "SELECT COUNT(*) AS cnt FROM dependencies d JOIN issues b ON b.id = d.depends_on_id \
                 WHERE d.issue_id = ? AND d.depends_on_id != ? AND b.status != 'closed'",
            )
            .bind(id)
            .bind(epic_id)
            .fetch_one(pool.pool())
            .await
            .ok()
            .and_then(|r| r.try_get("cnt").ok())
            .unwrap_or(0);
            if blocker_count == 0 {
                ready.push(id.clone());
            } else if first_blocked_child.is_none() {
                first_blocked_child = Some(id.clone());
            }
        } else if status == "in_progress" {
            total_in_progress += 1;
        }
    }
    let blocked = if let Some(child) = first_blocked_child {
        sqlx::query(
            "SELECT b.id, b.title, b.status FROM dependencies d JOIN issues b ON b.id = d.depends_on_id \
             WHERE d.issue_id = ? AND d.depends_on_id != ? AND b.status != 'closed' LIMIT 5",
        )
        .bind(child)
        .bind(epic_id)
        .fetch_all(pool.pool())
        .await
        .unwrap_or_default()
        .iter()
        .map(|r| BlockerLink {
            blocker_id: r.try_get("id").unwrap_or_default(),
            blocker_title: r.try_get("title").unwrap_or_default(),
            blocker_status: r.try_get("status").unwrap_or_default(),
        })
        .collect()
    } else {
        Vec::new()
    };

    Ok(EpicReadySnapshot {
        ready,
        blocked,
        paused_task_ids: paused_children(project_path, epic_id, registry).await,
        total_open,
        total_in_progress,
        source: SnapshotSource::Dolt,
    })
}

#[tauri::command]
#[specta::specta]
pub async fn claim_task(
    project_path: String,
    task_id: String,
    settings: State<'_, Arc<Mutex<AppSettings>>>,
    registry: State<'_, Arc<ProjectRegistry>>,
    server_registry: State<'_, Arc<DoltServerRegistry>>,
) -> Result<crate::commands::read::Task, String> {
    let (bd_override, dolt_override) = settings_paths(&settings);
    let bd = find_bd(&bd_override).ok_or_else(|| "bd CLI not found".to_string())?;
    invoke_bd_in_project(
        &bd,
        &["update", &task_id, "--claim"],
        &project_path,
        &server_registry,
        &dolt_override,
        Duration::from_secs(30),
    )
    .await?;
    read_task_summary(&project_path, &task_id, registry.inner()).await
}

async fn read_task_summary(
    project_path: &str,
    task_id: &str,
    registry: &Arc<ProjectRegistry>,
) -> Result<crate::commands::read::Task, String> {
    let pool = registry
        .get(project_path)
        .await
        .map_err(|_| format!("project_not_connected: '{project_path}'"))?;
    let row = sqlx::query(
        "SELECT id, title, status, priority, issue_type, assignee, created_at, updated_at \
         FROM issues WHERE id = ? LIMIT 1",
    )
    .bind(task_id)
    .fetch_one(pool.pool())
    .await
    .map_err(|e| format!("Task not found: {e}"))?;
    let labels = sqlx::query("SELECT label FROM labels WHERE issue_id = ? ORDER BY label")
        .bind(task_id)
        .fetch_all(pool.pool())
        .await
        .unwrap_or_default()
        .iter()
        .filter_map(|r| r.try_get("label").ok())
        .collect();
    Ok(crate::commands::read::Task {
        id: row.try_get("id").unwrap_or_default(),
        title: row.try_get("title").unwrap_or_default(),
        status: row.try_get("status").unwrap_or_default(),
        priority: row.try_get::<i32, _>("priority").unwrap_or(2),
        task_type: row.try_get("issue_type").unwrap_or_else(|_| "task".into()),
        assignee: row.try_get("assignee").ok(),
        labels,
        created_at: crate::commands::read::decode_datetime(&row, "created_at"),
        updated_at: crate::commands::read::decode_datetime(&row, "updated_at"),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bd_ready_parser_handles_ready_array() {
        let snap = parse_bd_ready(r#"{"ready":["A","B"],"total_open":3,"total_in_progress":1}"#).unwrap();
        assert_eq!(snap.ready, vec!["A", "B"]);
        assert_eq!(snap.total_open, 3);
        assert_eq!(snap.source, SnapshotSource::BdCli);
    }
}
