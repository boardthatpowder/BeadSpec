use crate::db::pool::ProjectRegistry;
use serde_json::{json, Value};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

use tauri::State;

static OPTIMISTIC_COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_optimistic_id() -> String {
    format!("opt-{}", OPTIMISTIC_COUNTER.fetch_add(1, Ordering::Relaxed))
}

/// Returned by write commands. The frontend uses this to track pending mutations
/// and roll back the optimistic update if the command fails.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, specta::Type)]
pub struct WriteResult {
    pub optimistic_id: String,
    pub output: String,
}

/// Translate supported native operations without changing the existing IPC surface.
fn http_write(args: &[&str], actor: &str) -> Option<(&'static str, &'static str, String, Value)> {
    let id = args.get(1).copied().unwrap_or("");
    let path = format!("/issues/{}", crate::bd::api::encode_segment(id));
    match *args.first()? {
        "create" => {
            let mut body = json!({"actor":actor});
            for arg in &args[1..] {
                let (key, value) = arg.strip_prefix("--")?.split_once('=')?;
                let key = if key == "type" { "issue_type" } else { key };
                body[key] = if key == "priority" {
                    json!(value.parse::<u8>().ok()?)
                } else {
                    json!(value)
                };
            }
            Some(("issues.create", "POST", "/issues".into(), body))
        }
        "update" => {
            let mut patch = json!({});
            for arg in &args[2..] {
                let (key, value) = arg.strip_prefix("--")?.split_once('=')?;
                let key = match key {
                    "type" => "issue_type",
                    "acceptance" => "acceptance_criteria",
                    "add-label" => "add_labels",
                    "remove-label" => "remove_labels",
                    key => key,
                };
                if ![
                    "title",
                    "description",
                    "design",
                    "acceptance_criteria",
                    "notes",
                    "status",
                    "priority",
                    "issue_type",
                    "assignee",
                    "add_labels",
                    "remove_labels",
                ]
                .contains(&key)
                {
                    return None;
                }
                patch[key] = match key {
                    "priority" => json!(value.parse::<u8>().ok()?),
                    "add_labels" | "remove_labels" => json!([value]),
                    _ => json!(value),
                };
            }
            Some((
                "issues.update",
                "PATCH",
                path,
                json!({"actor":actor,"patch":patch}),
            ))
        }
        "tag" => Some((
            "issues.update",
            "PATCH",
            path,
            json!({"actor":actor,"patch":{"add_labels":[args.get(2)?]}}),
        )),
        "close" => Some((
            "issues.close",
            "POST",
            format!("{path}:close"),
            json!({"actor":actor,"force":args.contains(&"--force")}),
        )),
        "reopen" => Some((
            "issues.reopen",
            "POST",
            format!("{path}:reopen"),
            json!({"actor":actor}),
        )),
        "comment" => Some((
            "issues.addComment",
            "POST",
            format!("{path}/comments"),
            json!({"author":actor,"text":args.last()?}),
        )),
        "delete" => Some((
            "issues.delete",
            "POST",
            "/issues:delete".into(),
            json!({"actor":actor,"ids":[id],"force":args.contains(&"--force")}),
        )),
        "dep" => {
            let add = id == "add";
            let edge =
                json!({"issue_id":args.get(2)?,"depends_on_id":args.get(3)?,"type":"blocks"});
            Some((
                if add {
                    "dependencies.add"
                } else {
                    "dependencies.remove"
                },
                "POST",
                format!("/dependencies:{}", if add { "add" } else { "remove" }),
                if add {
                    json!({"actor":actor,"edges":[edge]})
                } else {
                    json!({"actor":actor,"issue_id":args.get(2)?,"depends_on_id":args.get(3)?})
                },
            ))
        }
        _ => None,
    }
}

async fn run_write(
    project_path: &str,
    args: &[&str],
    registry: &State<'_, Arc<ProjectRegistry>>,
) -> Result<WriteResult, String> {
    let source = registry.get(project_path).await?;
    let output = if let Some((capability, method, path, body)) = http_write(args, source.actor()) {
        source.write(args, capability, method, &path, body).await?
    } else {
        source.run_cli(args).await?
    };
    Ok(WriteResult {
        optimistic_id: next_optimistic_id(),
        output,
    })
}

#[tauri::command]
#[specta::specta]
pub async fn create_task(
    project_path: String,
    title: String,
    description: Option<String>,
    priority: Option<u8>,
    task_type: Option<String>,
    registry: State<'_, Arc<ProjectRegistry>>,
) -> Result<WriteResult, String> {
    let mut args: Vec<String> = vec!["create".into(), format!("--title={}", title)];
    if let Some(desc) = description {
        args.push(format!("--description={}", desc));
    }
    if let Some(p) = priority {
        args.push(format!("--priority={}", p));
    }
    if let Some(t) = task_type {
        args.push(format!("--type={}", t));
    }
    let arg_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    run_write(&project_path, &arg_refs, &registry).await
}

#[tauri::command]
#[specta::specta]
pub async fn update_task_field(
    project_path: String,
    issue_id: String,
    field: String,
    value: String,
    registry: State<'_, Arc<ProjectRegistry>>,
) -> Result<WriteResult, String> {
    let flag = format!("--{}={}", field, value);
    run_write(&project_path, &["update", &issue_id, &flag], &registry).await
}

#[tauri::command]
#[specta::specta]
pub async fn change_task_status(
    project_path: String,
    issue_id: String,
    status: String,
    force: bool,
    registry: State<'_, Arc<ProjectRegistry>>,
) -> Result<WriteResult, String> {
    match status.as_str() {
        "closed" => {
            let mut args: Vec<&str> = vec!["close", &issue_id];
            if force {
                args.push("--force");
            }
            run_write(&project_path, &args, &registry).await
        }
        "open" => run_write(&project_path, &["reopen", &issue_id], &registry).await,
        _ => {
            let flag = format!("--status={}", status);
            run_write(&project_path, &["update", &issue_id, &flag], &registry).await
        }
    }
}

#[tauri::command]
#[specta::specta]
pub async fn add_label(
    project_path: String,
    issue_id: String,
    label: String,
    registry: State<'_, Arc<ProjectRegistry>>,
) -> Result<WriteResult, String> {
    run_write(&project_path, &["tag", &issue_id, &label], &registry).await
}

#[tauri::command]
#[specta::specta]
pub async fn remove_label(
    project_path: String,
    issue_id: String,
    label: String,
    registry: State<'_, Arc<ProjectRegistry>>,
) -> Result<WriteResult, String> {
    let flag = format!("--remove-label={}", label);
    run_write(&project_path, &["update", &issue_id, &flag], &registry).await
}

#[tauri::command]
#[specta::specta]
pub async fn add_comment(
    project_path: String,
    issue_id: String,
    body: String,
    registry: State<'_, Arc<ProjectRegistry>>,
) -> Result<WriteResult, String> {
    run_write(
        &project_path,
        &["comment", &issue_id, "--", &body],
        &registry,
    )
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn delete_task(
    project_path: String,
    issue_id: String,
    registry: State<'_, Arc<ProjectRegistry>>,
) -> Result<WriteResult, String> {
    run_write(&project_path, &["delete", &issue_id, "--force"], &registry).await
}

#[tauri::command]
#[specta::specta]
pub async fn link_dependency(
    project_path: String,
    blocked_id: String,
    blocking_id: String,
    registry: State<'_, Arc<ProjectRegistry>>,
) -> Result<WriteResult, String> {
    run_write(
        &project_path,
        &["dep", "add", &blocked_id, &blocking_id],
        &registry,
    )
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn unlink_dependency(
    project_path: String,
    blocked_id: String,
    blocking_id: String,
    registry: State<'_, Arc<ProjectRegistry>>,
) -> Result<WriteResult, String> {
    run_write(
        &project_path,
        &["dep", "remove", &blocked_id, &blocking_id],
        &registry,
    )
    .await
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn preserve_create_and_comment_payloads() {
        let (cap, method, path, body) = http_write(
            &["create", "--title=hello", "--priority=2", "--type=task"],
            "me",
        )
        .unwrap();
        assert_eq!(
            (cap, method, path.as_str()),
            ("issues.create", "POST", "/issues")
        );
        assert_eq!(body["priority"], 2);
        assert_eq!(body["issue_type"], "task");
        let (_, _, _, body) = http_write(&["comment", "a", "--", "text"], "me").unwrap();
        assert_eq!(body, json!({"author":"me","text":"text"}));
    }
    #[test]
    fn unsupported_fields_stay_native() {
        assert!(http_write(&["update", "a", "--owner=you"], "me").is_none());
    }
    #[test]
    fn dependency_direction_is_preserved() {
        let (_, _, path, body) = http_write(&["dep", "add", "blocked", "blocking"], "me").unwrap();
        assert_eq!(path, "/dependencies:add");
        assert_eq!(body["edges"][0]["issue_id"], "blocked");
        assert_eq!(body["edges"][0]["depends_on_id"], "blocking");
    }
    #[test]
    fn confirmed_delete_uses_native_and_http_force_semantics() {
        let (_, _, path, body) = http_write(&["delete", "B-1", "--force"], "me").unwrap();
        assert_eq!(path, "/issues:delete");
        assert_eq!(body["force"], true);
    }
}
