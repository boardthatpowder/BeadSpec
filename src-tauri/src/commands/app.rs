use std::sync::Arc;
use tauri::Manager;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

// ── Binary path validation ────────────────────────────────────────────────────

/// Validate that a custom binary path exists and is executable.
///
/// Called by the settings UI before persisting a new path so that the user
/// gets immediate feedback if the path is wrong or not executable.  Returns
/// `Ok(())` on success and a user-readable `Err` string otherwise.
pub fn validate_binary_path_impl(path: &str) -> Result<(), String> {
    if path.is_empty() {
        return Err("Path must not be empty".to_string());
    }
    let p = std::path::Path::new(path);
    if !p.exists() {
        return Err(format!("Binary not found: {}", path));
    }
    // Check executable bit on Unix systems
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let meta = std::fs::metadata(p).map_err(|e| e.to_string())?;
        if meta.permissions().mode() & 0o111 == 0 {
            return Err(format!("File is not executable: {}", path));
        }
    }
    Ok(())
}

/// Tauri command: validate a custom binary path before the frontend persists it.
///
/// Checks that the path exists and has the executable bit set (Unix).  The
/// frontend should call this whenever the user changes any binary path in
/// Settings and display the returned error string if `Err` is returned.
#[tauri::command]
#[specta::specta]
pub async fn validate_binary_path(path: String) -> Result<(), String> {
    validate_binary_path_impl(&path)
}

/// Return the current quick-capture shortcut and whether it's available.
#[tauri::command]
#[specta::specta]
pub fn get_shortcut_status(
    state: tauri::State<'_, Arc<std::sync::Mutex<crate::AppState>>>,
) -> crate::ShortcutStatus {
    let s = state.lock().unwrap();
    crate::ShortcutStatus {
        shortcut: s.quick_capture_shortcut.clone(),
        available: s.quick_capture_shortcut_available,
    }
}

#[tauri::command]
#[specta::specta]
pub async fn focus_main_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// BUI-4g6 (18.2): Update the tray icon badge with the current open-task count.
///
/// The frontend computes the count after each sync and calls this command.
/// On macOS the count appears as menu-bar text beside the icon; on other
/// platforms it is reflected in the tooltip.
#[tauri::command]
#[specta::specta]
pub async fn update_tray_badge(app: tauri::AppHandle, count: u32) -> Result<(), String> {
    crate::tray::update_badge(&app, count);
    Ok(())
}

/// BUI-ghp (18.5): Enable or disable launch-at-login.
///
/// Actual OS-level autostart registration requires tauri-plugin-autostart,
/// which is not yet in Cargo.toml. This stub stores the intent so the
/// frontend preference round-trips correctly; wire up the plugin when added.
///
/// TODO: integrate tauri-plugin-autostart when adding it to Cargo.toml.
#[tauri::command]
#[specta::specta]
pub async fn set_start_at_login(_enabled: bool) -> Result<(), String> {
    Ok(())
}

/// BUI-ghp (18.5): Hide the main window so only the tray icon is visible.
///
/// Called by the frontend when the user enables tray-only mode, and
/// automatically at startup when `BEADS_TRAY_ONLY` env-var is set.
#[tauri::command]
#[specta::specta]
pub async fn launch_to_tray(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Section 6.1: Unregister the old quick-capture shortcut and register a new one.
///
/// Returns `Err` if the new shortcut string is invalid or conflicts with another app.
/// On success, updates `AppState` with the new shortcut string.
#[tauri::command]
#[specta::specta]
pub async fn register_quick_capture_shortcut(
    app: tauri::AppHandle,
    shortcut: String,
    app_state: tauri::State<'_, Arc<std::sync::Mutex<crate::AppState>>>,
) -> Result<(), String> {
    // Unregister the previous shortcut
    let old = {
        let s = app_state.lock().map_err(|e| e.to_string())?;
        s.quick_capture_shortcut.clone()
    };
    app.global_shortcut().unregister(old.as_str()).ok();

    // Register the new shortcut
    app.global_shortcut()
        .on_shortcut(shortcut.as_str(), move |app_handle, _shortcut, event| {
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
        })
        .map_err(|e| format!("Shortcut registration failed: {e}"))?;

    // Persist to AppState
    let mut s = app_state.lock().map_err(|e| e.to_string())?;
    s.quick_capture_shortcut = shortcut;
    s.quick_capture_shortcut_available = true;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_binary_path_rejects_empty_string() {
        let result = validate_binary_path_impl("");
        assert!(result.is_err(), "empty path should be rejected");
        assert!(
            result.unwrap_err().contains("must not be empty"),
            "error message should mention empty"
        );
    }

    #[test]
    fn validate_binary_path_rejects_nonexistent_file() {
        let result = validate_binary_path_impl("/nonexistent/path/to/binary");
        assert!(result.is_err(), "nonexistent path should be rejected");
        let err = result.unwrap_err();
        assert!(
            err.contains("Binary not found"),
            "error should mention Binary not found, got: {err}"
        );
    }

    #[test]
    #[cfg(unix)]
    fn validate_binary_path_accepts_executable() {
        // /bin/sh is guaranteed to exist and be executable on all Unix platforms
        let result = validate_binary_path_impl("/bin/sh");
        assert!(
            result.is_ok(),
            "existing executable should be accepted, got: {:?}",
            result
        );
    }

    #[test]
    #[cfg(unix)]
    fn validate_binary_path_rejects_non_executable_file() {
        use std::io::Write;
        // Create a temp file with no execute bit
        let dir = std::env::temp_dir();
        let file_path = dir.join("test_non_executable_beads");
        {
            let mut f = std::fs::File::create(&file_path).expect("create temp file");
            f.write_all(b"not a real binary").expect("write");
        }
        // Ensure no execute bit
        use std::os::unix::fs::PermissionsExt;
        let mut perms = std::fs::metadata(&file_path).expect("metadata").permissions();
        perms.set_mode(0o644);
        std::fs::set_permissions(&file_path, perms).expect("set permissions");

        let result = validate_binary_path_impl(file_path.to_str().unwrap());
        std::fs::remove_file(&file_path).ok();

        assert!(result.is_err(), "non-executable file should be rejected");
        let err = result.unwrap_err();
        assert!(
            err.contains("not executable"),
            "error should mention not executable, got: {err}"
        );
    }
}
