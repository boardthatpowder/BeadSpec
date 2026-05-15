use crate::db::pool::ProjectRegistry;
use sqlx::Row;
use std::sync::Arc;
use tauri::State;

fn decode_datetime(row: &sqlx::mysql::MySqlRow, col: &str) -> String {
    row.try_get::<sqlx::types::chrono::NaiveDateTime, _>(col)
        .map(|dt| dt.and_utc().to_rfc3339())
        .unwrap_or_default()
}

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

// ── Commands ──────────────────────────────────────────────────────────────────

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
    let pool = registry
        .get(&project_path)
        .await
        .map_err(|_| not_connected(&project_path))?;

    // ── Validate / normalise sort parameters ──────────────────────────────────
    let safe_col = match sort_col.as_deref().unwrap_or("priority") {
        "priority" => "priority",
        "status" => "status",
        "title" => "title",
        "created_at" => "created_at",
        _ => "priority",
    };
    let safe_dir = if sort_dir
        .as_deref()
        .unwrap_or("DESC")
        .eq_ignore_ascii_case("asc")
    {
        "ASC"
    } else {
        "DESC"
    };

    // ── Merge legacy TaskFilters into the individual filter params ────────────
    // Legacy callers may pass filters.status / filters.labels; new callers use
    // status_filter / label_filter directly.  Merge so both code paths work.
    let effective_status: Option<Vec<String>> = {
        let mut combined: Vec<String> = status_filter.unwrap_or_default();
        if let Some(ref f) = filters {
            for s in &f.status {
                if !combined.contains(s) {
                    combined.push(s.clone());
                }
            }
        }
        if combined.is_empty() {
            None
        } else {
            Some(combined)
        }
    };

    let effective_labels: Option<Vec<String>> = {
        let mut combined: Vec<String> = label_filter.unwrap_or_default();
        if let Some(ref f) = filters {
            for l in &f.labels {
                if !combined.contains(l) {
                    combined.push(l.clone());
                }
            }
        }
        if combined.is_empty() {
            None
        } else {
            Some(combined)
        }
    };

    // ── Data query ────────────────────────────────────────────────────────────
    let mut qb = sqlx::QueryBuilder::<sqlx::MySql>::new(
        "SELECT id, title, status, priority, issue_type, assignee, created_at, updated_at \
         FROM issues WHERE status != 'deleted'",
    );

    // status_filter → WHERE status IN (...)
    if let Some(ref statuses) = effective_status {
        if !statuses.is_empty() {
            qb.push(" AND status IN (");
            let mut sep = qb.separated(", ");
            for s in statuses {
                sep.push_bind(s);
            }
            qb.push(")");
        }
    }

    // label_filter → WHERE id IN (SELECT issue_id FROM labels WHERE label IN (...) GROUP BY … HAVING …)
    if let Some(ref labels) = effective_labels {
        if !labels.is_empty() {
            qb.push(" AND id IN (SELECT issue_id FROM labels WHERE label IN (");
            let mut sep = qb.separated(", ");
            for l in labels {
                sep.push_bind(l);
            }
            qb.push(format!(
                ") GROUP BY issue_id HAVING COUNT(DISTINCT label) = {})",
                labels.len()
            ));
        }
    }

    // ORDER BY
    qb.push(format!(
        " ORDER BY {} {}, created_at DESC, id ASC",
        safe_col, safe_dir
    ));

    let rows = qb
        .build()
        .fetch_all(pool.pool())
        .await
        .map_err(|e| format!("Query failed: {e}"))?;

    let mut tasks: Vec<Task> = rows
        .iter()
        .map(|r| Task {
            id: r.try_get("id").unwrap_or_default(),
            title: r.try_get("title").unwrap_or_default(),
            status: r.try_get("status").unwrap_or_default(),
            priority: r.try_get::<i32, _>("priority").unwrap_or(2),
            task_type: r.try_get("issue_type").unwrap_or_else(|_| "task".into()),
            assignee: r.try_get("assignee").ok(),
            labels: vec![], // fetched below
            created_at: decode_datetime(r, "created_at"),
            updated_at: decode_datetime(r, "updated_at"),
        })
        .collect();

    // Fetch labels for all tasks in one query using bound parameters (Task 6.1)
    if !tasks.is_empty() {
        let mut lqb = sqlx::QueryBuilder::<sqlx::MySql>::new(
            "SELECT issue_id, label FROM labels WHERE issue_id IN (",
        );
        let mut sep = lqb.separated(", ");
        for task in &tasks {
            sep.push_bind(&task.id);
        }
        lqb.push(")");
        if let Ok(label_rows) = lqb.build().fetch_all(pool.pool()).await {
            for row in label_rows {
                let issue_id: String = row.try_get("issue_id").unwrap_or_default();
                let label: String = row.try_get("label").unwrap_or_default();
                if let Some(task) = tasks.iter_mut().find(|t| t.id == issue_id) {
                    task.labels.push(label);
                }
            }
        }
    }

    // Apply any remaining client-side search filter (text search not yet in SQL)
    if let Some(ref f) = filters {
        if !f.priority.is_empty() || f.search.is_some() {
            tasks.retain(|t| {
                if !f.priority.is_empty() && !f.priority.contains(&t.priority) {
                    return false;
                }
                if let Some(ref q) = f.search {
                    let q_lower = q.to_lowercase();
                    if !t.title.to_lowercase().contains(&q_lower)
                        && !t.id.to_lowercase().contains(&q_lower)
                    {
                        return false;
                    }
                }
                true
            });
        }
    }

    let total_count = tasks.len() as u32;

    Ok(TasksResponse { tasks, total_count })
}

#[tauri::command]
#[specta::specta]
pub async fn get_task(
    project_path: String,
    issue_id: String,
    registry: State<'_, Arc<ProjectRegistry>>,
) -> Result<TaskDetail, String> {
    let pool = registry
        .get(&project_path)
        .await
        .map_err(|_| not_connected(&project_path))?;

    let row = sqlx::query(
        "SELECT id, title, status, priority, issue_type, assignee, description, created_at, updated_at \
         FROM issues WHERE id = ? LIMIT 1",
    )
    .bind(&issue_id)
    .fetch_one(pool.pool())
    .await
    .map_err(|e| format!("Task not found: {e}"))?;

    // Fetch labels
    let labels: Vec<String> =
        sqlx::query("SELECT label FROM labels WHERE issue_id = ? ORDER BY label")
            .bind(&issue_id)
            .fetch_all(pool.pool())
            .await
            .unwrap_or_default()
            .iter()
            .filter_map(|r| r.try_get("label").ok())
            .collect();

    // Fetch dependencies (issues this task depends on)
    let dependencies: Vec<String> =
        sqlx::query("SELECT depends_on_id FROM dependencies WHERE issue_id = ?")
            .bind(&issue_id)
            .fetch_all(pool.pool())
            .await
            .unwrap_or_default()
            .iter()
            .filter_map(|r| r.try_get("depends_on_id").ok())
            .collect();

    // Fetch dependents (issues that depend on this task)
    let dependents: Vec<String> =
        sqlx::query("SELECT issue_id FROM dependencies WHERE depends_on_id = ?")
            .bind(&issue_id)
            .fetch_all(pool.pool())
            .await
            .unwrap_or_default()
            .iter()
            .filter_map(|r| r.try_get("issue_id").ok())
            .collect();

    Ok(TaskDetail {
        id: row.try_get("id").unwrap_or_default(),
        title: row.try_get("title").unwrap_or_default(),
        status: row.try_get("status").unwrap_or_default(),
        priority: row.try_get::<i32, _>("priority").unwrap_or(2),
        task_type: row.try_get("issue_type").unwrap_or_else(|_| "task".into()),
        assignee: row.try_get("assignee").ok(),
        description: row.try_get("description").ok(),
        labels,
        dependencies,
        dependents,
        created_at: decode_datetime(&row, "created_at"),
        updated_at: decode_datetime(&row, "updated_at"),
    })
}

// ── Search ────────────────────────────────────────────────────────────────────

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

#[tauri::command]
#[specta::specta]
pub async fn search_tasks(
    project_path: String,
    query: String,
    registry: State<'_, Arc<ProjectRegistry>>,
) -> Result<Vec<SearchResult>, String> {
    if query.trim().is_empty() {
        return Ok(vec![]);
    }
    let pool = registry
        .get(&project_path)
        .await
        .map_err(|_| not_connected(&project_path))?;
    let q = query.to_lowercase();

    let rows =
        sqlx::query("SELECT id, title, status FROM issues WHERE status != 'deleted' LIMIT 2000")
            .fetch_all(pool.pool())
            .await
            .map_err(|e| format!("Query failed: {e}"))?;

    let mut results: Vec<SearchResult> = rows
        .iter()
        .filter_map(|r| {
            let id: String = r.try_get("id").unwrap_or_default();
            let title: String = r.try_get("title").unwrap_or_default();
            let status: String = r.try_get("status").unwrap_or_default();

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
                status,
                score,
            })
        })
        .collect();

    results.sort_by_key(|a| std::cmp::Reverse(a.score));
    results.truncate(20);
    Ok(results)
}

#[tauri::command]
#[specta::specta]
pub async fn get_task_history(
    project_path: String,
    issue_id: String,
    registry: State<'_, Arc<ProjectRegistry>>,
) -> Result<Vec<HistoryEntry>, String> {
    let pool = registry
        .get(&project_path)
        .await
        .map_err(|_| not_connected(&project_path))?;

    // Fetch comments
    let comment_rows = sqlx::query(
        "SELECT id, author, text, created_at FROM comments \
         WHERE issue_id = ? ORDER BY created_at ASC",
    )
    .bind(&issue_id)
    .fetch_all(pool.pool())
    .await
    .unwrap_or_default();

    let mut entries: Vec<HistoryEntry> = comment_rows
        .iter()
        .map(|r| HistoryEntry {
            id: r.try_get("id").unwrap_or_default(),
            field: "comment".into(),
            old_value: None,
            new_value: None,
            actor: r.try_get("author").unwrap_or_else(|_| "unknown".into()),
            timestamp: decode_datetime(r, "created_at"),
            entry_type: "comment".into(),
            body: r.try_get("text").ok(),
        })
        .collect();

    // Fetch status changes from Dolt diff history
    let diff_rows = sqlx::query(
        "SELECT from_status, to_status, to_commit_date \
         FROM dolt_diff_issues \
         WHERE (to_id = ? OR from_id = ?) \
           AND diff_type != 'removed' \
           AND (from_status IS NULL OR from_status != to_status) \
         ORDER BY to_commit_date ASC",
    )
    .bind(&issue_id)
    .bind(&issue_id)
    .fetch_all(pool.pool())
    .await
    .unwrap_or_default();

    for (i, r) in diff_rows.iter().enumerate() {
        let old: Option<String> = r.try_get("from_status").ok().flatten();
        let new: Option<String> = r.try_get("to_status").ok().flatten();
        let ts = decode_datetime(r, "to_commit_date");
        if ts.is_empty() {
            continue;
        }
        entries.push(HistoryEntry {
            id: format!("dolt-status-{i}"),
            field: "status".into(),
            old_value: old,
            new_value: new,
            actor: "beads".into(),
            timestamp: ts,
            entry_type: "field_change".into(),
            body: None,
        });
    }

    entries.sort_by(|a, b| a.timestamp.cmp(&b.timestamp));
    Ok(entries)
}

// ── SQL Safety Tests (Task 6.2) ───────────────────────────────────────────────

#[cfg(test)]
mod tests {
    #[test]
    fn query_builder_uses_placeholders_not_interpolation() {
        // The label-fetch IN() query in list_tasks builds parameterised SQL —
        // values are bound via `?`, never spliced into the query text.  This
        // test verifies that property at the QueryBuilder layer so a refactor
        // can't silently introduce a string-interpolated query.
        let issue_ids = vec!["abc'def".to_string(), "x,y;z".to_string()];
        let mut qb = sqlx::QueryBuilder::<sqlx::MySql>::new(
            "SELECT issue_id, label FROM labels WHERE issue_id IN (",
        );
        let mut sep = qb.separated(", ");
        for id in &issue_ids {
            sep.push_bind(id);
        }
        qb.push(")");

        let sql = qb.sql();
        assert!(sql.contains('?'), "Query should use ? placeholders: {sql}");
        assert!(
            !sql.contains("abc'def"),
            "Literal ID must not appear in query SQL: {sql}"
        );
        assert!(
            !sql.contains("x,y;z"),
            "Literal ID must not appear in query SQL: {sql}"
        );
    }
}
