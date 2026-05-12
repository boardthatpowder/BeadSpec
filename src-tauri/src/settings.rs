use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct NotificationPrefs {
    pub assignment: bool,
    pub unblock: bool,
    pub comment: bool,
    pub global_mute: bool,
}

impl Default for NotificationPrefs {
    fn default() -> Self {
        Self {
            assignment: true,
            unblock: true,
            comment: true,
            global_mute: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct BinaryPaths {
    pub bd: String,
    pub openspec: String,
    pub ruflo: String,
    pub dolt: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct FeatureFlags {
    pub openspec: bool,
    pub ruflo: bool,
}

impl Default for FeatureFlags {
    fn default() -> Self {
        Self {
            openspec: true,
            ruflo: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct AppSettings {
    pub features: FeatureFlags,
    pub binary_paths: BinaryPaths,
    pub actor: String,
    pub quick_capture_shortcut: String,
    pub density: String,
    pub zoom: f64,
    pub notification_prefs: NotificationPrefs,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            features: FeatureFlags::default(),
            binary_paths: BinaryPaths::default(),
            actor: "me".to_string(),
            quick_capture_shortcut: "CmdOrCtrl+Shift+N".to_string(),
            density: "default".to_string(),
            zoom: 1.0,
            notification_prefs: NotificationPrefs::default(),
        }
    }
}

/// Mirrors the file layout written by @tauri-apps/plugin-store:
/// `{ "settings": { ... } }`
#[derive(Debug, Deserialize)]
struct StoreFile {
    settings: Option<AppSettings>,
}

pub fn load_settings(app: &AppHandle) -> AppSettings {
    let path = match app.path().app_data_dir() {
        Ok(d) => d.join("settings.json"),
        Err(_) => return AppSettings::default(),
    };
    let content = match std::fs::read_to_string(&path) {
        Ok(c) => c,
        Err(_) => return AppSettings::default(),
    };
    match serde_json::from_str::<StoreFile>(&content) {
        Ok(store) => store.settings.unwrap_or_default(),
        Err(_) => AppSettings::default(),
    }
}
