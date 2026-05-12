/// Kill sequence and supervisor respawn.
/// Implements tasks 5.1 – 5.5.
use std::path::Path;
use std::time::Duration;
use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, System};
use tokio::time::sleep;

// ── Task 5.1 — graceful termination ──────────────────────────────────────────

/// Send SIGTERM (POSIX) or graceful terminate (Windows) to `pid`.
pub fn terminate_graceful(pid: Pid) {
    let mut sys = System::new();
    sys.refresh_processes_specifics(
        ProcessesToUpdate::Some(&[pid]),
        false,
        ProcessRefreshKind::nothing(),
    );
    if let Some(p) = sys.process(pid) {
        #[cfg(unix)]
        let _ = p.kill_with(sysinfo::Signal::Term);
        #[cfg(windows)]
        let _ = p.kill();
    }
}

// ── Task 5.2 — wait for exit ──────────────────────────────────────────────────

/// Poll until `pid` exits or `deadline` elapses.
/// Returns `true` if the process exited within the deadline.
pub async fn wait_for_exit(pid: Pid, deadline: Duration) -> bool {
    let poll = Duration::from_millis(250);
    let steps = (deadline.as_millis() / poll.as_millis()).max(1) as u32;
    for _ in 0..steps {
        sleep(poll).await;
        let mut sys = System::new();
        sys.refresh_processes_specifics(
            ProcessesToUpdate::Some(&[pid]),
            false,
            ProcessRefreshKind::nothing(),
        );
        if sys.process(pid).is_none() {
            return true;
        }
    }
    false
}

// ── Task 5.3 — forceful termination ──────────────────────────────────────────

/// Send SIGKILL (POSIX) or forceful TerminateProcess (Windows) to `pid`.
pub fn terminate_forceful(pid: Pid) {
    let mut sys = System::new();
    sys.refresh_processes_specifics(
        ProcessesToUpdate::Some(&[pid]),
        false,
        ProcessRefreshKind::nothing(),
    );
    if let Some(p) = sys.process(pid) {
        // kill() sends SIGKILL on POSIX and TerminateProcess on Windows.
        let _ = p.kill();
    }
}

// ── Task 5.4 — lock-file cleanup ─────────────────────────────────────────────

/// Remove stale lock files left by a dead supervisor. Missing files are a no-op.
pub fn cleanup_lock_files(project_path: &str) {
    let base = Path::new(project_path).join(".beads/embeddeddolt");
    for rel in [".dolt/.lock", ".supervisor.pid"] {
        let p = base.join(rel);
        if p.exists() {
            if let Err(e) = std::fs::remove_file(&p) {
                eprintln!("[recovery] could not remove {}: {e}", p.display());
            }
        }
    }
}

// ── Task 5.5 — atomic supervisor PID write ───────────────────────────────────

/// Write `{ pid, port, started_at }` atomically to `.supervisor.pid`.
pub fn write_supervisor_pid(project_path: &str, pid: u32, port: u16) -> std::io::Result<()> {
    use std::io::Write;

    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let started_at = format_epoch_rfc3339(secs);
    let json =
        serde_json::json!({ "pid": pid, "port": port, "started_at": started_at }).to_string();

    let base = Path::new(project_path).join(".beads/embeddeddolt");
    let tmp = base.join(".supervisor.pid.tmp");
    let dest = base.join(".supervisor.pid");

    let mut f = std::fs::File::create(&tmp)?;
    f.write_all(json.as_bytes())?;
    f.flush()?;
    drop(f);
    std::fs::rename(tmp, dest)
}

// ── Shared formatter ─────────────────────────────────────────────────────────

pub fn format_epoch_rfc3339(secs: u64) -> String {
    let s = secs % 60;
    let m = (secs / 60) % 60;
    let h = (secs / 3600) % 24;
    let (y, mo, d) = days_to_ymd(secs / 86400);
    format!("{y:04}-{mo:02}-{d:02}T{h:02}:{m:02}:{s:02}Z")
}

fn days_to_ymd(mut days: u64) -> (u64, u64, u64) {
    let mut y = 1970u64;
    loop {
        let dy = if is_leap(y) { 366 } else { 365 };
        if days < dy {
            break;
        }
        days -= dy;
        y += 1;
    }
    let months: [u64; 12] = if is_leap(y) {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };
    let mut mo = 1u64;
    for dm in months {
        if days < dm {
            break;
        }
        days -= dm;
        mo += 1;
    }
    (y, mo, days + 1)
}

fn is_leap(y: u64) -> bool {
    (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn epoch_format_known_date() {
        // 2026-05-11T00:00:00Z = 1778457600
        assert_eq!(format_epoch_rfc3339(1778457600), "2026-05-11T00:00:00Z");
    }

    #[tokio::test]
    async fn wait_for_exit_nonexistent_pid_returns_true() {
        // PID u32::MAX is very unlikely to exist.
        let pid = Pid::from(u32::MAX as usize);
        let result = wait_for_exit(pid, Duration::from_millis(300)).await;
        assert!(result, "non-existent PID should report as exited");
    }
}
