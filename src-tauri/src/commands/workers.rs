use crate::db::pool::ProjectRegistry;
use sqlx::Row;
use std::sync::Arc;
use tauri::State;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct WorkerFinding {
    pub issue_id: String,
    pub title: String,
    pub worker: String,
    pub priority: i32,
    pub status: String,
    pub notes_first_line: String,
    pub created_at: String,
}

fn decode_datetime(row: &sqlx::mysql::MySqlRow, col: &str) -> String {
    row.try_get::<sqlx::types::chrono::NaiveDateTime, _>(col)
        .map(|dt| dt.and_utc().to_rfc3339())
        .unwrap_or_default()
}

fn not_connected(project_path: &str) -> String {
    format!("Project not connected — call connect_project first for '{project_path}'")
}

fn parse_worker_from_notes(notes: &str) -> Option<String> {
    const PREFIX: &str = "Auto-filed by ruflo-";
    const DELIMITER: &str = " on ";

    let first_line = notes.lines().next()?;
    let rest = first_line.strip_prefix(PREFIX)?;
    let delimiter_index = rest.find(DELIMITER)?;
    let worker = &rest[..delimiter_index];

    if worker.is_empty()
        || !worker
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
    {
        return None;
    }

    Some(worker.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn list_worker_findings(
    project_path: String,
    registry: State<'_, Arc<ProjectRegistry>>,
) -> Result<Vec<WorkerFinding>, String> {
    let pool = registry
        .get(&project_path)
        .await
        .map_err(|_| not_connected(&project_path))?;

    let rows = sqlx::query(
        "SELECT id, title, priority, status, notes, created_at \
         FROM issues \
         WHERE notes LIKE 'Auto-filed by ruflo-%' \
           AND status IN ('open', 'in_progress') \
           AND issue_type != 'deleted' \
         ORDER BY created_at DESC",
    )
    .fetch_all(pool.pool())
    .await
    .map_err(|e| format!("Query failed: {e}"))?;

    let findings = rows
        .iter()
        .filter_map(|row| {
            let notes: String = row.try_get("notes").unwrap_or_default();
            let worker = parse_worker_from_notes(&notes)?;

            Some(WorkerFinding {
                issue_id: row.try_get("id").unwrap_or_default(),
                title: row.try_get("title").unwrap_or_default(),
                worker,
                priority: row.try_get::<i32, _>("priority").unwrap_or(2),
                status: row.try_get("status").unwrap_or_default(),
                notes_first_line: notes.lines().next().unwrap_or_default().to_string(),
                created_at: decode_datetime(row, "created_at"),
            })
        })
        .collect();

    Ok(findings)
}

#[cfg(test)]
mod tests {
    use super::parse_worker_from_notes;

    #[test]
    fn parse_worker_from_notes_accepts_canonical_prefix() {
        let notes = "Auto-filed by ruflo-alpha on 2026-05-17\nSecond line";

        assert_eq!(parse_worker_from_notes(notes), Some("alpha".to_string()));
    }

    #[test]
    fn parse_worker_from_notes_accepts_hyphenated_worker_names() {
        let notes = "Auto-filed by ruflo-feature-scanner-7 on 2026-05-17";

        assert_eq!(
            parse_worker_from_notes(notes),
            Some("feature-scanner-7".to_string())
        );
    }

    #[test]
    fn parse_worker_from_notes_rejects_mid_string_occurrences() {
        let notes = "Note: Auto-filed by ruflo-alpha on 2026-05-17";

        assert_eq!(parse_worker_from_notes(notes), None);
    }

    #[test]
    fn parse_worker_from_notes_rejects_malformed_delimiter() {
        let notes = "Auto-filed by ruflo-alpha on2026-05-17";

        assert_eq!(parse_worker_from_notes(notes), None);
    }

    #[test]
    fn parse_worker_from_notes_rejects_empty_notes() {
        assert_eq!(parse_worker_from_notes(""), None);
    }

    #[test]
    fn parse_worker_from_notes_rejects_invalid_worker_tokens() {
        let notes = "Auto-filed by ruflo-Alpha on 2026-05-17";

        assert_eq!(parse_worker_from_notes(notes), None);
    }
}
