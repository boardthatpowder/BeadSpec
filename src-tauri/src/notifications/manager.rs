use tauri::{AppHandle, Runtime};
use tauri_plugin_notification::NotificationExt;

/// User notification preferences — stored via Tauri store (wired in 17.6)
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
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

pub struct NotificationManager<R: Runtime> {
    app: AppHandle<R>,
    pub prefs: NotificationPrefs,
}

impl<R: Runtime> NotificationManager<R> {
    pub fn new(app: AppHandle<R>) -> Self {
        Self {
            app,
            prefs: NotificationPrefs::default(),
        }
    }

    pub fn send(&self, title: &str, body: &str) -> Result<(), tauri_plugin_notification::Error> {
        if self.prefs.global_mute {
            return Ok(());
        }
        self.app
            .notification()
            .builder()
            .title(title)
            .body(body)
            .show()
    }

    /// Fire a notification that carries a task ID so the click handler can navigate.
    pub fn send_with_task(
        &self,
        title: &str,
        body: &str,
        task_id: &str,
    ) -> Result<(), tauri_plugin_notification::Error> {
        if self.prefs.global_mute {
            return Ok(());
        }
        self.app
            .notification()
            .builder()
            .title(title)
            .body(body)
            // Store task_id in extra data for click routing
            .extra("task_id", task_id)
            .show()
    }

    pub fn send_if(&self, enabled: bool, title: &str, body: &str) {
        if enabled && !self.prefs.global_mute {
            self.send(title, body).ok();
        }
    }

    /// Fire if the assignee of a task changed to the current user.
    pub fn notify_assignment(&self, task_id: &str, task_title: &str, assigned_by: &str) {
        self.send_if(
            self.prefs.assignment,
            "Task Assigned to You",
            &format!("{assigned_by} assigned \"{task_title}\" (#{task_id}) to you"),
        )
    }

    /// Fire when a blocking dependency for a current-user task is closed.
    pub fn notify_unblocked(&self, task_id: &str, task_title: &str, blocker_title: &str) {
        self.send_if(
            self.prefs.unblock,
            "Task Unblocked",
            &format!("\"{blocker_title}\" was closed — \"{task_title}\" (#{task_id}) is now ready"),
        )
    }

    /// Fire when a comment is added to a task owned/assigned to the current user.
    pub fn notify_comment(&self, _task_id: &str, task_title: &str, commenter: &str, preview: &str) {
        // Truncate preview to 80 chars
        let preview_short = if preview.len() > 80 {
            format!("{}…", &preview[..80])
        } else {
            preview.to_string()
        };
        self.send_if(
            self.prefs.comment,
            &format!("{commenter} commented on \"{task_title}\""),
            &preview_short,
        )
    }
}

/// Returns the current Beads actor — mirrors what bd uses for the actor field.
pub fn current_actor() -> String {
    std::env::var("BEADS_ACTOR")
        .or_else(|_| {
            std::process::Command::new("git")
                .args(["config", "user.name"])
                .output()
                .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        })
        .unwrap_or_else(|_| std::env::var("USER").unwrap_or_else(|_| "unknown".into()))
}
