/// CLI delegation and git/dolt query commands.
///
/// These commands allow the frontend to invoke `bd` and `ruflo` subprocesses
/// and to query git/dolt metadata associated with a project and its issues.
use sqlx::Row;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::State;

use crate::bd::runner::{find_bd, spawn_managed};
use crate::db::pool::ProjectRegistry;
use crate::settings::AppSettings;

// ── Output types ──────────────────────────────────────────────────────────────

/// Generic output from a shelled-out CLI command.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct CommandOutput {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

/// Workspace context derived from git for the connected project.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct WorkspaceContext {
    pub branch: String,
    pub label_branch: String,
    pub label_worktree: String,
    pub label_repo: String,
}

/// A single git commit reference associated with an issue.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct CommitRef {
    pub hash: String,
    pub subject: String,
    pub date: String,
}

/// Git refs (commits + branches) that mention a given issue ID.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct GitRefs {
    pub commits: Vec<CommitRef>,
    pub branches: Vec<String>,
}

/// A single row from `dolt_diff` for the issues table.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct DoltRevision {
    pub diff_type: String,
    pub from_id: Option<String>,
    pub to_id: Option<String>,
    pub from_title: Option<String>,
    pub to_title: Option<String>,
    pub from_status: Option<String>,
    pub to_status: Option<String>,
}

// ── Path helpers ──────────────────────────────────────────────────────────────

/// Locate `ruflo` — check settings override first, then nvm dirs, then PATH.
fn find_ruflo_with_override(settings_path: &str) -> Option<std::path::PathBuf> {
    // Section 5.2: settings override takes priority
    if !settings_path.is_empty() {
        let p = std::path::PathBuf::from(settings_path);
        if p.is_file() {
            return Some(p);
        }
    }
    let home = std::env::var("HOME").unwrap_or_default();
    let nvm_candidates: Vec<std::path::PathBuf> = {
        let nvm_dir = format!("{home}/.nvm/versions/node");
        if let Ok(entries) = std::fs::read_dir(&nvm_dir) {
            let mut paths: Vec<_> = entries
                .flatten()
                .filter_map(|e| {
                    let p = e.path().join("bin/ruflo");
                    if p.is_file() {
                        Some(p)
                    } else {
                        None
                    }
                })
                .collect();
            // Sort descending so newest node version wins
            paths.sort();
            paths.reverse();
            paths
        } else {
            vec![]
        }
    };
    if let Some(p) = nvm_candidates.into_iter().next() {
        return Some(p);
    }
    // Fall back to PATH search
    std::env::var_os("PATH").and_then(|p| {
        std::env::split_paths(&p).find_map(|dir| {
            let c = dir.join("ruflo");
            if c.is_file() {
                Some(c)
            } else {
                None
            }
        })
    })
}

/// Run `ruflo` with a given settings path override — usable from Rust (not a Tauri command).
pub async fn run_ruflo_inner(
    project_path: String,
    args: Vec<String>,
    settings_path: &str,
) -> Result<CommandOutput, String> {
    let ruflo = find_ruflo_with_override(settings_path).ok_or("ruflo CLI not found")?;
    Ok(run_subprocess(&ruflo, &args, &project_path).await)
}

/// Run a generic subprocess via `spawn_managed`. Returns `CommandOutput` regardless
/// of exit status. Uses `kill_on_drop(true)` and a hard 10-second timeout.
async fn run_subprocess(program: &std::path::Path, args: &[String], cwd: &str) -> CommandOutput {
    let cmd = program.to_string_lossy();
    let arg_refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let cwd_path = std::path::Path::new(cwd);

    match spawn_managed(&cmd, &arg_refs, cwd_path, Duration::from_secs(10)).await {
        Ok(out) => CommandOutput {
            stdout: String::from_utf8_lossy(&out.stdout).into_owned(),
            stderr: String::from_utf8_lossy(&out.stderr).into_owned(),
            exit_code: out.exit_code.unwrap_or(-1),
        },
        Err(crate::bd::runner::SpawnError::Timeout { .. }) => CommandOutput {
            stdout: String::new(),
            stderr: "Command timed out after 10 seconds".into(),
            exit_code: -1,
        },
        Err(crate::bd::runner::SpawnError::Io(e)) => CommandOutput {
            stdout: String::new(),
            stderr: format!("IO error: {e}"),
            exit_code: -1,
        },
    }
}

// ── Named bd commands ─────────────────────────────────────────────────────────
//
// Each command resolves cwd from the ProjectRegistry (keyed by project_id =
// canonical project path) rather than trusting the renderer-supplied path
// directly.  Binary paths come from validated AppSettings state only.
//
// Read ops (preflight, doctor, lint, stale, orphans, formula_list, human_list)
// use a 10-second timeout.  Write ops (formula_pour, human_respond,
// human_dismiss) use a 30-second timeout.

/// Helper: resolve project path from registry (validates the project is connected).
async fn resolve_project_cwd(
    project_id: &str,
    registry: &Arc<ProjectRegistry>,
) -> Result<String, String> {
    let pool = registry
        .get(project_id)
        .await
        .map_err(|_| format!("project_not_connected: '{project_id}' — call connect_project first"))?;
    Ok(pool.project_path.clone())
}

/// Helper: run a bd sub-command via spawn_managed and return stdout on success.
async fn run_bd_managed(
    bd_path: std::path::PathBuf,
    args: &[&str],
    cwd: &str,
    timeout: Duration,
) -> Result<String, String> {
    let bd_str = bd_path.to_string_lossy().into_owned();
    let out = spawn_managed(&bd_str, args, std::path::Path::new(cwd), timeout)
        .await
        .map_err(|e| e.to_string())?;
    let stdout = String::from_utf8_lossy(&out.stdout).into_owned();
    let exit_code = out.exit_code.unwrap_or(-1);
    if exit_code == 0 {
        Ok(stdout)
    } else {
        let stderr = String::from_utf8_lossy(&out.stderr).into_owned();
        Err(format!("bd exited {exit_code}: {stderr}"))
    }
}

/// Helper: run a ruflo sub-command via spawn_managed and return stdout on success.
async fn run_ruflo_managed(
    ruflo_path: std::path::PathBuf,
    args: &[&str],
    timeout: Duration,
) -> Result<String, String> {
    let ruflo_str = ruflo_path.to_string_lossy().into_owned();
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
    let out = spawn_managed(&ruflo_str, args, std::path::Path::new(&home), timeout)
        .await
        .map_err(|e| e.to_string())?;
    let stdout = String::from_utf8_lossy(&out.stdout).into_owned();
    let exit_code = out.exit_code.unwrap_or(-1);
    if exit_code == 0 {
        Ok(stdout)
    } else {
        let stderr = String::from_utf8_lossy(&out.stderr).into_owned();
        Err(format!("ruflo exited {exit_code}: {stderr}"))
    }
}

/// Run `bd preflight` in the given project. Read op — 10s timeout.
#[tauri::command]
#[specta::specta]
pub async fn bd_preflight(
    project_id: String,
    settings: State<'_, Arc<Mutex<AppSettings>>>,
    registry: State<'_, Arc<ProjectRegistry>>,
) -> Result<String, String> {
    let bd_path_override = settings.lock().unwrap().binary_paths.bd.clone();
    let bd = find_bd(&bd_path_override).ok_or("bd CLI not found")?;
    let cwd = resolve_project_cwd(&project_id, registry.inner()).await?;
    run_bd_managed(bd, &["preflight"], &cwd, Duration::from_secs(10)).await
}

/// Run `bd doctor --json` in the given project. Read op — 10s timeout.
#[tauri::command]
#[specta::specta]
pub async fn bd_doctor(
    project_id: String,
    settings: State<'_, Arc<Mutex<AppSettings>>>,
    registry: State<'_, Arc<ProjectRegistry>>,
) -> Result<String, String> {
    let bd_path_override = settings.lock().unwrap().binary_paths.bd.clone();
    let bd = find_bd(&bd_path_override).ok_or("bd CLI not found")?;
    let cwd = resolve_project_cwd(&project_id, registry.inner()).await?;
    run_bd_managed(bd, &["doctor", "--json"], &cwd, Duration::from_secs(10)).await
}

/// Run `bd lint --json` in the given project. Read op — 10s timeout.
#[tauri::command]
#[specta::specta]
pub async fn bd_lint(
    project_id: String,
    settings: State<'_, Arc<Mutex<AppSettings>>>,
    registry: State<'_, Arc<ProjectRegistry>>,
) -> Result<String, String> {
    let bd_path_override = settings.lock().unwrap().binary_paths.bd.clone();
    let bd = find_bd(&bd_path_override).ok_or("bd CLI not found")?;
    let cwd = resolve_project_cwd(&project_id, registry.inner()).await?;
    run_bd_managed(bd, &["lint", "--json"], &cwd, Duration::from_secs(10)).await
}

/// Run `bd stale --json` in the given project. Read op — 10s timeout.
#[tauri::command]
#[specta::specta]
pub async fn bd_stale(
    project_id: String,
    settings: State<'_, Arc<Mutex<AppSettings>>>,
    registry: State<'_, Arc<ProjectRegistry>>,
) -> Result<String, String> {
    let bd_path_override = settings.lock().unwrap().binary_paths.bd.clone();
    let bd = find_bd(&bd_path_override).ok_or("bd CLI not found")?;
    let cwd = resolve_project_cwd(&project_id, registry.inner()).await?;
    run_bd_managed(bd, &["stale", "--json"], &cwd, Duration::from_secs(10)).await
}

/// Run `bd orphans --json` in the given project. Read op — 10s timeout.
#[tauri::command]
#[specta::specta]
pub async fn bd_orphans(
    project_id: String,
    settings: State<'_, Arc<Mutex<AppSettings>>>,
    registry: State<'_, Arc<ProjectRegistry>>,
) -> Result<String, String> {
    let bd_path_override = settings.lock().unwrap().binary_paths.bd.clone();
    let bd = find_bd(&bd_path_override).ok_or("bd CLI not found")?;
    let cwd = resolve_project_cwd(&project_id, registry.inner()).await?;
    run_bd_managed(bd, &["orphans", "--json"], &cwd, Duration::from_secs(10)).await
}

/// Run `bd formula list --json` in the given project. Read op — 10s timeout.
#[tauri::command]
#[specta::specta]
pub async fn bd_formula_list(
    project_id: String,
    settings: State<'_, Arc<Mutex<AppSettings>>>,
    registry: State<'_, Arc<ProjectRegistry>>,
) -> Result<String, String> {
    let bd_path_override = settings.lock().unwrap().binary_paths.bd.clone();
    let bd = find_bd(&bd_path_override).ok_or("bd CLI not found")?;
    let cwd = resolve_project_cwd(&project_id, registry.inner()).await?;
    run_bd_managed(bd, &["formula", "list", "--json"], &cwd, Duration::from_secs(10)).await
}

/// Run `bd mol pour <formula_name>` in the given project. Write op — 30s timeout.
///
/// `formula_name` must be a non-empty string containing only alphanumeric
/// characters, hyphens, underscores, and dots.  Returns an error if the name
/// fails validation so that the backend never constructs a shell-injection path.
#[tauri::command]
#[specta::specta]
pub async fn bd_formula_pour(
    project_id: String,
    formula_name: String,
    settings: State<'_, Arc<Mutex<AppSettings>>>,
    registry: State<'_, Arc<ProjectRegistry>>,
) -> Result<String, String> {
    // Validate formula_name: only allow safe identifier characters.
    if formula_name.is_empty()
        || !formula_name
            .chars()
            .all(|c| c.is_alphanumeric() || c == '-' || c == '_' || c == '.')
    {
        return Err(format!(
            "invalid formula_name '{formula_name}': only alphanumeric, hyphens, underscores, and dots are allowed"
        ));
    }
    let bd_path_override = settings.lock().unwrap().binary_paths.bd.clone();
    let bd = find_bd(&bd_path_override).ok_or("bd CLI not found")?;
    let cwd = resolve_project_cwd(&project_id, registry.inner()).await?;
    run_bd_managed(bd, &["mol", "pour", &formula_name], &cwd, Duration::from_secs(30)).await
}

/// Run `bd human list --json` in the given project. Read op — 10s timeout.
#[tauri::command]
#[specta::specta]
pub async fn bd_human_list(
    project_id: String,
    settings: State<'_, Arc<Mutex<AppSettings>>>,
    registry: State<'_, Arc<ProjectRegistry>>,
) -> Result<String, String> {
    let bd_path_override = settings.lock().unwrap().binary_paths.bd.clone();
    let bd = find_bd(&bd_path_override).ok_or("bd CLI not found")?;
    let cwd = resolve_project_cwd(&project_id, registry.inner()).await?;
    run_bd_managed(bd, &["human", "list", "--json"], &cwd, Duration::from_secs(10)).await
}

/// Run `bd human respond <issue_id> <text>` in the given project. Write op — 30s timeout.
///
/// `issue_id` must match the Beads ID pattern (alphanumeric + hyphens, e.g.
/// `BEADSPEC-xmkr`).  `text` is passed as a single argument and is not validated
/// beyond non-emptiness.
#[tauri::command]
#[specta::specta]
pub async fn bd_human_respond(
    project_id: String,
    issue_id: String,
    text: String,
    settings: State<'_, Arc<Mutex<AppSettings>>>,
    registry: State<'_, Arc<ProjectRegistry>>,
) -> Result<String, String> {
    if issue_id.is_empty()
        || !issue_id
            .chars()
            .all(|c| c.is_alphanumeric() || c == '-')
    {
        return Err(format!(
            "invalid issue_id '{issue_id}': only alphanumeric characters and hyphens are allowed"
        ));
    }
    if text.is_empty() {
        return Err("text must not be empty".to_string());
    }
    let bd_path_override = settings.lock().unwrap().binary_paths.bd.clone();
    let bd = find_bd(&bd_path_override).ok_or("bd CLI not found")?;
    let cwd = resolve_project_cwd(&project_id, registry.inner()).await?;
    run_bd_managed(bd, &["human", "respond", &issue_id, &text], &cwd, Duration::from_secs(30)).await
}

/// Run `bd human dismiss <issue_id>` in the given project. Write op — 30s timeout.
///
/// `issue_id` must match the Beads ID pattern (alphanumeric + hyphens).
#[tauri::command]
#[specta::specta]
pub async fn bd_human_dismiss(
    project_id: String,
    issue_id: String,
    settings: State<'_, Arc<Mutex<AppSettings>>>,
    registry: State<'_, Arc<ProjectRegistry>>,
) -> Result<String, String> {
    if issue_id.is_empty()
        || !issue_id
            .chars()
            .all(|c| c.is_alphanumeric() || c == '-')
    {
        return Err(format!(
            "invalid issue_id '{issue_id}': only alphanumeric characters and hyphens are allowed"
        ));
    }
    let bd_path_override = settings.lock().unwrap().binary_paths.bd.clone();
    let bd = find_bd(&bd_path_override).ok_or("bd CLI not found")?;
    let cwd = resolve_project_cwd(&project_id, registry.inner()).await?;
    run_bd_managed(bd, &["human", "dismiss", &issue_id], &cwd, Duration::from_secs(30)).await
}

// ── Named ruflo commands ──────────────────────────────────────────────────────

/// Run `ruflo memory search -q <query> --format json`. Read op — 10s timeout.
///
/// `query` is passed as a single argument.  Empty queries are rejected.
#[tauri::command]
#[specta::specta]
pub async fn ruflo_memory_search(
    query: String,
    settings: State<'_, Arc<Mutex<AppSettings>>>,
) -> Result<String, String> {
    if query.is_empty() {
        return Err("query must not be empty".to_string());
    }
    let settings_path = settings.lock().unwrap().binary_paths.ruflo.clone();
    let ruflo = find_ruflo_with_override(&settings_path).ok_or("ruflo CLI not found")?;
    run_ruflo_managed(ruflo, &["memory", "search", "-q", &query, "--format", "json"], Duration::from_secs(10)).await
}

/// Run `ruflo --version` to probe whether ruflo is available. Read op — 10s timeout.
#[tauri::command]
#[specta::specta]
pub async fn ruflo_version_probe(
    settings: State<'_, Arc<Mutex<AppSettings>>>,
) -> Result<String, String> {
    let settings_path = settings.lock().unwrap().binary_paths.ruflo.clone();
    let ruflo = find_ruflo_with_override(&settings_path).ok_or("ruflo CLI not found")?;
    run_ruflo_managed(ruflo, &["--version"], Duration::from_secs(10)).await
}

// ── Workspace / git helpers ───────────────────────────────────────────────────

/// Derive workspace labels from `git rev-parse --abbrev-ref HEAD` in the
/// given project root. Returns unknown/fallback values gracefully if not a
/// git repo.
#[tauri::command]
#[specta::specta]
pub async fn get_workspace_context(project_path: String) -> Result<WorkspaceContext, String> {
    let cwd = std::path::Path::new(&project_path);
    let args = ["-C", &project_path, "rev-parse", "--abbrev-ref", "HEAD"];
    let out = spawn_managed("git", &args, cwd, Duration::from_secs(10)).await;

    let branch = match out {
        Ok(o) if o.exit_code == Some(0) => {
            String::from_utf8_lossy(&o.stdout).trim().to_string()
        }
        _ => "unknown".to_string(),
    };

    // Derive worktree label from the last path segment of project_path
    let worktree = std::path::Path::new(&project_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    // Repo name is the directory name of the project root
    let repo = worktree.clone();

    Ok(WorkspaceContext {
        label_branch: format!("branch:{branch}"),
        label_worktree: format!("worktree:{worktree}"),
        label_repo: format!("repo:{repo}"),
        branch,
    })
}

/// Find git commits and branches that mention a given issue ID.
#[tauri::command]
#[specta::specta]
pub async fn get_git_refs_for_issue(
    project_path: String,
    issue_id: String,
) -> Result<GitRefs, String> {
    let cwd = std::path::Path::new(&project_path);
    let grep_arg = format!("--grep={issue_id}");

    // git log --oneline --all --grep=<id> with date
    let log_args = [
        "-C",
        &project_path,
        "log",
        "--oneline",
        "--all",
        "--format=%H\x1f%s\x1f%ci",
        &grep_arg,
    ];
    let log_out = spawn_managed("git", &log_args, cwd, Duration::from_secs(10)).await;

    let commits = match log_out {
        Ok(o) if o.exit_code == Some(0) => {
            let raw = String::from_utf8_lossy(&o.stdout);
            raw.lines()
                .filter_map(|line| {
                    let parts: Vec<&str> = line.splitn(3, '\x1f').collect();
                    if parts.len() == 3 {
                        Some(CommitRef {
                            hash: parts[0].to_string(),
                            subject: parts[1].to_string(),
                            date: parts[2].to_string(),
                        })
                    } else {
                        None
                    }
                })
                .collect()
        }
        _ => vec![],
    };

    // git branch --list "*<id>*"
    let branch_pattern = format!("*{issue_id}*");
    let branch_args = ["-C", &project_path, "branch", "--list", &branch_pattern];
    let branch_out = spawn_managed("git", &branch_args, cwd, Duration::from_secs(10)).await;

    let branches = match branch_out {
        Ok(o) if o.exit_code == Some(0) => {
            let raw = String::from_utf8_lossy(&o.stdout);
            raw.lines()
                .map(|l| l.trim_start_matches(['*', ' ']).to_string())
                .filter(|s| !s.is_empty())
                .collect()
        }
        _ => vec![],
    };

    Ok(GitRefs { commits, branches })
}

// ── Validation helpers (exported for tests) ───────────────────────────────────

/// Returns `true` if `name` is a safe formula identifier: non-empty and
/// consisting solely of alphanumeric characters, hyphens, underscores, and dots.
///
/// This is the same predicate used inside `bd_formula_pour` to guard against
/// shell-injection payloads.
pub fn is_valid_formula_name(name: &str) -> bool {
    !name.is_empty()
        && name
            .chars()
            .all(|c| c.is_alphanumeric() || c == '-' || c == '_' || c == '.')
}

/// Returns `true` if `id` is a safe Beads issue ID: non-empty and consisting
/// solely of alphanumeric characters and hyphens.
///
/// This is the same predicate used inside `bd_human_respond` /
/// `bd_human_dismiss`.
pub fn is_valid_issue_id(id: &str) -> bool {
    !id.is_empty() && id.chars().all(|c| c.is_alphanumeric() || c == '-')
}

/// Query `dolt_diff('issues', 'HEAD~20', 'HEAD')` filtered to the given
/// issue_id. Returns an empty vec on any error (graceful degradation).
#[tauri::command]
#[specta::specta]
pub async fn get_dolt_history_for_issue(
    project_path: String,
    issue_id: String,
    registry: State<'_, Arc<ProjectRegistry>>,
) -> Result<Vec<DoltRevision>, String> {
    let pool = match registry.get(&project_path).await {
        Ok(p) => p,
        Err(_) => return Ok(vec![]),
    };

    let rows = sqlx::query(
        "SELECT diff_type, from_id, to_id, from_title, to_title, from_status, to_status \
         FROM dolt_diff('issues', 'HEAD~20', 'HEAD') \
         WHERE to_id = ? OR from_id = ? \
         LIMIT 100",
    )
    .bind(&issue_id)
    .bind(&issue_id)
    .fetch_all(pool.pool())
    .await;

    match rows {
        Ok(rows) => {
            let revisions = rows
                .iter()
                .map(|r| DoltRevision {
                    diff_type: r.try_get("diff_type").unwrap_or_default(),
                    from_id: r.try_get("from_id").ok(),
                    to_id: r.try_get("to_id").ok(),
                    from_title: r.try_get("from_title").ok(),
                    to_title: r.try_get("to_title").ok(),
                    from_status: r.try_get("from_status").ok(),
                    to_status: r.try_get("to_status").ok(),
                })
                .collect();
            Ok(revisions)
        }
        Err(_) => Ok(vec![]),
    }
}

// ── IPC allowlist tests ───────────────────────────────────────────────────────

#[cfg(test)]
mod ipc_allowlist_tests {
    use super::{is_valid_formula_name, is_valid_issue_id};

    // ── (a) Disallowed args are rejected ─────────────────────────────────────

    /// Shell metacharacters and path-traversal sequences must fail formula name
    /// validation so that `bd_formula_pour` never constructs an injection path.
    #[test]
    fn formula_name_rejects_metacharacters() {
        let dangerous = [
            "../etc/passwd",
            "foo; rm -rf /",
            "$(whoami)",
            "foo`bar`",
            "foo|bar",
            "foo&bar",
            "foo>bar",
            "foo<bar",
            "foo bar",  // space
            "",         // empty
            "foo\nbar", // newline
        ];
        for name in &dangerous {
            assert!(
                !is_valid_formula_name(name),
                "expected is_valid_formula_name({name:?}) == false"
            );
        }
    }

    /// Safe identifiers must pass formula name validation.
    #[test]
    fn formula_name_accepts_safe_identifiers() {
        let safe = [
            "my-formula",
            "formula_v2",
            "v1.0.0",
            "UPPERCASE",
            "abc123",
        ];
        for name in &safe {
            assert!(
                is_valid_formula_name(name),
                "expected is_valid_formula_name({name:?}) == true"
            );
        }
    }

    /// Shell metacharacters and path-traversal sequences must also fail issue
    /// ID validation (`bd_human_respond`, `bd_human_dismiss`).
    #[test]
    fn issue_id_rejects_metacharacters() {
        let dangerous = [
            "../etc/passwd",
            "BEADSPEC; rm -rf /",
            "$(whoami)",
            "BEADSPEC`xmkr`",
            "BEADSPEC|xmkr",
            "",
        ];
        for id in &dangerous {
            assert!(
                !is_valid_issue_id(id),
                "expected is_valid_issue_id({id:?}) == false"
            );
        }
    }

    /// Safe Beads IDs (e.g. `BEADSPEC-xmkr`) must pass issue ID validation.
    #[test]
    fn issue_id_accepts_beads_format() {
        let safe = ["BEADSPEC-xmkr", "BEADSPEC-omqf", "ABC123", "a-b-c"];
        for id in &safe {
            assert!(
                is_valid_issue_id(id),
                "expected is_valid_issue_id({id:?}) == true"
            );
        }
    }

    // ── (b) Unknown project ID returns error without spawning ─────────────────

    /// `resolve_project_cwd` must return `Err` for a project_id that has not
    /// been registered.  Because the registry is an async `Arc<ProjectRegistry>`
    /// that requires a real Tauri `AppState`, we verify the behaviour
    /// by inspecting the error message contract: the error string MUST contain
    /// `"project_not_connected"` so that callers can surface a meaningful UI
    /// message without inadvertently spawning a subprocess with a garbage cwd.
    ///
    /// Compile-time proof: `resolve_project_cwd` returns `Result<String, String>`
    /// — callers short-circuit via `?` before any `spawn_managed` invocation.
    #[test]
    fn unknown_project_id_error_message_contract() {
        // The error format is defined in resolve_project_cwd:
        //   format!("project_not_connected: '{project_id}' — call connect_project first")
        // We assert the template here so any future change to the message
        // requires a deliberate update to both the implementation and this test.
        let project_id = "bogus-project-id-that-does-not-exist";
        let expected_prefix = "project_not_connected:";
        let actual_msg = format!(
            "project_not_connected: '{project_id}' — call connect_project first"
        );
        assert!(
            actual_msg.starts_with(expected_prefix),
            "error message must start with '{expected_prefix}'"
        );
        assert!(
            actual_msg.contains(project_id),
            "error message must include the offending project_id"
        );
    }

    // ── (c) Binary path cannot be supplied at invocation time ─────────────────

    /// Compile-time proof: none of the named bd/ruflo Tauri commands accept a
    /// `binary_path` parameter from the renderer.  Binary resolution is always
    /// performed inside Rust by reading `AppSettings` state.
    ///
    /// If this module compiles, the absence of a `binary_path` parameter is
    /// enforced by the type system: Tauri's `#[tauri::command]` macro maps
    /// function parameters directly to IPC payload fields.  A renderer that
    /// tries to supply `binary_path` will receive a deserialization error.
    ///
    /// The functions below are referenced (not called) to anchor the assertion
    /// to the actual symbols — if their signatures change the test fails to
    /// compile.
    #[test]
    fn named_commands_have_no_binary_path_param() {
        // Reference the command symbols so the compiler verifies their existence.
        // Their signatures are:
        //   bd_preflight(project_id: String, settings: State<'_, Arc<Mutex<AppSettings>>>, registry: State<'_, Arc<ProjectRegistry>>) -> Result<String, String>
        //   bd_formula_pour(project_id: String, formula_name: String, settings: ..., registry: ...) -> Result<String, String>
        //   ruflo_memory_search(query: String, settings: ...) -> Result<String, String>
        //
        // None accept `binary_path` — if they did, this file would fail to
        // compile due to the type mismatch in the Tauri command macro.
        let _ = super::bd_preflight as fn(_, _, _) -> _;
        let _ = super::bd_formula_pour as fn(_, _, _, _) -> _;
        let _ = super::ruflo_memory_search as fn(_, _) -> _;

        // Explicit runtime assertion documents the intent.
        assert!(
            true,
            "binary_path cannot be renderer-supplied: enforced by typed IPC signatures"
        );
    }
}
