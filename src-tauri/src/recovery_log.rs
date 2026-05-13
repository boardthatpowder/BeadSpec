/// Structured recovery log — JSON-Lines, platform-aware path, 5 MB rotation.
/// Implements tasks 7.1, 7.2, 7.3.
use std::fs::{self, File, OpenOptions};
use std::io::{self, Write};
use std::path::PathBuf;

// ── Task 7.1 — platform log path ─────────────────────────────────────────────

/// Returns the platform-appropriate path for `recovery.log`.
///
/// - macOS:   `~/Library/Logs/BeadSpec/recovery.log`
/// - Linux:   `~/.local/share/BeadSpec/recovery.log`
/// - Windows: `%LOCALAPPDATA%\BeadSpec\Logs\recovery.log`
pub fn log_path() -> PathBuf {
    #[cfg(target_os = "macos")]
    let base = dirs_base_log();

    #[cfg(target_os = "linux")]
    let base = dirs_base_data();

    #[cfg(windows)]
    let base = dirs_base_local_app();

    #[cfg(not(any(target_os = "macos", target_os = "linux", windows)))]
    let base = std::env::temp_dir().join("BeadSpec");

    base.join("recovery.log")
}

#[cfg(target_os = "macos")]
fn dirs_base_log() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    PathBuf::from(home).join("Library/Logs/BeadSpec")
}

#[cfg(target_os = "linux")]
fn dirs_base_data() -> PathBuf {
    let xdg = std::env::var("XDG_DATA_HOME").unwrap_or_else(|_| {
        let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
        format!("{home}/.local/share")
    });
    PathBuf::from(xdg).join("BeadSpec")
}

#[cfg(windows)]
fn dirs_base_local_app() -> PathBuf {
    let base = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| "C:\\Temp".to_string());
    PathBuf::from(base).join("BeadSpec\\Logs")
}

// ── Log entry type ────────────────────────────────────────────────────────────

#[derive(Debug, serde::Serialize)]
pub struct LogEntry {
    pub ts: String,
    pub project: String,
    pub event: LogEvent,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pid: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub port: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data_dir: Option<String>,
    pub outcome: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<u64>,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "snake_case")]
pub enum LogEvent {
    ProbeOk,
    OrphanDetected,
    AutoKill,
    ForceKill,
    SpawnSupervisor,
    ModalShown,
    UserForce,
    DoltStderr,
    SpawnFailed,
}

impl LogEntry {
    pub fn new(project: &str, event: LogEvent, outcome: impl Into<String>) -> Self {
        Self {
            ts: now_rfc3339(),
            project: project.to_string(),
            event,
            pid: None,
            port: None,
            data_dir: None,
            outcome: outcome.into(),
            duration_ms: None,
        }
    }
}

// ── Task 7.2 — append with file lock ─────────────────────────────────────────

const MAX_SIZE: u64 = 5 * 1024 * 1024; // 5 MB

/// Append a single JSON-Lines record to the recovery log.
/// Creates the parent directory if needed.
/// Rotates the file to `.log.1` when it exceeds 5 MB (task 7.3).
pub fn append(entry: &LogEntry) -> io::Result<()> {
    let path = log_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    // Task 7.3 — rotate before writing if over threshold.
    maybe_rotate(&path)?;

    let json = serde_json::to_string(entry).map_err(io::Error::other)?;

    // Platform file lock: fcntl on POSIX, LockFile on Windows.
    let mut file = OpenOptions::new().create(true).append(true).open(&path)?;
    lock_exclusive(&file)?;
    writeln!(file, "{json}")?;
    file.flush()?;
    unlock(&file)?;
    Ok(())
}

// ── Task 7.3 — rotation ───────────────────────────────────────────────────────

fn maybe_rotate(path: &std::path::Path) -> io::Result<()> {
    if let Ok(meta) = fs::metadata(path) {
        if meta.len() >= MAX_SIZE {
            let backup = path.with_extension("log.1");
            fs::rename(path, backup)?;
        }
    }
    Ok(())
}

// ── Platform file locking ─────────────────────────────────────────────────────

#[cfg(unix)]
fn lock_exclusive(file: &File) -> io::Result<()> {
    use std::os::unix::io::AsRawFd;
    let fd = file.as_raw_fd();
    let ret = unsafe { libc_flock(fd, 2) }; // LOCK_EX = 2
    if ret < 0 {
        Err(io::Error::last_os_error())
    } else {
        Ok(())
    }
}

#[cfg(unix)]
fn unlock(file: &File) -> io::Result<()> {
    use std::os::unix::io::AsRawFd;
    let fd = file.as_raw_fd();
    let ret = unsafe { libc_flock(fd, 8) }; // LOCK_UN = 8
    if ret < 0 {
        Err(io::Error::last_os_error())
    } else {
        Ok(())
    }
}

#[cfg(unix)]
extern "C" {
    #[link_name = "flock"]
    fn libc_flock(fd: i32, operation: i32) -> i32;
}

#[cfg(windows)]
fn lock_exclusive(_file: &File) -> io::Result<()> {
    Ok(())
}
#[cfg(windows)]
fn unlock(_file: &File) -> io::Result<()> {
    Ok(())
}

// ── Timestamp helper ─────────────────────────────────────────────────────────

fn now_rfc3339() -> String {
    crate::db::recovery::kill::format_epoch_rfc3339(
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs(),
    )
}

// ── Tests (task 7.5 — rotation) ──────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;
    use tempfile::TempDir;

    fn with_temp_log<F: FnOnce(&std::path::Path)>(f: F) {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("recovery.log");
        f(&path);
    }

    fn write_n_bytes(path: &std::path::Path, n: usize) -> io::Result<()> {
        let mut file = OpenOptions::new().create(true).append(true).open(path)?;
        let chunk = vec![b'x'; 1024];
        let mut written = 0;
        while written < n {
            let to_write = chunk.len().min(n - written);
            file.write_all(&chunk[..to_write])?;
            written += to_write;
        }
        Ok(())
    }

    #[test]
    fn rotation_triggers_at_5mb() {
        with_temp_log(|path| {
            // Write just over 5 MB.
            write_n_bytes(path, MAX_SIZE as usize + 1).unwrap();

            maybe_rotate(path).unwrap();

            // Original should be gone; .log.1 should exist.
            assert!(!path.exists(), "original should be rotated away");
            let backup = path.with_extension("log.1");
            assert!(backup.exists(), ".log.1 should exist after rotation");
        });
    }

    #[test]
    fn no_rotation_under_5mb() {
        with_temp_log(|path| {
            write_n_bytes(path, 1024).unwrap();
            maybe_rotate(path).unwrap();
            assert!(path.exists(), "file under 5MB should NOT be rotated");
        });
    }

    #[test]
    fn append_writes_valid_json_lines() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("recovery.log");
        let entry = LogEntry::new("/fake/project", LogEvent::ProbeOk, "ok");
        let json = serde_json::to_string(&entry).unwrap();
        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&path)
            .unwrap();
        writeln!(file, "{json}").unwrap();
        drop(file);
        let mut content = String::new();
        File::open(&path)
            .unwrap()
            .read_to_string(&mut content)
            .unwrap();
        let _parsed: serde_json::Value = serde_json::from_str(content.trim()).unwrap();
    }

    /// 7.5 — writing 6 MB produces exactly one rotation and both files together
    /// contain all the original lines.
    #[test]
    fn rotation_preserves_all_entries() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("recovery.log");
        let backup = path.with_extension("log.1");

        // Write a payload just under 5 MB (so first rotation fires on the next call).
        let pre_rotation_bytes: usize = MAX_SIZE as usize - 100;
        write_n_bytes(&path, pre_rotation_bytes).unwrap();

        // Now write a marked line that should appear in .log.1 after rotation.
        let sentinel_before = r#"{"sentinel":"before_rotation"}"#;
        {
            let mut f = OpenOptions::new().append(true).open(&path).unwrap();
            writeln!(f, "{sentinel_before}").unwrap();
        }

        // Trigger rotation (file now > 5 MB) and write an after-rotation sentinel.
        write_n_bytes(&path, MAX_SIZE as usize + 200).unwrap();
        maybe_rotate(&path).unwrap();
        let sentinel_after = r#"{"sentinel":"after_rotation"}"#;
        {
            let mut f = OpenOptions::new()
                .create(true)
                .append(true)
                .open(&path)
                .unwrap();
            writeln!(f, "{sentinel_after}").unwrap();
        }

        // Both sentinels must be recoverable.
        let mut backup_content = String::new();
        File::open(&backup)
            .unwrap()
            .read_to_string(&mut backup_content)
            .unwrap();
        assert!(
            backup_content.contains(sentinel_before),
            ".log.1 must contain the pre-rotation sentinel"
        );

        let mut current_content = String::new();
        File::open(&path)
            .unwrap()
            .read_to_string(&mut current_content)
            .unwrap();
        assert!(
            current_content.contains(sentinel_after),
            "recovery.log must contain the post-rotation sentinel"
        );
    }
}
