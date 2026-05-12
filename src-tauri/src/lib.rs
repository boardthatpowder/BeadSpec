pub mod bd;
pub mod commands;
pub mod db;
pub mod notifications;
pub mod recovery_log;
pub mod settings;
pub mod tray;

use std::sync::{Arc, Mutex};
use tauri::{Emitter, Listener, Manager};
use tauri_specta::Builder;

use crate::settings::AppSettings;

// ── App-wide state ─────────────────────────────────────────────────────────────

/// Mutable application state managed via `tauri::State`.
pub struct AppState {
    /// The shortcut string used for global quick-capture (default: CmdOrCtrl+Shift+N).
    pub quick_capture_shortcut: String,
    /// Whether the shortcut was successfully registered (false = conflict).
    pub quick_capture_shortcut_available: bool,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            quick_capture_shortcut: "CmdOrCtrl+Shift+N".to_string(),
            quick_capture_shortcut_available: false,
        }
    }
}

/// Status of the quick-capture shortcut — exposed to the frontend.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct ShortcutStatus {
    pub shortcut: String,
    pub available: bool,
}

pub fn make_specta_builder() -> Builder<tauri::Wry> {
    Builder::<tauri::Wry>::new().commands(tauri_specta::collect_commands![
        commands::write::create_task,
        commands::write::update_task_field,
        commands::write::change_task_status,
        commands::write::add_label,
        commands::write::remove_label,
        commands::write::add_comment,
        commands::write::delete_task,
        commands::write::link_dependency,
        commands::write::unlink_dependency,
        commands::project::connect_project,
        commands::project::disconnect_project,
        commands::project::list_projects,
        commands::read::list_tasks,
        commands::read::get_task,
        commands::read::get_task_history,
        commands::read::search_tasks,
        commands::app::focus_main_window,
        commands::app::update_tray_badge,
        commands::app::set_start_at_login,
        commands::app::launch_to_tray,
        commands::recovery::probe_dolt_health,
        commands::recovery::attempt_dolt_recovery,
        commands::external::bd_preflight,
        commands::external::bd_doctor,
        commands::external::bd_lint,
        commands::external::bd_stale,
        commands::external::bd_orphans,
        commands::external::bd_formula_list,
        commands::external::bd_formula_pour,
        commands::external::bd_human_list,
        commands::external::bd_human_respond,
        commands::external::bd_human_dismiss,
        commands::external::ruflo_memory_search,
        commands::external::ruflo_version_probe,
        commands::external::get_workspace_context,
        commands::external::get_git_refs_for_issue,
        commands::external::get_dolt_history_for_issue,
        commands::openspec::list_changes,
        commands::openspec::read_change_artifact,
        commands::openspec::get_change_progress,
        commands::openspec::run_openspec_validate,
        commands::openspec::import_change_to_beads,
        commands::openspec::reconcile_openspec_checkboxes,
        commands::app::get_shortcut_status,
        commands::app::register_quick_capture_shortcut,
        commands::app::validate_binary_path,
    ])
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let registry = Arc::new(db::pool::ProjectRegistry::new());
    let server_registry = Arc::new(db::dolt_server::DoltServerRegistry::new());
    let watcher_registry = Arc::new(db::watchers::WatcherRegistry::new());
    let app_state = Arc::new(Mutex::new(AppState::default()));
    // Section 2.2: AppSettings managed state — populated during setup once AppHandle is available.
    let settings_state: Arc<Mutex<AppSettings>> = Arc::new(Mutex::new(AppSettings::default()));

    let builder = make_specta_builder();

    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_denylist(&["quick-capture"])
                .build(),
        )
        .manage(registry)
        .manage(server_registry.clone())
        .manage(watcher_registry)
        .manage(app_state.clone())
        .manage(settings_state.clone())
        .setup(move |app| {
            builder.mount_events(app);

            if !crate::bd::runner::bd_available() {
                app.emit("bd_not_found", ()).ok();
            }

            // Set up system tray / menu-bar icon.
            tray::setup_tray(&app.handle()).ok();

            // Flush window state to disk on main window close so it persists even
            // when the process is killed without a clean RunEvent::Exit (e.g. dev mode).
            if let Some(window) = app.get_webview_window("main") {
                let handle = app.handle().clone();
                window.on_window_event(move |e| {
                    if let tauri::WindowEvent::CloseRequested { .. } = e {
                        use tauri_plugin_window_state::{AppHandleExt, StateFlags};
                        handle.save_window_state(StateFlags::all()).ok();
                    }
                });
            }

            // BEADSPEC-ghp (18.5): If launched in tray-only mode (e.g. at-login),
            // hide the main window immediately so only the tray icon is visible.
            if std::env::var("BEADS_TRAY_ONLY").is_ok() {
                if let Some(window) = app.get_webview_window("main") {
                    window.hide().ok();
                }
            }

            // Section 2.2: Load settings from disk and populate managed state + AppState shortcut.
            {
                let loaded = crate::settings::load_settings(app.handle());
                let shortcut_from_settings = loaded.quick_capture_shortcut.clone();
                {
                    let mut s = settings_state.lock().unwrap();
                    *s = loaded;
                }
                // Section 6.2: Use shortcut from settings rather than hardcoded default.
                if !shortcut_from_settings.is_empty() {
                    let mut s = app_state.lock().unwrap();
                    s.quick_capture_shortcut = shortcut_from_settings;
                }
            }

            // Section 2.3: Hot-reload AppSettings when frontend emits "settings-changed".
            {
                let state_clone = settings_state.clone();
                let handle = app.handle().clone();
                app.listen("settings-changed", move |_event| {
                    let reloaded = crate::settings::load_settings(&handle);
                    let mut s = state_clone.lock().unwrap();
                    *s = reloaded;
                });
            }

            // Register global shortcut for quick capture.
            // If registration fails (e.g. conflict with another app), log a warning
            // and set available=false — the app continues to work without the shortcut.
            {
                use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

                let shortcut_str = {
                    let s = app_state.lock().unwrap();
                    s.quick_capture_shortcut.clone()
                };

                let state_clone = app_state.clone();
                match app.handle().global_shortcut().on_shortcut(
                    shortcut_str.as_str(),
                    move |app_handle, _shortcut, event| {
                        if event.state() == ShortcutState::Pressed {
                            if let Some(window) = app_handle.get_webview_window("quick-capture") {
                                let visible = window.is_visible().unwrap_or(false);
                                if visible {
                                    window.hide().ok();
                                } else {
                                    window.show().ok();
                                    window.set_focus().ok();
                                }
                            }
                        }
                    },
                ) {
                    Ok(_) => {
                        let mut s = state_clone.lock().unwrap();
                        s.quick_capture_shortcut_available = true;
                    }
                    Err(e) => {
                        let mut s = state_clone.lock().unwrap();
                        s.quick_capture_shortcut_available = false;
                        eprintln!("[warn] quick-capture global shortcut conflict: {e}");
                    }
                }
            }

            Ok(())
        })
        .invoke_handler(make_specta_builder().invoke_handler())
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(move |_app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                let sr = server_registry.clone();
                tokio::spawn(async move { sr.stop_all().await });
            }
        });
}
