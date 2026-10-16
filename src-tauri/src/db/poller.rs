//! Journal-driven Beads refresh, with periodic reconciliation for unjournaled changes.
use super::sse::SseParser;
use crate::bd::api::{BeadsDataSource, EventsPage, FeedError, JournalRecord, LiveUpdateMode};
use crate::events::activity::{emit_project_event, retain_project_event, ActivityEvent};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

#[derive(Clone, serde::Serialize)]
pub struct TasksChangedPayload {
    pub project: String,
    pub task_ids: Vec<String>,
}
#[derive(Clone, serde::Serialize)]
pub struct TaskListChangedPayload {
    pub project: String,
}
pub struct BeadsSync {
    source: BeadsDataSource,
    app: AppHandle,
}
pub struct PollHandle {
    running: Arc<AtomicBool>,
    paused: Arc<AtomicBool>,
}
impl PollHandle {
    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
    }
    pub fn pause(&self) {
        self.paused.store(true, Ordering::SeqCst);
    }
    pub fn resume(&self) {
        self.paused.store(false, Ordering::SeqCst);
    }
}
impl BeadsSync {
    pub fn new(source: BeadsDataSource, app: AppHandle) -> Self {
        Self { source, app }
    }
    pub fn start(self) -> PollHandle {
        let running = Arc::new(AtomicBool::new(true));
        let paused = Arc::new(AtomicBool::new(false));
        let handle = PollHandle {
            running: running.clone(),
            paused: paused.clone(),
        };
        tauri::async_runtime::spawn(async move {
            let mut checkpoint = 0;
            let mut anchor = None;
            let mut baseline = false;
            let mut next_reconcile = tokio::time::Instant::now();
            while running.load(Ordering::SeqCst) {
                if paused.load(Ordering::SeqCst) {
                    tokio::time::sleep(Duration::from_millis(200)).await;
                    continue;
                }
                let enabled = self.source.status().await.journal_enabled;
                if !enabled {
                    self.mode(LiveUpdateMode::Disabled, None).await;
                    if tokio::time::Instant::now() >= next_reconcile {
                        let _ = self.source.refresh_journal_status().await;
                        self.reconcile().await;
                        next_reconcile = tokio::time::Instant::now() + Duration::from_secs(30);
                    }
                    tokio::time::sleep(Duration::from_secs(1)).await;
                    continue;
                }
                if !baseline {
                    match self.bootstrap().await {
                        Ok((head, last)) => {
                            checkpoint = head;
                            anchor = last;
                            baseline = true;
                            next_reconcile = tokio::time::Instant::now() + Duration::from_secs(30);
                        }
                        Err(error) => {
                            self.mode(LiveUpdateMode::Reconnecting, Some(error)).await;
                            self.reconcile().await;
                            tokio::time::sleep(Duration::from_secs(2)).await;
                            continue;
                        }
                    }
                }
                if tokio::time::Instant::now() >= next_reconcile {
                    let _ = self.source.refresh_journal_status().await;
                    self.reconcile().await;
                    next_reconcile = tokio::time::Instant::now() + Duration::from_secs(30);
                    if !self.source.status().await.journal_enabled {
                        baseline = false;
                        continue;
                    }
                    if self.source.is_http()
                        && !self
                            .http_checkpoint_valid(checkpoint, anchor.as_ref())
                            .await
                    {
                        baseline = false;
                        continue;
                    }
                }
                if self.source.is_http() {
                    match self.source.open_event_stream(checkpoint).await {
                        Ok(mut response) => {
                            self.mode(LiveUpdateMode::Streaming, None).await;
                            let mut parser = SseParser::default();
                            loop {
                                if !running.load(Ordering::SeqCst) || paused.load(Ordering::SeqCst)
                                {
                                    break;
                                }
                                let chunk = tokio::select! {
                                    chunk=response.chunk()=>chunk,
                                    _=tokio::time::sleep_until(next_reconcile)=>{
                                        self.reconcile().await;
                                        next_reconcile=tokio::time::Instant::now()+Duration::from_secs(30);
                                        if !self.http_checkpoint_valid(checkpoint,anchor.as_ref()).await {baseline=false;break;}
                                        continue;
                                    },
                                    _=tokio::time::sleep(Duration::from_millis(250))=>{continue;}
                                };
                                let frames = match chunk {
                                    Ok(Some(chunk)) => parser.push(&chunk),
                                    Ok(None) => break,
                                    Err(error) => Err(error.to_string()),
                                };
                                let frames = match frames {
                                    Ok(frames) => frames,
                                    Err(error) => {
                                        self.mode(LiveUpdateMode::Reconnecting, Some(error)).await;
                                        baseline = false;
                                        break;
                                    }
                                };
                                let mut malformed = false;
                                for frame in frames {
                                    if frame.event.as_deref() == Some("truncated") {
                                        baseline = false;
                                        malformed = true;
                                        break;
                                    }
                                    match serde_json::from_str::<JournalRecord>(&frame.data) {
                                        Ok(record) if record.seq > checkpoint => {
                                            self.process(&record, true).await;
                                            checkpoint = record.seq;
                                            anchor = Some(record);
                                        }
                                        Ok(_) => {}
                                        Err(_) => {
                                            baseline = false;
                                            malformed = true;
                                            break;
                                        }
                                    }
                                }
                                if malformed {
                                    break;
                                }
                            }
                        }
                        Err(FeedError::Truncated { .. }) => {
                            baseline = false;
                        }
                        Err(FeedError::Disabled) => {
                            self.source.set_journal_enabled(false).await;
                            baseline = false;
                        }
                        Err(error) => {
                            self.mode(LiveUpdateMode::Polling, Some(error.to_string()))
                                .await;
                            match self.http_drain(checkpoint, true).await {
                                Ok(head) => checkpoint = head,
                                Err(FeedError::Truncated { .. }) => baseline = false,
                                Err(FeedError::Disabled) => {
                                    self.source.set_journal_enabled(false).await;
                                    baseline = false;
                                }
                                Err(_) => {
                                    self.reconcile().await;
                                }
                            }
                        }
                    }
                    tokio::time::sleep(Duration::from_secs(1)).await;
                } else {
                    self.mode(LiveUpdateMode::Polling, None).await;
                    // A CLI tail above a reset head is silently empty. Verify the retained anchor.
                    if let Some(last) = &anchor {
                        match self.cli_records(last.seq.saturating_sub(1), 1).await {
                            Ok(records)
                                if records
                                    .first()
                                    .map(|record| serde_json::to_value(record).ok())
                                    == Some(serde_json::to_value(last).ok()) => {}
                            _ => {
                                baseline = false;
                                continue;
                            }
                        }
                    }
                    match self.cli_drain(checkpoint, true).await {
                        Ok((head, last)) => {
                            checkpoint = head;
                            if last.is_some() {
                                anchor = last;
                            }
                        }
                        Err(error) => {
                            self.mode(LiveUpdateMode::Reconnecting, Some(error)).await;
                            baseline = false;
                            self.reconcile().await;
                        }
                    }
                    tokio::time::sleep(Duration::from_secs(2)).await;
                }
            }
        });
        handle
    }
    async fn mode(&self, mode: LiveUpdateMode, reason: Option<String>) {
        self.source.set_sync_mode(mode, reason).await;
        self.app
            .emit("project_backend_status_changed", self.source.status().await)
            .ok();
    }
    fn emit_list_changed(&self) {
        self.app
            .emit(
                "task_list_changed",
                TaskListChangedPayload {
                    project: self.source.project_path.clone(),
                },
            )
            .ok();
    }
    async fn reconcile(&self) {
        self.app
            .emit("project_backend_status_changed", self.source.status().await)
            .ok();
        if self.source.list_issues().await.is_ok() {
            let _ = crate::commands::openspec::reconcile_tasks_checkboxes(
                &self.source.project_path,
                &self.source,
            )
            .await;
            self.emit_list_changed();
        }
    }
    async fn bootstrap(&self) -> Result<(i64, Option<JournalRecord>), String> {
        if self.source.is_http() {
            let (head, records) =
                load_http_history(|since, limit| self.source.events_page(since, limit)).await?;
            for record in &records {
                self.process(record, false).await;
            }
            self.source.list_issues().await?;
            self.emit_list_changed();
            let anchor = records.last().cloned();
            Ok((head, anchor))
        } else {
            let (head, last) = self.cli_drain(0, false).await?;
            self.source.list_issues().await?;
            self.emit_list_changed();
            Ok((head, last))
        }
    }
    async fn http_checkpoint_valid(&self, checkpoint: i64, anchor: Option<&JournalRecord>) -> bool {
        if let Ok(page) = self.source.events_page(i64::MAX, 1).await {
            if page.head < checkpoint {
                return false;
            }
        }
        if let Some(last) = anchor {
            match self.source.events_page(last.seq.saturating_sub(1), 1).await {
                Ok(page) => {
                    if page.records.first() != Some(last) {
                        return false;
                    }
                }
                Err(FeedError::Truncated { .. }) => return false,
                _ => {}
            }
        }
        true
    }
    async fn http_drain(&self, mut since: i64, live: bool) -> Result<i64, FeedError> {
        for _ in 0..100 {
            let page = self.source.events_page(since, 1000).await?;
            if page.head < since {
                return Err(FeedError::Truncated {
                    floor: 0,
                    head: page.head,
                });
            }
            if page.records.is_empty() {
                return Ok(since);
            }
            for record in page.records {
                if record.seq > since {
                    self.process(&record, live).await;
                    since = record.seq;
                }
            }
        }
        Ok(since)
    }
    async fn cli_records(&self, since: i64, limit: u32) -> Result<Vec<JournalRecord>, String> {
        let since = since.to_string();
        let limit = limit.to_string();
        let output = self
            .source
            .run_cli(&[
                "events", "tail", "--since", &since, "--limit", &limit, "--json",
            ])
            .await?;
        output
            .lines()
            .filter(|line| !line.trim().is_empty())
            .map(|line| {
                serde_json::from_str(line).map_err(|e| format!("Invalid journal record: {e}"))
            })
            .collect()
    }
    async fn cli_drain(
        &self,
        mut since: i64,
        live: bool,
    ) -> Result<(i64, Option<JournalRecord>), String> {
        let mut last = None;
        for _ in 0..100 {
            let records = match self.cli_records(since, 1000).await {
                Ok(records) => records,
                Err(error) if !live => {
                    if let Some(window) = truncated_window(&error) {
                        since = window.0.saturating_sub(1);
                        continue;
                    }
                    return Err(error);
                }
                Err(error) => return Err(error),
            };
            if records.is_empty() {
                return Ok((since, last));
            }
            for record in records {
                if record.seq > since {
                    self.process(&record, live).await;
                    since = record.seq;
                    last = Some(record);
                }
            }
        }
        Ok((since, last))
    }
    async fn process(&self, record: &JournalRecord, live: bool) {
        let event = ActivityEvent {
            id: format!("bd:journal:{}:{}:{}", record.seq, record.ts, record.op),
            ts: record.ts.clone(),
            kind: format!("bd.{}", record.op),
            source: "bd".into(),
            summary: format!("Issue {}: {}", record.issue_id, record.op),
            detail: serde_json::to_string(record).unwrap_or_default(),
            correlation_id: Some(record.issue_id.clone()),
        };
        if live {
            emit_project_event(&self.app, &self.source.project_path, event);
            let _ = crate::commands::openspec::reconcile_tasks_checkboxes(
                &self.source.project_path,
                &self.source,
            )
            .await;
            self.app
                .emit(
                    "tasks_changed",
                    TasksChangedPayload {
                        project: self.source.project_path.clone(),
                        task_ids: vec![record.issue_id.clone()],
                    },
                )
                .ok();
        } else {
            retain_project_event(&self.source.project_path, event);
        }
    }
}

async fn load_http_history<F, Fut>(mut events_page: F) -> Result<(i64, Vec<JournalRecord>), String>
where
    F: FnMut(i64, u32) -> Fut,
    Fut: std::future::Future<Output = Result<EventsPage, FeedError>>,
{
    let head = events_page(i64::MAX, 1)
        .await
        .map_err(|e| e.to_string())?
        .head;
    let mut records = Vec::new();
    // The activity buffer retains 5000 records. Start near the captured head so
    // large journals cannot exhaust the backfill budget on obsolete history.
    let mut since = head.saturating_sub(5000).max(0);
    for _ in 0..100 {
        if since >= head {
            return Ok((head, records));
        }
        match events_page(since, 1000).await {
            Ok(page) => {
                if page.head < head {
                    return Err("Journal reset during history bootstrap".into());
                }
                let previous = since;
                for record in page.records {
                    if record.seq > since && record.seq <= head {
                        since = record.seq;
                        records.push(record);
                    }
                }
                if since == previous {
                    return Err("Journal history did not reach the captured head".into());
                }
            }
            Err(FeedError::Truncated {
                floor,
                head: current_head,
            }) if floor > since && floor <= head && current_head >= head => {
                since = floor.saturating_sub(1);
            }
            Err(error) => return Err(error.to_string()),
        }
    }
    if since >= head {
        Ok((head, records))
    } else {
        Err("Journal history bootstrap exceeded its page budget".into())
    }
}

fn truncated_window(error: &str) -> Option<(i64, i64)> {
    let start = error.find('{')?;
    let end = error[start..].rfind('}')? + start;
    let value: serde_json::Value = serde_json::from_str(&error[start..=end]).ok()?;
    if value["code"] != "events_journal_truncated" {
        return None;
    }
    Some((value["floor"].as_i64()?, value["head"].as_i64()?))
}
#[cfg(test)]
mod tests {
    use super::*;

    fn record(seq: i64) -> JournalRecord {
        serde_json::from_value(serde_json::json!({
            "seq": seq, "ts": "2026-10-16T00:00:00Z", "op": "update", "issue_id": "B-1"
        }))
        .unwrap()
    }

    #[tokio::test]
    async fn bootstrap_loads_recent_window_even_with_over_100_batches_of_history() {
        let (head, records) = load_http_history(|since, limit| {
            std::future::ready(Ok(EventsPage {
                head: 200_000,
                records: if since == i64::MAX {
                    vec![]
                } else {
                    ((since + 1)..=200_000)
                        .take(limit as usize)
                        .map(record)
                        .collect()
                },
            }))
        })
        .await
        .unwrap();
        assert_eq!(head, 200_000);
        assert_eq!(records.len(), 5000);
        assert_eq!(records.first().unwrap().seq, 195_001);
        assert_eq!(records.last().unwrap().seq, head);
    }

    #[tokio::test]
    async fn bootstrap_does_not_accept_partial_history_after_page_failure() {
        let result = load_http_history(|since, _| {
            std::future::ready(match since {
                i64::MAX => Ok(EventsPage {
                    head: 2,
                    records: vec![],
                }),
                0 => Ok(EventsPage {
                    head: 2,
                    records: vec![record(1)],
                }),
                _ => Err(FeedError::Other("temporary failure".into())),
            })
        })
        .await;
        assert_eq!(result.unwrap_err(), "temporary failure");
    }

    #[tokio::test]
    async fn bootstrap_does_not_accept_partial_history_at_batch_limit() {
        let result = load_http_history(|since, _| {
            std::future::ready(Ok(EventsPage {
                head: 5000,
                records: if since == i64::MAX {
                    vec![]
                } else {
                    vec![record(since + 1)]
                },
            }))
        })
        .await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn bootstrap_rejects_empty_or_reset_pages_before_captured_head() {
        for current_head in [0, 2] {
            let result = load_http_history(|since, _| {
                std::future::ready(Ok(EventsPage {
                    head: if since == i64::MAX { 2 } else { current_head },
                    records: vec![],
                }))
            })
            .await;
            assert!(result.is_err());
        }
    }

    #[tokio::test]
    async fn bootstrap_recovers_retention_and_stops_at_initial_head() {
        let (head, records) = load_http_history(|since, _| {
            std::future::ready(match since {
                i64::MAX => Ok(EventsPage {
                    head: 20,
                    records: vec![],
                }),
                0 => Err(FeedError::Truncated {
                    floor: 19,
                    head: 20,
                }),
                18 => Ok(EventsPage {
                    head: 21,
                    records: vec![record(19), record(20), record(21)],
                }),
                _ => Ok(EventsPage {
                    head: 21,
                    records: vec![],
                }),
            })
        })
        .await
        .unwrap();
        assert_eq!(head, 20);
        assert_eq!(records.iter().map(|r| r.seq).collect::<Vec<_>>(), [19, 20]);
    }
    #[test]
    fn native_truncation_envelope_retains_window() {
        assert_eq!(
            truncated_window(
                "bd failed: {\"code\":\"events_journal_truncated\",\"floor\":5,\"head\":20}"
            ),
            Some((5, 20))
        );
        assert_eq!(truncated_window("invalid journal"), None);
    }
}
