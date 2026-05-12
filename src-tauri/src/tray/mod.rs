use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Runtime,
};

/// Update the tray icon badge count.
///
/// On macOS the count is shown as text in the menu bar next to the icon.
/// On other platforms it is reflected in the tooltip only (title is unsupported
/// on Windows).
pub fn update_badge<R: Runtime>(app: &AppHandle<R>, count: u32) {
    if let Some(tray) = app.tray_by_id("main") {
        let label = if count == 0 {
            String::new()
        } else {
            count.to_string()
        };
        tray.set_title(Some(&label)).ok();
        tray.set_tooltip(Some(&format!("{count} open tasks"))).ok();
    }
}

/// Set up the system tray icon with an Open / Quit menu.
///
/// On macOS this appears as a menu-bar extra; on Windows/Linux it is a
/// notification-area (system tray) icon.
///
/// Left-click toggles window visibility; the menu provides "Open BeadSpec"
/// and "Quit" items.
pub fn setup_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let open_item = MenuItem::with_id(app, "open", "Open BeadSpec", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open_item, &quit_item])?;

    TrayIconBuilder::with_id("main")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => {
                if let Some(window) = app.get_webview_window("main") {
                    window.show().ok();
                    window.set_focus().ok();
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        window.hide().ok();
                    } else {
                        window.show().ok();
                        window.set_focus().ok();
                    }
                }
            }
        })
        .build(app)?;
    Ok(())
}
