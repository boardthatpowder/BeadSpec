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

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct WorkerProvenance {
    pub worker: String,
    pub notes_first_line: String,
}

const LIST_WORKER_FINDINGS_SQL: &str =
    "SELECT id, title, priority, status, issue_type, notes, created_at \
     FROM issues \
     WHERE notes LIKE 'Auto-filed by ruflo-%' \
       AND status NOT IN ('closed', 'deleted') \
       AND issue_type != 'deleted' \
     ORDER BY created_at DESC";

fn decode_datetime(row: &sqlx::mysql::MySqlRow, col: &str) -> String {
    row.try_get::<sqlx::types::chrono::NaiveDateTime, _>(col)
        .map(|dt| dt.and_utc().to_rfc3339())
        .unwrap_or_default()
}

fn not_connected(project_path: &str) -> String {
    format!("Project not connected — call connect_project first for '{project_path}'")
}

pub(crate) fn parse_worker_provenance(notes: &str) -> Option<WorkerProvenance> {
    const PREFIX: &str = "Auto-filed by ruflo-";
    const CURRENT_DELIMITER: &str = " worker on ";
    const LEGACY_DELIMITER: &str = " on ";

    let first_line = notes.lines().next()?;
    let rest = first_line.strip_prefix(PREFIX)?;
    let delimiter_index = rest
        .find(CURRENT_DELIMITER)
        .or_else(|| rest.find(LEGACY_DELIMITER))?;
    let worker = &rest[..delimiter_index];

    if worker.is_empty()
        || !worker
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
    {
        return None;
    }

    Some(WorkerProvenance {
        worker: worker.to_string(),
        notes_first_line: first_line.to_string(),
    })
}

#[cfg(test)]
fn parse_worker_from_notes(notes: &str) -> Option<String> {
    parse_worker_provenance(notes).map(|provenance| provenance.worker)
}

pub(crate) fn is_unresolved_worker_finding_row(status: &str, issue_type: &str) -> bool {
    status != "closed" && status != "deleted" && issue_type != "deleted"
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

    let rows = sqlx::query(LIST_WORKER_FINDINGS_SQL)
        .fetch_all(pool.pool())
        .await
        .map_err(|e| format!("Query failed: {e}"))?;

    let findings = rows
        .iter()
        .filter_map(|row| {
            let notes: String = row.try_get("notes").unwrap_or_default();
            let status: String = row.try_get("status").unwrap_or_default();
            let issue_type: String = row.try_get("issue_type").unwrap_or_default();
            if !is_unresolved_worker_finding_row(&status, &issue_type) {
                return None;
            }
            let provenance = parse_worker_provenance(&notes)?;

            Some(WorkerFinding {
                issue_id: row.try_get("id").unwrap_or_default(),
                title: row.try_get("title").unwrap_or_default(),
                worker: provenance.worker,
                priority: row.try_get::<i32, _>("priority").unwrap_or(2),
                status,
                notes_first_line: provenance.notes_first_line,
                created_at: decode_datetime(row, "created_at"),
            })
        })
        .collect();

    Ok(findings)
}

#[cfg(test)]
mod tests {
    use super::{
        is_unresolved_worker_finding_row, parse_worker_from_notes, LIST_WORKER_FINDINGS_SQL,
    };

    #[test]
    fn parse_worker_from_notes_accepts_canonical_prefix() {
        let notes = "Auto-filed by ruflo-alpha worker on 2026-05-17\nSecond line";

        assert_eq!(parse_worker_from_notes(notes), Some("alpha".to_string()));
    }

    #[test]
    fn parse_worker_from_notes_accepts_legacy_prefix_without_worker_marker() {
        let notes = "Auto-filed by ruflo-feature-scanner-7 on 2026-05-17";

        assert_eq!(
            parse_worker_from_notes(notes),
            Some("feature-scanner-7".to_string())
        );
    }

    #[test]
    fn parse_worker_from_notes_accepts_hyphenated_worker_tags() {
        let notes = "Auto-filed by ruflo-test-gap worker on 2026-05-17";

        assert_eq!(parse_worker_from_notes(notes), Some("test-gap".to_string()));
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

    #[test]
    fn worker_finding_row_visibility_includes_blocked_but_excludes_terminal_rows() {
        assert!(is_unresolved_worker_finding_row("open", "bug"));
        assert!(is_unresolved_worker_finding_row("in_progress", "task"));
        assert!(is_unresolved_worker_finding_row("blocked", "bug"));
        assert!(is_unresolved_worker_finding_row("needs_review", "task"));
        assert!(!is_unresolved_worker_finding_row("closed", "bug"));
        assert!(!is_unresolved_worker_finding_row("deleted", "bug"));
        assert!(!is_unresolved_worker_finding_row("open", "deleted"));
    }

    #[test]
    fn list_worker_findings_sql_matches_visibility_contract() {
        assert!(LIST_WORKER_FINDINGS_SQL.contains("notes LIKE 'Auto-filed by ruflo-%'"));
        assert!(LIST_WORKER_FINDINGS_SQL.contains("status NOT IN ('closed', 'deleted')"));
        assert!(LIST_WORKER_FINDINGS_SQL.contains("issue_type != 'deleted'"));
        assert!(LIST_WORKER_FINDINGS_SQL.contains("ORDER BY created_at DESC"));
    }
}
