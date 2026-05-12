use sqlx::Row;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::time;

use super::pool::DoltPool;

/// Emitted when specific tasks change. Payload: list of changed task IDs.
#[derive(Clone, serde::Serialize)]
pub struct TasksChangedPayload {
    pub project: String,
    pub task_ids: Vec<String>,
}

/// Emitted when tasks are created or deleted (full list refresh needed).
#[derive(Clone, serde::Serialize)]
pub struct TaskListChangedPayload {
    pub project: String,
}

pub struct DoltPoller {
    pool: DoltPool,
    app: AppHandle,
    running: Arc<AtomicBool>,
    paused: Arc<AtomicBool>,
}

impl DoltPoller {
    pub fn new(pool: DoltPool, app: AppHandle) -> Self {
        Self {
            pool,
            app,
            running: Arc::new(AtomicBool::new(false)),
            paused: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Start polling in a background tokio task. Returns a handle to stop/pause/resume it.
    pub fn start(&self) -> PollHandle {
        let running = Arc::clone(&self.running);
        let paused = Arc::clone(&self.paused);
        running.store(true, Ordering::SeqCst);
        paused.store(false, Ordering::SeqCst);

        let pool = self.pool.clone();
        let app = self.app.clone();
        let project = self.pool.project_path.clone();
        let running_clone = Arc::clone(&running);
        let paused_clone = Arc::clone(&paused);

        tokio::spawn(async move {
            let mut last_hash: Option<String> = None;

            while running_clone.load(Ordering::SeqCst) {
                if !paused_clone.load(Ordering::SeqCst) {
                    if let Ok(hash) = current_commit_hash(pool.pool()).await {
                        if let Some(ref prev) = last_hash {
                            if *prev != hash {
                                // Hash changed — diff to find changed task IDs
                                let changed = changed_task_ids(pool.pool(), prev, &hash).await;
                                match changed {
                                    Ok(ids) if ids.is_empty() => {
                                        // Structural change (create/delete) — full refresh
                                        app.emit(
                                            "task_list_changed",
                                            TaskListChangedPayload {
                                                project: project.clone(),
                                            },
                                        )
                                        .ok();
                                    }
                                    Ok(ids) => {
                                        app.emit(
                                            "tasks_changed",
                                            TasksChangedPayload {
                                                project: project.clone(),
                                                task_ids: ids,
                                            },
                                        )
                                        .ok();
                                    }
                                    Err(_) => {
                                        // On diff error, emit full refresh
                                        app.emit(
                                            "task_list_changed",
                                            TaskListChangedPayload {
                                                project: project.clone(),
                                            },
                                        )
                                        .ok();
                                    }
                                }
                                last_hash = Some(hash);
                            }
                        } else {
                            last_hash = Some(hash);
                        }
                    }
                }

                time::sleep(Duration::from_secs(2)).await;
            }
        });

        PollHandle { running, paused }
    }
}

pub struct PollHandle {
    running: Arc<AtomicBool>,
    paused: Arc<AtomicBool>,
}

impl PollHandle {
    /// Stop the poller permanently; the background task will exit on next iteration.
    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
    }

    /// Pause polling (background task stays alive but skips DB checks).
    /// Call when the window is hidden or minimized.
    pub fn pause(&self) {
        self.paused.store(true, Ordering::SeqCst);
    }

    /// Resume polling after a pause. Call when the window regains focus.
    pub fn resume(&self) {
        self.paused.store(false, Ordering::SeqCst);
    }
}

async fn current_commit_hash(pool: &sqlx::Pool<sqlx::MySql>) -> Result<String, sqlx::Error> {
    // Dolt exposes commit history via dolt_log table
    let row = sqlx::query("SELECT commit_hash FROM dolt_log LIMIT 1")
        .fetch_one(pool)
        .await?;
    row.try_get::<String, _>(0)
}

async fn changed_task_ids(
    pool: &sqlx::Pool<sqlx::MySql>,
    from_hash: &str,
    to_hash: &str,
) -> Result<Vec<String>, sqlx::Error> {
    // Use dolt_diff to find changed rows in the issues table between two commits
    // Returns empty vec if the change was structural (table create/drop) or on error
    let rows = sqlx::query(
        "SELECT to_id FROM dolt_diff('issues', ?, ?) WHERE diff_type != 'removed' LIMIT 500",
    )
    .bind(from_hash)
    .bind(to_hash)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .iter()
        .filter_map(|r| r.try_get::<String, _>(0).ok())
        .collect())
}
