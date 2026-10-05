use crate::db::pool::ProjectRegistry;
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

fn worker_findings_from_issues(issues: &[serde_json::Value]) -> Vec<WorkerFinding> {
    let mut findings: Vec<_> = issues
        .iter()
        .filter_map(|issue| {
            let status = issue["status"].as_str().unwrap_or_default();
            let issue_type = issue["issue_type"].as_str().unwrap_or_default();
            if !is_unresolved_worker_finding_row(status, issue_type) {
                return None;
            }
            let provenance = parse_worker_provenance(issue["notes"].as_str().unwrap_or_default())?;
            Some(WorkerFinding {
                issue_id: issue["id"].as_str().unwrap_or_default().to_string(),
                title: issue["title"].as_str().unwrap_or_default().to_string(),
                worker: provenance.worker,
                priority: issue["priority"].as_i64().unwrap_or(2) as i32,
                status: status.to_string(),
                notes_first_line: provenance.notes_first_line,
                created_at: issue["created_at"].as_str().unwrap_or_default().to_string(),
            })
        })
        .collect();
    findings
        .sort_by(|a, b| crate::commands::read::compare_timestamps(&b.created_at, &a.created_at));
    findings
}

#[tauri::command]
#[specta::specta]
pub async fn list_worker_findings(
    project_path: String,
    registry: State<'_, Arc<ProjectRegistry>>,
) -> Result<Vec<WorkerFinding>, String> {
    let source = registry
        .get(&project_path)
        .await
        .map_err(|_| not_connected(&project_path))?;
    Ok(worker_findings_from_issues(&source.list_issues().await?))
}

#[cfg(test)]
mod tests {
    use super::{is_unresolved_worker_finding_row, parse_worker_from_notes};

    #[test]
    fn complete_issue_snapshot_keeps_blocked_worker_findings_and_first_line() {
        let issues = serde_json::json!([
            {"id":"B-closed","status":"closed","issue_type":"bug","notes":"Auto-filed by ruflo-alpha on 2026-05-17"},
            {"id":"B-older","title":"Earlier finding","status":"blocked","issue_type":"bug","priority":1,"notes":"Auto-filed by ruflo-alpha worker on 2026-05-17\nFull notes stay available","created_at":"2026-05-17T00:00:00Z"},
            {"id":"B-newer","title":"Latest finding","status":"open","issue_type":"gate","priority":3,"notes":"Auto-filed by ruflo-test-gap on 2026-05-18\nDetails","created_at":"2026-05-18T00:00:00Z"},
            {"id":"B-unrelated","status":"open","issue_type":"task","notes":"Note: Auto-filed by ruflo-alpha on 2026-05-17"}
        ]);
        let findings = super::worker_findings_from_issues(issues.as_array().unwrap());
        assert_eq!(
            findings
                .iter()
                .map(|f| f.issue_id.as_str())
                .collect::<Vec<_>>(),
            ["B-newer", "B-older"]
        );
        assert_eq!(findings[1].status, "blocked");
        assert_eq!(
            findings[1].notes_first_line,
            "Auto-filed by ruflo-alpha worker on 2026-05-17"
        );
        assert_eq!(findings[0].worker, "test-gap");
    }

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
}
