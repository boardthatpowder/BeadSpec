use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::time::Duration;

use notify::{EventKind, RecursiveMode, Watcher};
use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;

use super::poller::PollHandle;

/// Payload emitted on the `changes_list_changed` event.
#[derive(Debug, Clone, Serialize)]
pub struct ChangesListChangedPayload {
    pub project: String,
}

pub struct OpenSpecWatchHandle {
    running: Arc<AtomicBool>,
}

impl OpenSpecWatchHandle {
    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
    }
}

pub struct OpenSpecWatcher {
    project_path: String,
    app: AppHandle,
}

impl OpenSpecWatcher {
    pub fn new(project_path: String, app: AppHandle) -> Self {
        Self { project_path, app }
    }

    /// Start watching `openspec/changes/` for directory create/remove events.
    /// Failures are silent — the watcher thread exits, the channel closes,
    /// and the tokio task terminates cleanly.
    pub fn start(self) -> OpenSpecWatchHandle {
        let changes_dir = PathBuf::from(&self.project_path).join("openspec/changes");
        let project = self.project_path.clone();
        let app = self.app.clone();

        let running = Arc::new(AtomicBool::new(true));
        let running_watch = Arc::clone(&running);
        let running_tokio = Arc::clone(&running);

        let (tx, mut rx) = mpsc::channel::<()>(16);

        std::thread::spawn(move || {
            let mut watcher =
                match notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
                    if let Ok(event) = res {
                        if matches!(
                            event.kind,
                            EventKind::Create(_) | EventKind::Remove(_) | EventKind::Modify(_)
                        ) {
                            // Only react to .md files or directory-level events (no extension)
                            // to avoid noise from editor swap/temp files.
                            let relevant = event.paths.iter().any(|p| {
                                matches!(p.extension().and_then(|e| e.to_str()), Some("md") | None)
                            });
                            if relevant {
                                let _ = tx.try_send(());
                            }
                        }
                    }
                }) {
                    Ok(w) => w,
                    Err(_) => return,
                };

            if watcher
                .watch(&changes_dir, RecursiveMode::Recursive)
                .is_err()
            {
                return;
            }

            while running_watch.load(Ordering::SeqCst) {
                std::thread::sleep(Duration::from_millis(200));
            }
        });

        tokio::spawn(async move {
            while rx.recv().await.is_some() {
                if !running_tokio.load(Ordering::SeqCst) {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(500)).await;
                while rx.try_recv().is_ok() {}

                if running_tokio.load(Ordering::SeqCst) {
                    app.emit(
                        "changes_list_changed",
                        ChangesListChangedPayload {
                            project: project.clone(),
                        },
                    )
                    .ok();
                }
            }
        });

        OpenSpecWatchHandle { running }
    }
}

/// Tracks the active `PollHandle`, `WatchHandle`, and `OpenSpecWatchHandle`
/// for each connected project.
/// Keyed by project path. Thread-safe — intended to be stored in Tauri's `.manage()`.
pub struct WatcherRegistry {
    inner: Mutex<HashMap<String, (PollHandle, OpenSpecWatchHandle)>>,
    lifecycle: Mutex<HashMap<String, Arc<tokio::sync::Mutex<()>>>>,
}

impl Default for WatcherRegistry {
    fn default() -> Self {
        Self::new()
    }
}

impl WatcherRegistry {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(HashMap::new()),
            lifecycle: Mutex::new(HashMap::new()),
        }
    }

    /// Connection commands share a gate so disconnect cannot race journal opt-in registration.
    pub fn lifecycle_gate(&self, project: &str) -> Arc<tokio::sync::Mutex<()>> {
        let key = std::fs::canonicalize(project)
            .map(|p| p.to_string_lossy().into_owned())
            .unwrap_or_else(|_| project.into());
        self.lifecycle
            .lock()
            .unwrap()
            .entry(key)
            .or_default()
            .clone()
    }
    /// Register (or replace) the handles for a project, stopping any existing ones first.
    pub fn register(
        &self,
        project_path: String,
        poll: PollHandle,
        openspec_watch: OpenSpecWatchHandle,
    ) {
        let project_path = std::fs::canonicalize(&project_path)
            .map(|path| path.to_string_lossy().into_owned())
            .unwrap_or(project_path);
        self.stop_project(&project_path);
        if let Ok(mut map) = self.inner.lock() {
            map.insert(project_path, (poll, openspec_watch));
        }
    }

    /// Stop and remove the handles for a project.
    pub fn stop_project(&self, project_path: &str) {
        let canonical = std::fs::canonicalize(project_path)
            .map(|path| path.to_string_lossy().into_owned())
            .unwrap_or_else(|_| project_path.into());
        if let Ok(mut map) = self.inner.lock() {
            if let Some((poll, openspec_watch)) = map.remove(&canonical) {
                poll.stop();
                openspec_watch.stop();
            }
        }
    }
}
