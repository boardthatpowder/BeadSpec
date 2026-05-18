use crate::commands::external::{find_ruflo_with_override, run_ruflo_managed};
use sqlx::types::chrono::{DateTime, Utc};
use serde_json::{json, Value};
use std::collections::{HashSet, VecDeque};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct ActivityEvent {
    pub id: String,
    pub ts: String,
    pub kind: String,
    pub source: String,
    pub summary: String,
    pub detail: String,
    pub correlation_id: Option<String>,
}

pub struct ActivityRingBuffer {
    events: Mutex<VecDeque<ActivityEvent>>,
}

impl ActivityRingBuffer {
    pub fn new() -> Self {
        Self { events: Mutex::new(VecDeque::new()) }
    }

    pub fn push(&self, event: ActivityEvent) {
        let mut guard = self.events.lock().unwrap();
        guard.push_back(event);
        let horizon_epoch = Utc::now().timestamp() - 7 * 24 * 60 * 60;
        while guard.len() > 5000 {
            guard.pop_front();
        }
        guard.retain(|event| parse_ts(&event.ts).map(|ts| ts.timestamp() >= horizon_epoch).unwrap_or(true));
    }

    pub fn since(&self, since_ts: Option<DateTime<Utc>>, limit: usize) -> Vec<ActivityEvent> {
        let mut items: Vec<ActivityEvent> = self
            .events
            .lock()
            .unwrap()
            .iter()
            .filter(|event| {
                since_ts
                    .map(|since| parse_ts(&event.ts).map(|ts| ts > since).unwrap_or(false))
                    .unwrap_or(true)
            })
            .cloned()
            .collect();
        items.sort_by(|a, b| b.ts.cmp(&a.ts));
        items.truncate(limit);
        items
    }
}

static RING: OnceLock<ActivityRingBuffer> = OnceLock::new();
static STARTED_PROJECTS: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();

fn ring() -> &'static ActivityRingBuffer {
    RING.get_or_init(ActivityRingBuffer::new)
}

fn parse_ts(ts: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(ts).ok().map(|dt| dt.with_timezone(&Utc))
}

pub fn emit_event(handle: &AppHandle, event: ActivityEvent) {
    ring().push(event.clone());
    handle.emit("workflow:activity", event).ok();
}

pub fn emit_bd_event(
    handle: &AppHandle,
    kind: impl Into<String>,
    issue_id: impl Into<String>,
    summary: impl Into<String>,
    detail: Value,
) {
    let issue_id = issue_id.into();
    emit_event(
        handle,
        ActivityEvent {
            id: format!("bd:{issue_id}:{}", Utc::now().timestamp_millis()),
            ts: Utc::now().to_rfc3339(),
            kind: kind.into(),
            source: "bd".into(),
            summary: summary.into(),
            detail: detail.to_string(),
            correlation_id: Some(issue_id),
        },
    );
}

pub fn start_all_sources(handle: AppHandle, project_dir: String) {
    let project_dir = match std::fs::canonicalize(&project_dir) {
        Ok(path) => path.to_string_lossy().into_owned(),
        Err(_) => project_dir,
    };
    let started = STARTED_PROJECTS.get_or_init(|| Mutex::new(HashSet::new()));
    {
        let mut guard = started.lock().unwrap();
        if !guard.insert(project_dir.clone()) {
            return;
        }
    }

    let ruflo_handle = handle.clone();
    tokio::spawn(async move {
        tokio::time::sleep(Duration::from_secs(1)).await;
        start_ruflo_memory_source(ruflo_handle).await;
    });

    tokio::spawn(async move {
        tokio::time::sleep(Duration::from_secs(2)).await;
        start_gitnexus_source(handle, PathBuf::from(project_dir)).await;
    });
}

async fn start_ruflo_memory_source(handle: AppHandle) {
    let mut watermark = 0_i64;
    let mut interval = tokio::time::interval(Duration::from_secs(3));
    loop {
        interval.tick().await;
        let Some(ruflo) = find_ruflo_with_override("") else {
            continue;
        };
        let stdout = run_ruflo_managed(
            ruflo,
            &["memory", "search", "-q", "type:event", "--format", "json"],
            Duration::from_secs(10),
        )
        .await;
        let Ok(stdout) = stdout else {
            continue;
        };
        let mut events = parse_memory_events(&stdout);
        events.sort_by_key(|(ts, _)| *ts);
        for (ts, event) in events {
            if ts <= watermark {
                continue;
            }
            watermark = watermark.max(ts);
            emit_event(&handle, event);
        }
    }
}

async fn start_gitnexus_source(handle: AppHandle, project_dir: PathBuf) {
    let mut newest_seen = None::<SystemTime>;
    let mut stale_emitted = false;
    let mut interval = tokio::time::interval(Duration::from_secs(5));
    loop {
        interval.tick().await;
        let snapshot = gitnexus_cache_snapshot(&project_dir);
        let Some((newest_index, newest_ack)) = snapshot else {
            continue;
        };
        if newest_seen.map(|seen| newest_index > seen).unwrap_or(true) {
            newest_seen = Some(newest_index);
            emit_event(
                &handle,
                ActivityEvent {
                    id: format!("gitnexus:index_refreshed:{}", unix_secs(newest_index)),
                    ts: Utc::now().to_rfc3339(),
                    kind: "gitnexus.index_refreshed".into(),
                    source: "gitnexus".into(),
                    summary: "GitNexus index cache refreshed".into(),
                    detail: json!({ "project_dir": project_dir }).to_string(),
                    correlation_id: None,
                },
            );
            stale_emitted = false;
        }
        let stale = newest_ack
            .and_then(|ack| newest_index.duration_since(ack).ok())
            .map(|delta| delta.as_secs() > 300)
            .unwrap_or(true);
        if stale && !stale_emitted {
            emit_event(
                &handle,
                ActivityEvent {
                    id: format!("gitnexus:index_stale:{}", unix_secs(newest_index)),
                    ts: Utc::now().to_rfc3339(),
                    kind: "gitnexus.index_stale".into(),
                    source: "gitnexus".into(),
                    summary: "GitNexus index is newer than the last acknowledgement".into(),
                    detail: json!({ "project_dir": project_dir, "stale_seconds": newest_ack.and_then(|ack| newest_index.duration_since(ack).ok()).map(|d| d.as_secs()) }).to_string(),
                    correlation_id: None,
                },
            );
            stale_emitted = true;
        }
    }
}

fn parse_memory_events(raw: &str) -> Vec<(i64, ActivityEvent)> {
    let Ok(json) = serde_json::from_str::<Value>(raw) else {
        return Vec::new();
    };
    let items = json
        .as_array()
        .cloned()
        .or_else(|| json.get("entries").and_then(Value::as_array).cloned())
        .or_else(|| json.get("results").and_then(Value::as_array).cloned())
        .unwrap_or_default();
    items
        .iter()
        .filter_map(|item| {
            let key = item.get("key").and_then(Value::as_str)?;
            let value = item
                .get("value")
                .or_else(|| item.get("body"))
                .or_else(|| item.get("content"))
                .and_then(Value::as_str)
                .unwrap_or("{}");
            parse_memory_event(key, value)
        })
        .collect()
}

fn parse_memory_event(key: &str, value: &str) -> Option<(i64, ActivityEvent)> {
    let mut kind = None;
    let mut ts = None;
    for segment in key.split('|') {
        let Some((name, value)) = segment.split_once(':') else {
            continue;
        };
        match name {
            "type" if value != "event" => return None,
            "kind" => kind = Some(value.to_string()),
            "ts" => ts = value.parse::<i64>().ok(),
            _ => {}
        }
    }
    let kind = kind?;
    let ts = ts?;
    let value_json = serde_json::from_str::<Value>(value).ok()?;
    let summary = value_json
        .get("summary")
        .and_then(Value::as_str)
        .unwrap_or(&kind)
        .to_string();
    let detail = value_json.get("detail").cloned().unwrap_or(Value::Null).to_string();
    let correlation_id = value_json
        .get("correlation_id")
        .and_then(Value::as_str)
        .map(ToOwned::to_owned);
    let dt = DateTime::<Utc>::from_timestamp(ts, 0)?;
    Some((
        ts,
        ActivityEvent {
            id: format!("ruflo:{kind}:{ts}"),
            ts: dt.to_rfc3339(),
            kind,
            source: "hook".into(),
            summary,
            detail,
            correlation_id,
        },
    ))
}

fn gitnexus_cache_snapshot(project_dir: &Path) -> Option<(SystemTime, Option<SystemTime>)> {
    let cache_dir = project_dir.join(".claude/cache");
    let entries = std::fs::read_dir(cache_dir).ok()?;
    let mut newest_index = None::<SystemTime>;
    let mut newest_ack = None::<SystemTime>;
    for entry in entries.flatten() {
        let file_name = entry.file_name();
        let name = file_name.to_string_lossy();
        if !name.starts_with("gitnexus-") {
            continue;
        }
        let Ok(meta) = entry.metadata() else {
            continue;
        };
        let Ok(modified) = meta.modified() else {
            continue;
        };
        if name.ends_with(".json") {
            newest_index = Some(newest_index.map(|old| old.max(modified)).unwrap_or(modified));
        } else if name.ends_with("-ack") {
            newest_ack = Some(newest_ack.map(|old| old.max(modified)).unwrap_or(modified));
        }
    }
    newest_index.map(|index| (index, newest_ack))
}

fn unix_secs(time: SystemTime) -> u64 {
    time.duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

#[tauri::command]
#[specta::specta]
pub async fn list_recent_events(
    handle: AppHandle,
    _project_path: String,
    limit: u32,
    since_ts: Option<String>,
) -> Result<Vec<ActivityEvent>, String> {
    start_all_sources(handle, _project_path);
    let since = match since_ts {
        Some(ts) if !ts.is_empty() => Some(
            DateTime::parse_from_rfc3339(&ts)
                .map_err(|e| format!("invalid since_ts: {e}"))?
                .with_timezone(&Utc),
        ),
        _ => None,
    };
    Ok(ring().since(since, limit.min(1000) as usize))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn event(id: usize, ts: DateTime<Utc>) -> ActivityEvent {
        ActivityEvent {
            id: id.to_string(),
            ts: ts.to_rfc3339(),
            kind: "test".into(),
            source: "hook".into(),
            summary: "summary".into(),
            detail: json!({}).to_string(),
            correlation_id: None,
        }
    }

    #[test]
    fn ring_horizon_and_since() {
        let ring = ActivityRingBuffer::new();
        let now = Utc::now();
        ring.push(event(1, DateTime::parse_from_rfc3339(&format_ts(now.timestamp() - 8 * 24 * 60 * 60)).unwrap().with_timezone(&Utc)));
        ring.push(event(2, now));
        assert_eq!(ring.since(None, 10).len(), 1);
        assert!(ring.since(Some(DateTime::parse_from_rfc3339(&format_ts(now.timestamp() + 1)).unwrap().with_timezone(&Utc)), 10).is_empty());
    }

    #[test]
    fn ring_cap() {
        let ring = ActivityRingBuffer::new();
        let now = Utc::now();
        for i in 0..5001 {
            ring.push(event(i, now));
        }
        assert_eq!(ring.since(None, 6000).len(), 5000);
    }

    #[test]
    fn memory_event_parses_and_malformed_skips() {
        let parsed = parse_memory_event(
            "branch:test|type:event|kind:hook.demo|ts:10",
            r#"{"summary":"demo","detail":{"ok":true},"correlation_id":"BEADSPEC-1"}"#,
        )
        .unwrap()
        .1;
        assert_eq!(parsed.kind, "hook.demo");
        assert_eq!(parsed.summary, "demo");
        assert_eq!(parsed.correlation_id.as_deref(), Some("BEADSPEC-1"));
        assert!(parse_memory_event("type:event|kind:hook.demo|ts:10", "{not-json").is_none());
    }
}

#[cfg(test)]
fn format_ts(epoch: i64) -> String {
    let st = std::time::UNIX_EPOCH + std::time::Duration::from_secs(epoch.max(0) as u64);
    let dt: DateTime<Utc> = st.into();
    dt.to_rfc3339()
}
