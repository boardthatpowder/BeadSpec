/// Commands for browsing and interacting with OpenSpec change artifacts.
///
/// All paths are resolved relative to the project root stored in `project_path`.
use std::path::Path;
use std::sync::{Arc, Mutex};

use crate::bd::runner::{find_bd, invoke_bd_in_project};
use crate::commands::external::CommandOutput;
use crate::db::dolt_server::DoltServerRegistry;
use crate::db::pool::ProjectRegistry;
use crate::settings::AppSettings;
use sqlx::Row;

// ── Data types ────────────────────────────────────────────────────────────────

/// Metadata for a single OpenSpec change directory.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct ChangeInfo {
    pub name: String,
    /// Canonical slug used for beads label matching (`openspec:<slug>`).
    /// For archived changes the leading `YYYY-MM-DD-` date prefix is stripped.
    pub slug: String,
    pub is_archived: bool,
    pub has_proposal: bool,
    pub has_design: bool,
    pub has_tasks: bool,
    pub last_modified: Option<String>,
    pub specs: Vec<String>,
}

/// Task-completion progress derived from a `tasks.md` file.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct ChangeProgress {
    pub done: u32,
    pub total: u32,
}

/// Beads-import progress for a change. Counts non-feature/non-epic Beads
/// issues carrying the `openspec:<slug>` label across **all** statuses
/// (except `deleted`), so the OpenSpec card stays accurate even when the UI's
/// status filter would hide some of them.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct ChangeBeadsProgress {
    pub done: u32,
    pub total: u32,
    /// ID of the imported epic/feature for this change, if one exists.
    pub epic_id: Option<String>,
}

/// Result from running `openspec validate` against a change.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct ValidationResult {
    pub valid: bool,
    pub errors: Vec<String>,
}

/// Report returned by `reconcile_openspec_checkboxes`.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct SyncReport {
    pub changes_scanned: u32,
    pub lines_flipped: u32,
    pub lines_already_correct: u32,
    pub issues_unmatched: u32,
    pub errors: Vec<String>,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Return the `openspec/changes` directory for `project_path`.
fn changes_dir(project_path: &str) -> std::path::PathBuf {
    Path::new(project_path).join("openspec/changes")
}

/// Return the `openspec/changes/archive` directory for `project_path`.
fn archive_dir(project_path: &str) -> std::path::PathBuf {
    Path::new(project_path).join("openspec/changes/archive")
}

/// Scan `dir/specs/` and return the names of subdirectories that contain a `spec.md`.
fn collect_spec_ids(dir: &Path) -> Vec<String> {
    let specs_dir = dir.join("specs");
    let Ok(entries) = std::fs::read_dir(&specs_dir) else {
        return Vec::new();
    };
    let mut ids: Vec<String> = entries
        .flatten()
        .filter_map(|e| {
            let path = e.path();
            if path.is_dir() && path.join("spec.md").exists() {
                path.file_name()?.to_str().map(|s| s.to_string())
            } else {
                None
            }
        })
        .collect();
    ids.sort();
    ids
}

/// Strip a leading `YYYY-MM-DD-` prefix from an archived change directory name,
/// returning the canonical slug used for beads label matching.
fn strip_date_prefix(name: &str) -> String {
    let bytes = name.as_bytes();
    let is_date_prefix = bytes.len() > 11
        && bytes[0..4].iter().all(|b| b.is_ascii_digit())
        && bytes[4] == b'-'
        && bytes[5..7].iter().all(|b| b.is_ascii_digit())
        && bytes[7] == b'-'
        && bytes[8..10].iter().all(|b| b.is_ascii_digit())
        && bytes[10] == b'-';
    if is_date_prefix {
        name[11..].to_string()
    } else {
        name.to_string()
    }
}

/// Collect `ChangeInfo` for a single directory entry (active or archived).
fn change_info_for_dir(dir: &Path, is_archived: bool) -> Option<ChangeInfo> {
    if !dir.is_dir() {
        return None;
    }
    let name = dir.file_name()?.to_str()?.to_string();

    let has_proposal = dir.join("proposal.md").exists();
    let has_design = dir.join("design.md").exists();
    let has_tasks = dir.join("tasks.md").exists();

    // Collect spec IDs: subdirs of specs/ that contain a spec.md file.
    let specs = collect_spec_ids(dir);

    // Use the most recently modified of the three artifact files for
    // `last_modified`, expressed as an ISO-8601-like string.
    let last_modified = ["proposal.md", "design.md", "tasks.md"]
        .iter()
        .filter_map(|f| {
            let path = dir.join(f);
            path.metadata()
                .ok()
                .and_then(|m| m.modified().ok())
                .map(|t| {
                    // Convert to seconds-since-epoch string (no chrono dep)
                    let dur = t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
                    dur.as_secs()
                })
        })
        .max()
        .map(|secs| secs.to_string());

    let slug = if is_archived {
        strip_date_prefix(&name)
    } else {
        name.clone()
    };

    Some(ChangeInfo {
        name,
        slug,
        is_archived,
        has_proposal,
        has_design,
        has_tasks,
        last_modified,
        specs,
    })
}

/// Extract a `N.M` dotted-decimal prefix from a string (e.g. a Beads issue title like "3.1 some text").
/// Returns `None` if the string doesn't start with a dotted-decimal prefix followed by a space.
fn extract_task_num(s: &str) -> Option<String> {
    let dot = s.find('.')?;
    if dot == 0 || !s[..dot].bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    let after = &s[dot + 1..];
    let num_end = after
        .find(|c: char| !c.is_ascii_digit())
        .unwrap_or(after.len());
    if num_end == 0 {
        return None;
    }
    let follows = &after[num_end..];
    if !follows.is_empty() && !follows.starts_with(' ') {
        return None;
    }
    Some(s[..dot + 1 + num_end].to_string())
}

/// Parse a `tasks.md` checkbox line and return `(is_checked, task_num)`.
/// Returns `None` for section headers, non-checkbox lines, or lines without a `N.M` prefix.
fn parse_task_line(line: &str) -> Option<(bool, String)> {
    let t = line.trim_start();
    if t.len() < 6 || !t.starts_with("- [") || &t[4..6] != "] " {
        return None;
    }
    let checked = matches!(t.as_bytes()[3], b'x' | b'X');
    extract_task_num(&t[6..]).map(|n| (checked, n))
}

/// Parse `tasks.md` and count checkbox lines.
/// Matches lines of the form `- [ ] ...` (open) or `- [x] ...` / `- [X] ...` (done).
fn parse_progress(tasks_md: &str) -> ChangeProgress {
    let mut total: u32 = 0;
    let mut done: u32 = 0;
    for line in tasks_md.lines() {
        let trimmed = line.trim_start();
        if trimmed.starts_with("- [") && trimmed.len() >= 6 {
            let marker = &trimmed[3..4]; // the character between the brackets
            total += 1;
            if marker == "x" || marker == "X" {
                done += 1;
            }
        }
    }
    ChangeProgress { done, total }
}

// ── Commands ──────────────────────────────────────────────────────────────────

/// List all OpenSpec changes (active and archived) for the given project.
#[tauri::command]
#[specta::specta]
pub async fn list_changes(project_path: String) -> Result<Vec<ChangeInfo>, String> {
    let base = changes_dir(&project_path);
    let arch = archive_dir(&project_path);

    let mut results: Vec<ChangeInfo> = Vec::new();

    // Active changes — direct subdirs of openspec/changes/ (skip "archive")
    if let Ok(entries) = std::fs::read_dir(&base) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                if name == "archive" {
                    continue;
                }
                if let Some(info) = change_info_for_dir(&path, false) {
                    results.push(info);
                }
            }
        }
    }

    // Archived changes — subdirs of openspec/changes/archive/
    if arch.is_dir() {
        if let Ok(entries) = std::fs::read_dir(&arch) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    if let Some(info) = change_info_for_dir(&path, true) {
                        results.push(info);
                    }
                }
            }
        }
    }

    // Sort: active before archived, then alphabetically
    results.sort_by(|a, b| a.is_archived.cmp(&b.is_archived).then(a.name.cmp(&b.name)));

    Ok(results)
}

/// Read the raw content of a specific artifact file within a change directory.
///
/// `artifact` may be a simple filename (`"proposal.md"`) or a nested path
/// (`"specs/task-workspace/spec.md"`). Returns an error string if the file
/// cannot be read or if the resolved path escapes the change directory.
#[tauri::command]
#[specta::specta]
pub async fn read_change_artifact(
    project_path: String,
    change: String,
    artifact: String,
) -> Result<String, String> {
    // Resolve the change directory (active or archived)
    let active_change_dir = changes_dir(&project_path).join(&change);
    let archive_change_dir = archive_dir(&project_path).join(&change);

    let active_path = active_change_dir.join(&artifact);
    let archive_path = archive_change_dir.join(&artifact);

    let (path, change_dir) = if active_path.exists() {
        (active_path, active_change_dir)
    } else if archive_path.exists() {
        (archive_path, archive_change_dir)
    } else {
        return Err(format!(
            "Artifact '{artifact}' not found for change '{change}' in project '{project_path}'"
        ));
    };

    // Security: prevent directory traversal by ensuring the resolved path
    // stays within the change directory.
    let canonical_change = change_dir
        .canonicalize()
        .map_err(|e| format!("Cannot resolve change dir: {e}"))?;
    let canonical_full = path
        .canonicalize()
        .map_err(|e| format!("Cannot resolve artifact path: {e}"))?;
    if !canonical_full.starts_with(&canonical_change) {
        return Err("path traversal denied".to_string());
    }

    std::fs::read_to_string(&canonical_full).map_err(|e| format!("Failed to read artifact: {e}"))
}

/// Count done/total checkboxes in a change's `tasks.md`.
#[tauri::command]
#[specta::specta]
pub async fn get_change_progress(
    project_path: String,
    change: String,
) -> Result<ChangeProgress, String> {
    let content = read_change_artifact(project_path, change, "tasks.md".into()).await?;
    Ok(parse_progress(&content))
}

/// Count Beads issues tagged `openspec:<slug>` for this change, regardless of
/// any UI-level status filter. Returns `done` (closed non-feature/non-epic
/// tasks), `total` (all non-feature/non-epic tasks), and `epic_id` (the single
/// feature/epic-typed issue, if present).
#[tauri::command]
#[specta::specta]
pub async fn get_change_beads_progress(
    project_path: String,
    change_slug: String,
    registry: tauri::State<'_, Arc<ProjectRegistry>>,
) -> Result<ChangeBeadsProgress, String> {
    let pool = registry.get(&project_path).await.map_err(|_| {
        format!("Project not connected — call connect_project first for '{project_path}'")
    })?;

    let label = format!("openspec:{change_slug}");

    let rows = sqlx::query(
        "SELECT i.id, i.issue_type, i.status \
         FROM issues i \
         JOIN labels l ON l.issue_id = i.id \
         WHERE l.label = ? AND i.status != 'deleted'",
    )
    .bind(&label)
    .fetch_all(pool.pool())
    .await
    .map_err(|e| format!("Query failed: {e}"))?;

    let mut total: u32 = 0;
    let mut done: u32 = 0;
    let mut epic_id: Option<String> = None;

    for row in rows {
        let id: String = row.try_get("id").unwrap_or_default();
        let issue_type: String = row.try_get("issue_type").unwrap_or_default();
        let status: String = row.try_get("status").unwrap_or_default();

        if issue_type == "feature" || issue_type == "epic" {
            if epic_id.is_none() {
                epic_id = Some(id);
            }
        } else {
            total = total.saturating_add(1);
            if status == "closed" {
                done = done.saturating_add(1);
            }
        }
    }

    Ok(ChangeBeadsProgress {
        done,
        total,
        epic_id,
    })
}

/// Run `openspec validate <change>` via the `ruflo` CLI and parse the output.
#[tauri::command]
#[specta::specta]
pub async fn run_openspec_validate(
    project_path: String,
    change: String,
    settings: tauri::State<'_, Arc<Mutex<AppSettings>>>,
) -> Result<ValidationResult, String> {
    use crate::commands::external::run_ruflo_inner;
    let ruflo_path = settings.lock().unwrap().binary_paths.ruflo.clone();
    let output = run_ruflo_inner(
        project_path,
        vec!["openspec".into(), "validate".into(), change],
        &ruflo_path,
    )
    .await?;

    if output.exit_code == 0 {
        return Ok(ValidationResult {
            valid: true,
            errors: vec![],
        });
    }

    // Parse error lines from stderr / stdout
    let combined = format!("{}\n{}", output.stdout, output.stderr);
    let errors: Vec<String> = combined
        .lines()
        .filter(|l| !l.trim().is_empty())
        .map(|l| l.to_string())
        .collect();

    Ok(ValidationResult {
        valid: false,
        errors,
    })
}

/// Shell out to `openspec-beads-import <change>` to import a change into Beads.
#[tauri::command]
#[specta::specta]
pub async fn import_change_to_beads(
    project_path: String,
    change: String,
    settings: tauri::State<'_, Arc<Mutex<AppSettings>>>,
) -> Result<CommandOutput, String> {
    use crate::commands::external::run_ruflo_inner;
    let ruflo_path = settings.lock().unwrap().binary_paths.ruflo.clone();
    run_ruflo_inner(
        project_path,
        vec!["openspec-beads-import".into(), change],
        &ruflo_path,
    )
    .await
}

// ── Checkbox sync ─────────────────────────────────────────────────────────────

/// Reconcile every active OpenSpec change's `tasks.md` against Beads issue status.
///
/// For each active change that has issues tagged `openspec:<change-id>`, flip the
/// matching `- [ ]`/`- [x]` checkbox to reflect the current bd status:
/// `closed → [x]`, anything else → `[ ]`.
/// Lines that have no backing bd issue are left unchanged.
/// This function never returns an error — failures are collected in `SyncReport::errors`.
pub async fn reconcile_tasks_checkboxes(
    project_path: &str,
    bd_path: &std::path::Path,
    server_registry: &DoltServerRegistry,
    dolt_path_override: &str,
) -> SyncReport {
    let mut report = SyncReport {
        changes_scanned: 0_u32,
        lines_flipped: 0_u32,
        lines_already_correct: 0_u32,
        issues_unmatched: 0_u32,
        errors: vec![],
    };

    let base = changes_dir(project_path);
    let change_slugs: Vec<String> = match std::fs::read_dir(&base) {
        Err(_) => return report,
        Ok(entries) => entries
            .flatten()
            .filter_map(|e| {
                let path = e.path();
                if !path.is_dir() {
                    return None;
                }
                let name = path.file_name()?.to_str()?.to_string();
                if name == "archive" {
                    None
                } else {
                    Some(name)
                }
            })
            .collect(),
    };

    for change_id in &change_slugs {
        report.changes_scanned = report.changes_scanned.saturating_add(1);

        // Query bd for all issues tagged with this change.
        let label_arg = format!("--label=openspec:{change_id}");
        let json_out = match invoke_bd_in_project(
            bd_path,
            &["list", &label_arg, "--json"],
            project_path,
            server_registry,
            dolt_path_override,
            std::time::Duration::from_secs(10),
        )
        .await
        {
            Ok(s) => s,
            Err(e) => {
                report
                    .errors
                    .push(format!("{change_id}: bd list failed: {e}"));
                continue;
            }
        };

        let issues: Vec<serde_json::Value> = serde_json::from_str(&json_out).unwrap_or_default();

        // Build task_num → is_closed map from issue titles.
        let mut status_map: std::collections::HashMap<String, bool> =
            std::collections::HashMap::new();
        for issue in &issues {
            let title = issue["title"].as_str().unwrap_or("");
            let status = issue["status"].as_str().unwrap_or("");
            if let Some(num) = extract_task_num(title) {
                status_map.insert(num, status == "closed");
            } else {
                report.issues_unmatched = report.issues_unmatched.saturating_add(1);
            }
        }

        // Read tasks.md; skip if missing (e.g. change was archived mid-session).
        let tasks_path = base.join(change_id).join("tasks.md");
        if !tasks_path.exists() {
            continue;
        }
        let content = match std::fs::read_to_string(&tasks_path) {
            Ok(c) => c,
            Err(e) => {
                report
                    .errors
                    .push(format!("{change_id}/tasks.md: read failed: {e}"));
                continue;
            }
        };

        // Walk lines; flip checkboxes where bd status disagrees.
        let mut new_lines: Vec<String> = Vec::with_capacity(content.lines().count() + 1);
        let mut changed = false;

        for line in content.lines() {
            if let Some((is_checked, num)) = parse_task_line(line) {
                if let Some(&is_closed) = status_map.get(&num) {
                    if is_checked == is_closed {
                        report.lines_already_correct =
                            report.lines_already_correct.saturating_add(1);
                        new_lines.push(line.to_string());
                    } else {
                        // Splice the new marker in place.
                        let leading = line.len() - line.trim_start().len();
                        let marker_byte_pos = leading + 3;
                        let mut bytes = line.as_bytes().to_vec();
                        bytes[marker_byte_pos] = if is_closed { b'x' } else { b' ' };
                        new_lines
                            .push(String::from_utf8(bytes).unwrap_or_else(|_| line.to_string()));
                        report.lines_flipped = report.lines_flipped.saturating_add(1);
                        changed = true;
                    }
                } else {
                    // No bd issue for this row — leave unchanged.
                    new_lines.push(line.to_string());
                }
            } else {
                new_lines.push(line.to_string());
            }
        }

        if changed {
            let mut new_content = new_lines.join("\n");
            if content.ends_with('\n') {
                new_content.push('\n');
            }
            // Atomic-ish write: temp file + rename avoids writing a partial file into the watcher path.
            let tmp_path = base.join(change_id).join("tasks.md.tmp");
            if let Err(e) = std::fs::write(&tmp_path, &new_content) {
                report
                    .errors
                    .push(format!("{change_id}/tasks.md: write failed: {e}"));
            } else if let Err(e) = std::fs::rename(&tmp_path, &tasks_path) {
                report
                    .errors
                    .push(format!("{change_id}/tasks.md: rename failed: {e}"));
                let _ = std::fs::remove_file(&tmp_path);
            }
        }
    }

    report
}

/// Manually trigger `tasks.md` checkbox reconciliation for all active OpenSpec changes.
#[tauri::command]
#[specta::specta]
pub async fn reconcile_openspec_checkboxes(
    project_path: String,
    settings: tauri::State<'_, Arc<Mutex<AppSettings>>>,
    server_registry: tauri::State<'_, Arc<DoltServerRegistry>>,
) -> Result<SyncReport, String> {
    let (bd_path_override, dolt_path_override) = {
        let guard = settings.lock().unwrap();
        (
            guard.binary_paths.bd.clone(),
            guard.binary_paths.dolt.clone(),
        )
    };
    let bd = find_bd(&bd_path_override).ok_or_else(|| "bd CLI not found".to_string())?;
    Ok(reconcile_tasks_checkboxes(&project_path, &bd, &server_registry, &dolt_path_override).await)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_progress_counts_checkboxes() {
        let md = "\
# Tasks
- [ ] First task
- [x] Done task
- [X] Also done
- not a checkbox
- [ ] Another open
";
        let p = parse_progress(md);
        assert_eq!(p.total, 4);
        assert_eq!(p.done, 2);
    }

    #[test]
    fn parse_progress_empty() {
        let p = parse_progress("# No tasks here\n");
        assert_eq!(p.total, 0);
        assert_eq!(p.done, 0);
    }

    #[test]
    fn strip_date_prefix_with_date() {
        assert_eq!(
            strip_date_prefix("2026-05-11-app-refresh-settings"),
            "app-refresh-settings"
        );
    }

    #[test]
    fn strip_date_prefix_bare_slug() {
        assert_eq!(
            strip_date_prefix("description-markdown-editor"),
            "description-markdown-editor"
        );
    }

    #[test]
    fn strip_date_prefix_dashes_but_not_date() {
        assert_eq!(strip_date_prefix("not-a-date-prefix"), "not-a-date-prefix");
    }

    #[test]
    fn strip_date_prefix_empty() {
        assert_eq!(strip_date_prefix(""), "");
    }

    #[test]
    fn extract_task_num_valid() {
        assert_eq!(extract_task_num("3.1 some text"), Some("3.1".into()));
        assert_eq!(extract_task_num("10.2 another task"), Some("10.2".into()));
        assert_eq!(extract_task_num("1.1"), Some("1.1".into()));
    }

    #[test]
    fn extract_task_num_invalid() {
        assert_eq!(extract_task_num("no number here"), None);
        assert_eq!(extract_task_num(".1 starts with dot"), None);
        assert_eq!(extract_task_num("1. trailing dot only"), None);
        assert_eq!(extract_task_num("some 3.1 mid-title"), None);
    }

    #[test]
    fn parse_task_line_checked() {
        assert_eq!(
            parse_task_line("- [x] 3.1 cargo build"),
            Some((true, "3.1".into()))
        );
        assert_eq!(
            parse_task_line("- [X] 1.1 Install radix"),
            Some((true, "1.1".into()))
        );
    }

    #[test]
    fn parse_task_line_unchecked() {
        assert_eq!(
            parse_task_line("- [ ] 2.1 Add setting"),
            Some((false, "2.1".into()))
        );
    }

    #[test]
    fn parse_task_line_no_num_prefix() {
        assert_eq!(parse_task_line("- [ ] Task without number"), None);
        assert_eq!(parse_task_line("- [x] Done without number"), None);
    }

    #[test]
    fn parse_task_line_non_checkbox() {
        assert_eq!(parse_task_line("## Section header"), None);
        assert_eq!(parse_task_line("Some plain text"), None);
        assert_eq!(parse_task_line(""), None);
    }
}
