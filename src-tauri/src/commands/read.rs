use crate::bd::api::BeadsDataSource;
use crate::commands::workers::{parse_worker_provenance, WorkerProvenance};
use crate::db::pool::ProjectRegistry;
use serde_json::Value;
use std::sync::Arc;
use tauri::State;

// ── Data types ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct Task {
    pub id: String,
    pub title: String,
    pub status: String,
    pub priority: i32,
    pub task_type: String,
    pub assignee: Option<String>,
    pub labels: Vec<String>,
    pub worker_provenance: Option<WorkerProvenance>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct TaskDetail {
    pub id: String,
    pub title: String,
    pub status: String,
    pub priority: i32,
    pub task_type: String,
    pub assignee: Option<String>,
    pub description: Option<String>,
    pub labels: Vec<String>,
    pub dependencies: Vec<String>, // IDs of issues this task depends on
    pub dependents: Vec<String>,   // IDs of issues that depend on this task
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct HistoryEntry {
    pub id: String,
    pub field: String,
    pub old_value: Option<String>,
    pub new_value: Option<String>,
    pub actor: String,
    pub timestamp: String,
    pub entry_type: String,   // "field_change" | "comment" | "label_change"
    pub body: Option<String>, // For comments
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct TaskFilters {
    pub status: Vec<String>,
    pub priority: Vec<i32>,
    pub labels: Vec<String>, // e.g. ["branch:main", "repo:BeadSpec"]
    pub search: Option<String>,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn not_connected(project_path: &str) -> String {
    format!("Project not connected — call connect_project first for '{project_path}'")
}

// ── Response types ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct TasksResponse {
    pub tasks: Vec<Task>,
    pub total_count: u32,
}

pub(crate) fn string_field(value: &Value, field: &str) -> String {
    value[field].as_str().unwrap_or_default().to_string()
}

pub(crate) fn compare_timestamps(a: &str, b: &str) -> std::cmp::Ordering {
    use sqlx::types::chrono::DateTime;
    match (
        DateTime::parse_from_rfc3339(a),
        DateTime::parse_from_rfc3339(b),
    ) {
        (Ok(a), Ok(b)) => a.cmp(&b),
        _ => a.cmp(b),
    }
}

pub(crate) fn issue_labels(value: &Value) -> Vec<String> {
    let mut labels: Vec<_> = value["labels"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(Value::as_str)
        .map(ToOwned::to_owned)
        .collect();
    labels.sort();
    labels.dedup();
    labels
}

pub(crate) fn task_from_issue(value: &Value) -> Task {
    Task {
        id: string_field(value, "id"),
        title: string_field(value, "title"),
        status: string_field(value, "status"),
        priority: value["priority"].as_i64().unwrap_or(2) as i32,
        task_type: value["issue_type"].as_str().unwrap_or("task").to_string(),
        assignee: value["assignee"].as_str().map(ToOwned::to_owned),
        labels: issue_labels(value),
        worker_provenance: value["notes"].as_str().and_then(parse_worker_provenance),
        created_at: string_field(value, "created_at"),
        updated_at: string_field(value, "updated_at"),
    }
}

fn merge_filters(direct: Option<Vec<String>>, legacy: Option<&Vec<String>>) -> Vec<String> {
    let mut values = direct.unwrap_or_default();
    for value in legacy.into_iter().flatten() {
        if !values.contains(value) {
            values.push(value.clone());
        }
    }
    values
}

fn filter_tasks(
    mut tasks: Vec<Task>,
    filters: Option<TaskFilters>,
    status_filter: Option<Vec<String>>,
    label_filter: Option<Vec<String>>,
    sort_col: Option<String>,
    sort_dir: Option<String>,
) -> TasksResponse {
    let statuses = merge_filters(status_filter, filters.as_ref().map(|f| &f.status));
    let labels = merge_filters(label_filter, filters.as_ref().map(|f| &f.labels));
    let search = filters
        .as_ref()
        .and_then(|f| f.search.as_ref())
        .map(|query| query.to_lowercase());
    tasks.retain(|task| {
        task.status != "deleted"
            && (statuses.is_empty() || statuses.contains(&task.status))
            && labels.iter().all(|label| task.labels.contains(label))
            && filters.as_ref().is_none_or(|f| {
                (f.priority.is_empty() || f.priority.contains(&task.priority))
                    && search.as_ref().is_none_or(|query| {
                        task.id.to_lowercase().contains(query)
                            || task.title.to_lowercase().contains(query)
                    })
            })
    });
    let ascending = sort_dir
        .as_deref()
        .is_some_and(|s| s.eq_ignore_ascii_case("asc"));
    tasks.sort_by(|a, b| {
        let primary = match sort_col.as_deref().unwrap_or("priority") {
            "status" => a.status.to_lowercase().cmp(&b.status.to_lowercase()),
            "title" => a.title.to_lowercase().cmp(&b.title.to_lowercase()),
            "created_at" => compare_timestamps(&a.created_at, &b.created_at),
            _ => a.priority.cmp(&b.priority),
        };
        let primary = if ascending {
            primary
        } else {
            primary.reverse()
        };
        primary
            .then_with(|| compare_timestamps(&b.created_at, &a.created_at))
            .then_with(|| a.id.cmp(&b.id))
    });
    TasksResponse {
        total_count: tasks.len() as u32,
        tasks,
    }
}

#[tauri::command]
#[specta::specta]
pub async fn list_tasks(
    project_path: String,
    filters: Option<TaskFilters>,
    status_filter: Option<Vec<String>>,
    label_filter: Option<Vec<String>>,
    sort_col: Option<String>,
    sort_dir: Option<String>,
    registry: State<'_, Arc<ProjectRegistry>>,
) -> Result<TasksResponse, String> {
    let source = registry
        .get(&project_path)
        .await
        .map_err(|_| not_connected(&project_path))?;
    let tasks = source
        .list_issues()
        .await?
        .iter()
        .map(task_from_issue)
        .collect();
    Ok(filter_tasks(
        tasks,
        filters,
        status_filter,
        label_filter,
        sort_col,
        sort_dir,
    ))
}

pub(crate) fn dependency_ids(edges: &[Value], issue_id: &str) -> (Vec<String>, Vec<String>) {
    let mut dependencies = Vec::new();
    let mut dependents = Vec::new();
    for edge in edges {
        let from = edge["issue_id"].as_str().unwrap_or_default();
        let to = edge["depends_on_id"].as_str().unwrap_or_default();
        if from == issue_id && !dependencies.iter().any(|id| id == to) {
            dependencies.push(to.to_string());
        }
        if to == issue_id && !dependents.iter().any(|id| id == from) {
            dependents.push(from.to_string());
        }
    }
    (dependencies, dependents)
}

#[tauri::command]
#[specta::specta]
pub async fn get_task(
    project_path: String,
    issue_id: String,
    registry: State<'_, Arc<ProjectRegistry>>,
) -> Result<TaskDetail, String> {
    let source = registry
        .get(&project_path)
        .await
        .map_err(|_| not_connected(&project_path))?;
    load_task_detail(&source, &issue_id).await
}

pub(crate) async fn load_task_detail(
    source: &BeadsDataSource,
    issue_id: &str,
) -> Result<TaskDetail, String> {
    let issue = source.get_issue(issue_id).await?;
    // Keep raw outbound targets (including missing/external issues). The detail
    // read already requests incoming neighbors through include_dependents.
    let edges = source.dependencies(&[issue_id.to_owned()]).await?;
    let (dependencies, mut dependents) = dependency_ids(&edges, issue_id);
    for dependent in issue["dependents"].as_array().into_iter().flatten() {
        if let Some(id) = dependent["id"].as_str() {
            if !dependents.iter().any(|existing| existing == id) {
                dependents.push(id.to_owned());
            }
        }
    }
    let task = task_from_issue(&issue);
    Ok(TaskDetail {
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        task_type: task.task_type,
        assignee: task.assignee,
        description: issue["description"].as_str().map(ToOwned::to_owned),
        labels: task.labels,
        dependencies,
        dependents,
        created_at: task.created_at,
        updated_at: task.updated_at,
    })
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct SearchResult {
    pub id: String,
    pub title: String,
    pub status: String,
    pub score: u32, // higher = better match
}

fn fuzzy_match(haystack: &str, needle: &str) -> bool {
    if needle.is_empty() {
        return true;
    }
    let mut hi = haystack.chars();
    'outer: for nc in needle.chars() {
        loop {
            match hi.next() {
                None => return false,
                Some(hc) if hc == nc => continue 'outer,
                Some(_) => {}
            }
        }
    }
    true
}

fn search_issue_values(issues: &[Value], query: &str) -> Vec<SearchResult> {
    if query.trim().is_empty() {
        return Vec::new();
    }
    let q = query.to_lowercase();
    let mut results: Vec<_> = issues
        .iter()
        .filter(|v| v["status"] != "deleted")
        .filter_map(|issue| {
            let id = string_field(issue, "id");
            let title = string_field(issue, "title");
            let id_lower = id.to_lowercase();
            let title_lower = title.to_lowercase();
            let score = if id_lower == q || title_lower == q {
                100
            } else if id_lower.starts_with(&q) || title_lower.starts_with(&q) {
                80
            } else if id_lower.contains(&q) || title_lower.contains(&q) {
                60
            } else if fuzzy_match(&title_lower, &q) || fuzzy_match(&id_lower, &q) {
                40
            } else {
                return None;
            };
            Some(SearchResult {
                id,
                title,
                status: string_field(issue, "status"),
                score,
            })
        })
        .collect();
    results.sort_by_key(|a| std::cmp::Reverse(a.score));
    results.truncate(20);
    results
}

#[tauri::command]
#[specta::specta]
pub async fn search_tasks(
    project_path: String,
    query: String,
    registry: State<'_, Arc<ProjectRegistry>>,
) -> Result<Vec<SearchResult>, String> {
    if query.trim().is_empty() {
        return Ok(Vec::new());
    }
    let source = registry
        .get(&project_path)
        .await
        .map_err(|_| not_connected(&project_path))?;
    Ok(search_issue_values(&source.list_issues().await?, &query))
}

fn value_text(value: &Value) -> Option<String> {
    match value {
        Value::Null => None,
        Value::String(s) => Some(s.clone()),
        _ => Some(value.to_string()),
    }
}

fn event_value(value: &Value, field: &str) -> Option<String> {
    let raw = value.as_str()?;
    match serde_json::from_str::<Value>(raw) {
        Ok(Value::Object(object)) => object.get(field).and_then(value_text),
        _ => Some(raw.to_string()),
    }
}

pub(crate) fn task_history_from_values(
    events: &[Value],
    snapshots: &[Value],
    comments: &[Value],
) -> Vec<HistoryEntry> {
    let mut entries: Vec<_> = comments
        .iter()
        .map(|comment| HistoryEntry {
            id: value_text(&comment["id"]).unwrap_or_default(),
            field: "comment".to_string(),
            old_value: None,
            new_value: None,
            actor: comment["author"].as_str().unwrap_or("unknown").to_string(),
            timestamp: string_field(comment, "created_at"),
            entry_type: "comment".to_string(),
            body: comment["text"].as_str().map(ToOwned::to_owned),
        })
        .collect();
    for event in events {
        let event_type = event["event_type"].as_str().unwrap_or_default();
        // Native comments are the source of comment IDs; audit rows would duplicate them.
        if event_type == "commented" {
            continue;
        }
        let fields: &[&str] = match event_type {
            "created" | "status_changed" | "closed" | "reopened" => &["status"],
            "claimed" => &["status", "assignee"],
            "label_added" | "label_removed" => &["labels"],
            "dependency_added" | "dependency_removed" => &["dependencies"],
            "updated" => &[
                "title",
                "status",
                "priority",
                "assignee",
                "description",
                "notes",
            ],
            _ => &[],
        };
        for field in fields {
            if matches!(event_type, "updated" | "claimed") {
                let patch = event["new_value"]
                    .as_str()
                    .and_then(|raw| serde_json::from_str::<Value>(raw).ok());
                if !patch
                    .as_ref()
                    .and_then(Value::as_object)
                    .is_some_and(|object| object.contains_key(*field))
                {
                    continue;
                }
            }
            let old = event_value(&event["old_value"], field);
            let new = event_value(&event["new_value"], field);
            if old == new {
                continue;
            }
            entries.push(HistoryEntry {
                id: format!(
                    "event-{}-{field}",
                    value_text(&event["id"]).unwrap_or_default()
                ),
                field: (*field).to_string(),
                old_value: old,
                new_value: new,
                actor: event["actor"].as_str().unwrap_or("beads").to_string(),
                timestamp: string_field(event, "created_at"),
                entry_type: if *field == "labels" {
                    "label_change"
                } else {
                    "field_change"
                }
                .to_string(),
                body: None,
            });
        }
    }
    // Audit old/new values are absent for some writers; snapshots fill those status gaps.
    let mut snapshots: Vec<_> = snapshots
        .iter()
        .filter(|v| v["Issue"].is_object())
        .collect();
    snapshots.sort_by(|a, b| {
        compare_timestamps(
            &string_field(a, "CommitDate"),
            &string_field(b, "CommitDate"),
        )
    });
    let mut previous: Option<String> = None;
    let mut previous_time = None;
    for snapshot in snapshots {
        let new = snapshot["Issue"]["status"].as_str().map(ToOwned::to_owned);
        let timestamp = string_field(snapshot, "CommitDate");
        let commit_time = sqlx::types::chrono::DateTime::parse_from_rfc3339(&timestamp)
            .ok()
            .map(|date| date.timestamp());
        // Commit dates have second precision; audit events can retain subsecond precision.
        let covered_by_audit = entries.iter().any(|entry| {
            entry.field == "status"
                && entry.id.starts_with("event-")
                && entry.old_value == previous
                && entry.new_value == new
                && match (
                    sqlx::types::chrono::DateTime::parse_from_rfc3339(&entry.timestamp).ok(),
                    commit_time,
                ) {
                    (Some(event_time), Some(commit_time)) => {
                        event_time.timestamp() <= commit_time + 1
                            && previous_time.is_none_or(|previous_time| {
                                event_time.timestamp() >= previous_time - 1
                            })
                    }
                    _ => entry.timestamp == timestamp,
                }
        });
        if new != previous && !covered_by_audit {
            entries.push(HistoryEntry {
                id: format!("commit-status-{}", string_field(snapshot, "CommitHash")),
                field: "status".to_string(),
                old_value: previous.clone(),
                new_value: new.clone(),
                actor: snapshot["Committer"]
                    .as_str()
                    .unwrap_or("beads")
                    .to_string(),
                timestamp,
                entry_type: "field_change".to_string(),
                body: None,
            });
        }
        previous = new;
        previous_time = commit_time;
    }
    entries.sort_by(|a, b| {
        compare_timestamps(&a.timestamp, &b.timestamp).then_with(|| a.id.cmp(&b.id))
    });
    entries
}

async fn cli_values(source: &BeadsDataSource, args: &[&str]) -> Result<Vec<Value>, String> {
    let value: Value = serde_json::from_str(&source.run_cli(args).await?)
        .map_err(|e| format!("Invalid bd JSON: {e}"))?;
    if value.is_null() {
        return Ok(Vec::new());
    }
    value
        .as_array()
        .cloned()
        .ok_or_else(|| "Invalid bd JSON: expected an array".to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn get_task_history(
    project_path: String,
    issue_id: String,
    registry: State<'_, Arc<ProjectRegistry>>,
) -> Result<Vec<HistoryEntry>, String> {
    let source = registry
        .get(&project_path)
        .await
        .map_err(|_| not_connected(&project_path))?;
    let events = cli_values(&source, &["history", &issue_id, "--events", "--json"]).await?;
    let comments = cli_values(&source, &["comments", &issue_id, "--json"]).await?;
    let snapshots = cli_values(&source, &["history", &issue_id, "--json"])
        .await
        .unwrap_or_default();
    Ok(task_history_from_values(&events, &snapshots, &comments))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn api_issue_keeps_gate_type_labels_and_first_line_worker_provenance() {
        let task = task_from_issue(
            &json!({"id":"B-gate","title":"Gate","issue_type":"gate","status":"closed","priority":0,
            "labels":["z","a"], "notes":"Auto-filed by ruflo-alpha worker on 2026-05-17\nFull notes","created_at":"2026-05-17T00:00:00Z"}),
        );
        assert_eq!(task.task_type, "gate");
        assert_eq!(task.labels, ["a", "z"]);
        assert_eq!(task.status, "closed");
        assert_eq!(
            task.worker_provenance.unwrap().notes_first_line,
            "Auto-filed by ruflo-alpha worker on 2026-05-17"
        );
    }

    #[test]
    fn snapshot_filter_uses_status_or_labels_and_and_descending_priority_with_ties() {
        let issues = json!([
            {"id":"B-a","title":"Alpha","status":"open","priority":4,"labels":["x","y"],"created_at":"2026-05-18T00:00:00Z"},
            {"id":"B-b","title":"Beta","status":"closed","priority":4,"labels":["x","y"],"created_at":"2026-05-18T00:00:00Z"},
            {"id":"B-c","title":"Older","status":"open","priority":4,"labels":["x","y"],"created_at":"2026-05-17T00:00:00Z"},
            {"id":"B-d","title":"Urgent","status":"closed","priority":0,"labels":["x","y"]},
            {"id":"B-one-label","status":"open","priority":5,"labels":["x"]},
            {"id":"B-deleted","status":"deleted","priority":5,"labels":["x","y"]}
        ]);
        let response = filter_tasks(
            issues
                .as_array()
                .unwrap()
                .iter()
                .map(task_from_issue)
                .collect(),
            Some(TaskFilters {
                status: vec!["closed".into()],
                priority: vec![],
                labels: vec!["y".into()],
                search: None,
            }),
            Some(vec!["open".into()]),
            Some(vec!["x".into()]),
            None,
            None,
        );
        assert_eq!(response.total_count, 4);
        assert_eq!(
            response
                .tasks
                .iter()
                .map(|t| t.id.as_str())
                .collect::<Vec<_>>(),
            ["B-a", "B-b", "B-c", "B-d"]
        );
    }

    #[test]
    fn raw_edges_keep_external_targets_reverse_edges_and_all_dependency_types() {
        let edges = json!([
            {"issue_id":"B-task","depends_on_id":"other:missing","type":"related"},
            {"issue_id":"B-task","depends_on_id":"B-epic","type":"parent-child"},
            {"issue_id":"B-child","depends_on_id":"B-task","type":"blocks"}
        ]);
        let (dependencies, dependents) = dependency_ids(edges.as_array().unwrap(), "B-task");
        assert_eq!(dependencies, ["other:missing", "B-epic"]);
        assert_eq!(dependents, ["B-child"]);
    }

    #[test]
    fn timestamp_ties_sort_chronologically_with_fractional_seconds_and_offsets() {
        let issues = json!([
            {"id":"B-zero","status":"open","priority":2,"created_at":"2026-05-18T00:00:00Z"},
            {"id":"B-newer","status":"open","priority":2,"created_at":"2026-05-18T00:00:00.900Z"},
            {"id":"B-old","status":"open","priority":2,"created_at":"2026-05-18T01:00:00+02:00"}
        ]);
        let response = filter_tasks(
            issues
                .as_array()
                .unwrap()
                .iter()
                .map(task_from_issue)
                .collect(),
            None,
            None,
            None,
            None,
            None,
        );
        assert_eq!(
            response
                .tasks
                .iter()
                .map(|task| task.id.as_str())
                .collect::<Vec<_>>(),
            ["B-newer", "B-zero", "B-old"]
        );
    }

    #[test]
    fn fuzzy_search_covers_complete_snapshot_and_keeps_legacy_scores() {
        let mut issues = vec![json!({"id":"B-no","title":"unrelated","status":"open"}); 2001];
        issues.extend([
            json!({"id":"B-exact","title":"needle","status":"closed"}),
            json!({"id":"B-prefix","title":"Needle extension","status":"open"}),
            json!({"id":"B-sub","title":"A needle here","status":"open"}),
            json!({"id":"B-fuzzy","title":"n e e d l e","status":"open"}),
        ]);
        let results = search_issue_values(&issues, "needle");
        assert_eq!(
            results.iter().map(|r| r.score).collect::<Vec<_>>(),
            [100, 80, 60, 40]
        );
        assert_eq!(results[0].status, "closed");
        assert!(search_issue_values(&issues, "  ").is_empty());
    }

    #[test]
    fn native_history_uses_pascal_case_snapshot_fields_and_comments_without_duplicates() {
        let events = json!([{"id":"e-comment","event_type":"commented","comment":"A note","created_at":"2026-05-18T12:00:00Z"},
            {"id":"e-close","event_type":"closed","actor":"alice","created_at":"2026-05-19T00:00:00Z"}]);
        let snapshots = json!([
            {"CommitHash":"new","Committer":"alice","CommitDate":"2026-05-19T00:00:00Z","Issue":{"status":"closed"}},
            {"CommitHash":"old","Committer":"bob","CommitDate":"2026-05-17T00:00:00Z","Issue":{"status":"open"}}
        ]);
        let comments =
            json!([{"id":7,"author":"alice","text":"A note","created_at":"2026-05-18T12:00:00Z"}]);
        let history = task_history_from_values(
            events.as_array().unwrap(),
            snapshots.as_array().unwrap(),
            comments.as_array().unwrap(),
        );
        assert_eq!(history.len(), 3);
        assert_eq!(history[1].id, "7");
        assert_eq!(history[1].entry_type, "comment");
        assert_eq!(history[2].old_value.as_deref(), Some("open"));
        assert_eq!(history[2].new_value.as_deref(), Some("closed"));
        assert_eq!(history[2].actor, "alice");
    }

    #[test]
    fn native_update_history_only_reports_fields_present_in_patch() {
        let events = json!([{"id":"updated","event_type":"updated","actor":"alice","old_value":"{\"title\":\"Before\",\"status\":\"open\",\"priority\":2,\"description\":\"Keep\"}","new_value":"{\"title\":\"After\"}","created_at":"2026-05-18T00:00:00Z"}]);
        let history = task_history_from_values(events.as_array().unwrap(), &[], &[]);
        assert_eq!(history.len(), 1);
        assert_eq!(history[0].field, "title");
        assert_eq!(history[0].old_value.as_deref(), Some("Before"));
        assert_eq!(history[0].new_value.as_deref(), Some("After"));
    }

    #[test]
    fn native_history_merges_snapshot_gaps_with_audit_status_without_duplicate_transition() {
        let events = json!([{"id":"close","event_type":"closed","actor":"alice","old_value":"{\"status\":\"open\"}","new_value":"{\"status\":\"closed\"}","created_at":"2026-05-19T00:00:00.123Z"}]);
        let snapshots = json!([
            {"CommitHash":"new","Committer":"alice","CommitDate":"2026-05-19T00:00:00Z","Issue":{"status":"closed"}},
            {"CommitHash":"old","Committer":"bob","CommitDate":"2026-05-17T00:00:00Z","Issue":{"status":"open"}}
        ]);
        let history = task_history_from_values(
            events.as_array().unwrap(),
            snapshots.as_array().unwrap(),
            &[],
        );
        assert_eq!(history.len(), 2);
        assert_eq!(history[0].new_value.as_deref(), Some("open"));
        assert_eq!(history[1].id, "event-close-status");
    }
}
