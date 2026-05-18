use crate::commands::external::{find_ruflo_with_override, run_ruflo_managed};
use crate::settings::AppSettings;
use serde_json::Value;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::State;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type, PartialEq, Eq)]
pub enum ReviewKind {
    PrReview,
    CodeReview,
    SecurityReview,
    Unknown,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct ReviewEntry {
    pub key: String,
    pub kind: ReviewKind,
    pub kind_raw: String,
    pub branch: Option<String>,
    pub pr: Option<String>,
    pub task_id: Option<String>,
    pub title: String,
    pub ts_epoch: Option<f64>,
    pub body: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(tag = "scope", content = "value")]
pub enum ReviewScope {
    Branch(String),
    Pr(String),
    TaskId(String),
    All,
}

fn review_kind(raw: &str) -> ReviewKind {
    match raw {
        "pr-review" => ReviewKind::PrReview,
        "code-review" => ReviewKind::CodeReview,
        "security-review" => ReviewKind::SecurityReview,
        _ => ReviewKind::Unknown,
    }
}

pub(crate) fn parse_review_key(key: &str, body: String) -> Option<ReviewEntry> {
    let mut kind_raw = None;
    let mut branch = None;
    let mut pr = None;
    let mut task_id = None;
    let mut title = None;
    let mut ts_epoch = None;
    for segment in key.split('|') {
        let Some((name, value)) = segment.split_once(':') else {
            continue;
        };
        match name {
            "review" => kind_raw = Some(value.to_string()),
            "branch" => branch = Some(value.to_string()),
            "pr" => pr = Some(value.to_string()),
            "issue" | "task" => task_id = Some(value.to_string()),
            "title" => title = Some(value.replace('_', " ")),
            "ts" => ts_epoch = value.parse::<f64>().ok(),
            _ => {}
        }
    }
    let kind_raw = kind_raw?;
    let title = title.unwrap_or_else(|| body.lines().next().unwrap_or("Review").chars().take(80).collect());
    Some(ReviewEntry {
        key: key.to_string(),
        kind: review_kind(&kind_raw),
        kind_raw,
        branch,
        pr,
        task_id,
        title,
        ts_epoch,
        body,
    })
}

fn parse_review_entries(raw: &str) -> Vec<ReviewEntry> {
    let Ok(json) = serde_json::from_str::<Value>(raw) else {
        return Vec::new();
    };
    let items = json
        .as_array()
        .cloned()
        .or_else(|| json.get("entries").and_then(Value::as_array).cloned())
        .or_else(|| json.get("results").and_then(Value::as_array).cloned())
        .unwrap_or_default();
    let mut entries: Vec<ReviewEntry> = items
        .iter()
        .filter_map(|item| {
            let key = item.get("key").and_then(Value::as_str)?;
            let body = item
                .get("value")
                .or_else(|| item.get("body"))
                .or_else(|| item.get("content"))
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string();
            parse_review_key(key, body)
        })
        .collect();
    entries.sort_by(|a, b| b.ts_epoch.unwrap_or(0.0).total_cmp(&a.ts_epoch.unwrap_or(0.0)));
    entries
}

fn scope_query(scope: &ReviewScope) -> String {
    match scope {
        ReviewScope::Branch(branch) => format!("review: branch:{branch}"),
        ReviewScope::Pr(pr) => format!("review: pr:{pr}"),
        ReviewScope::TaskId(task_id) => format!("review: issue:{task_id}"),
        ReviewScope::All => "review:".to_string(),
    }
}

fn matches_scope(entry: &ReviewEntry, scope: &ReviewScope) -> bool {
    match scope {
        ReviewScope::Branch(branch) => entry.branch.as_deref() == Some(branch.as_str()),
        ReviewScope::Pr(pr) => entry.pr.as_deref() == Some(pr.as_str()),
        ReviewScope::TaskId(task_id) => entry.task_id.as_deref() == Some(task_id.as_str()),
        ReviewScope::All => true,
    }
}

fn ruflo(settings: &State<'_, Arc<Mutex<AppSettings>>>) -> Result<std::path::PathBuf, String> {
    let settings_path = settings.lock().unwrap().binary_paths.ruflo.clone();
    find_ruflo_with_override(&settings_path).ok_or_else(|| "ruflo CLI not found".to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn list_reviews(
    _project_path: String,
    scope: ReviewScope,
    settings: State<'_, Arc<Mutex<AppSettings>>>,
) -> Result<Vec<ReviewEntry>, String> {
    let ruflo = ruflo(&settings)?;
    let query = scope_query(&scope);
    let stdout = run_ruflo_managed(
        ruflo,
        &["memory", "search", "-q", &query, "--format", "json"],
        Duration::from_secs(10),
    )
    .await?;
    Ok(parse_review_entries(&stdout)
        .into_iter()
        .filter(|entry| matches_scope(entry, &scope))
        .collect())
}

#[tauri::command]
#[specta::specta]
pub async fn get_review(
    key: String,
    settings: State<'_, Arc<Mutex<AppSettings>>>,
) -> Result<ReviewEntry, String> {
    let ruflo = ruflo(&settings)?;
    let stdout = run_ruflo_managed(
        ruflo,
        &["memory", "retrieve", "-k", &key, "--format", "json"],
        Duration::from_secs(10),
    )
    .await?;
    let body = serde_json::from_str::<Value>(&stdout)
        .ok()
        .and_then(|v| {
            v.get("value")
                .or_else(|| v.get("body"))
                .or_else(|| v.get("content"))
                .and_then(Value::as_str)
                .map(ToOwned::to_owned)
        })
        .unwrap_or(stdout);
    parse_review_key(&key, body).ok_or_else(|| "unparseable review key".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn review_key_parses() {
        let entry = parse_review_key(
            "branch:feat|review:code-review|branch:feat/x|pr:42|ts:10",
            "Body".into(),
        )
        .unwrap();
        assert_eq!(entry.kind, ReviewKind::CodeReview);
        assert_eq!(entry.branch.as_deref(), Some("feat/x"));
        assert_eq!(entry.pr.as_deref(), Some("42"));
    }

    #[test]
    fn review_key_requires_review_segment() {
        assert!(parse_review_key("branch:x|ts:1", "Body".into()).is_none());
    }

    #[test]
    fn branch_scope_filters() {
        let entry = parse_review_key("review:code-review|branch:a|ts:1", "Body".into()).unwrap();
        assert!(matches_scope(&entry, &ReviewScope::Branch("a".into())));
        assert!(!matches_scope(&entry, &ReviewScope::Branch("b".into())));
    }
}
