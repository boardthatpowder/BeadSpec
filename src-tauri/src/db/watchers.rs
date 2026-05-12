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

use super::poller::{PollHandle, TaskListChangedPayload};
use crate::db::dolt_server::DoltServerRegistry;
use crate::settings::AppSettings;

/// Payload emitted on the `changes_list_changed` event.
#[derive(Debug, Clone, Serialize)]
pub struct ChangesListChangedPayload {
    pub project: String,
}

pub struct WatchHandle {
    running: Arc<AtomicBool>,
}

impl WatchHandle {
    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
    }
}

pub struct JsonlWatcher {
    project_path: String,
    app: AppHandle,
    settings: Arc<Mutex<AppSettings>>,
    server_registry: Arc<DoltServerRegistry>,
}

impl JsonlWatcher {
    pub fn new(
        project_path: String,
        app: AppHandle,
        settings: Arc<Mutex<AppSettings>>,
        server_registry: Arc<DoltServerRegistry>,
    ) -> Self {
        Self {
            project_path,
            app,
            settings,
            server_registry,
        }
    }

    /// Start watching `.beads/issues.jsonl` for changes. Failures are silent — the
    /// watcher thread exits, the channel closes, and the tokio task terminates cleanly.
    pub fn start(self) -> WatchHandle {
        let beads_dir = PathBuf::from(&self.project_path).join(".beads");
        let project = self.project_path.clone();
        let app = self.app.clone();
        let settings = self.settings.clone();
        let server_registry = self.server_registry.clone();

        let running = Arc::new(AtomicBool::new(true));
        let running_watch = Arc::clone(&running);
        let running_tokio = Arc::clone(&running);

        let (tx, mut rx) = mpsc::channel::<()>(16);

        // The watcher lives on its own OS thread so we don't need notify::RecommendedWatcher
        // to be Send (on macOS it wraps an FSEventStream which isn't Send).
        std::thread::spawn(move || {
            let mut watcher =
                match notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
                    if let Ok(event) = res {
                        let is_jsonl = event
                            .paths
                            .iter()
                            .any(|p| p.file_name().map(|f| f == "issues.jsonl").unwrap_or(false));
                        if is_jsonl
                            && matches!(event.kind, EventKind::Modify(_) | EventKind::Create(_))
                        {
                            let _ = tx.try_send(());
                        }
                    }
                }) {
                    Ok(w) => w,
                    Err(_) => return, // tx drops → rx.recv() returns None → tokio task exits
                };

            if watcher
                .watch(&beads_dir, RecursiveMode::NonRecursive)
                .is_err()
            {
                return;
            }

            // Keep the watcher alive until stop() is called.
            while running_watch.load(Ordering::SeqCst) {
                std::thread::sleep(Duration::from_millis(200));
            }
            // Watcher drops here; tx inside the closure drops too.
        });

        // Debounce events and emit `task_list_changed` on the Tauri event bus.
        tokio::spawn(async move {
            while rx.recv().await.is_some() {
                if !running_tokio.load(Ordering::SeqCst) {
                    break;
                }
                // Drain the burst and wait for a quiet period before emitting.
                tokio::time::sleep(Duration::from_millis(500)).await;
                while rx.try_recv().is_ok() {}

                if running_tokio.load(Ordering::SeqCst) {
                    // Reconcile OpenSpec tasks.md checkboxes before notifying the UI so
                    // the frontend's re-fetch sees up-to-date progress counts.
                    let (bd_path_override, dolt_path_override) = settings
                        .lock()
                        .map(|s| (s.binary_paths.bd.clone(), s.binary_paths.dolt.clone()))
                        .unwrap_or_default();
                    if let Some(bd) = crate::bd::runner::find_bd(&bd_path_override) {
                        let _ = crate::commands::openspec::reconcile_tasks_checkboxes(
                            &project,
                            &bd,
                            &server_registry,
                            &dolt_path_override,
                        )
                        .await;
                    }

                    app.emit(
                        "task_list_changed",
                        TaskListChangedPayload {
                            project: project.clone(),
                        },
                    )
                    .ok();
                }
            }
        });

        WatchHandle { running }
    }
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
    inner: Mutex<HashMap<String, (PollHandle, WatchHandle, OpenSpecWatchHandle)>>,
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
        }
    }

    /// Register (or replace) the handles for a project, stopping any existing ones first.
    pub fn register(
        &self,
        project_path: String,
        poll: PollHandle,
        watch: WatchHandle,
        openspec_watch: OpenSpecWatchHandle,
    ) {
        self.stop_project(&project_path);
        if let Ok(mut map) = self.inner.lock() {
            map.insert(project_path, (poll, watch, openspec_watch));
        }
    }

    /// Stop and remove the handles for a project.
    pub fn stop_project(&self, project_path: &str) {
        if let Ok(mut map) = self.inner.lock() {
            if let Some((poll, watch, openspec_watch)) = map.remove(project_path) {
                poll.stop();
                watch.stop();
                openspec_watch.stop();
            }
        }
    }
}
