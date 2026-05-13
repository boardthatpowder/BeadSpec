/// Process enumeration and orphan classification.
/// Implements tasks 3.1 – 3.4.
use std::path::PathBuf;
use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, UpdateKind};

/// A candidate dolt sql-server process found by sysinfo enumeration.
#[derive(Debug)]
pub struct DoltCandidate {
    pub pid: Pid,
    pub port: Option<u16>,
    pub data_dir: PathBuf,
    /// Seconds since Unix epoch — used to detect PID recycling.
    pub start_time: u64,
}

/// Persisted record of a supervisor we spawned, written to `.supervisor.pid`.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SupervisorRecord {
    pub pid: u32,
    pub port: u16,
    pub started_at: String, // RFC3339
}

// ── Task 3.1 ─────────────────────────────────────────────────────────────────

/// Return all current-user `dolt sql-server` processes whose command line
/// references `data_dir` (canonicalized).
pub fn enumerate_dolt_processes(data_dir: &std::path::Path) -> Vec<DoltCandidate> {
    use sysinfo::System;

    let canonical = data_dir
        .canonicalize()
        .unwrap_or_else(|_| data_dir.to_path_buf());
    let canonical_str = canonical.to_string_lossy().to_string();

    let mut sys = System::new();
    sys.refresh_processes_specifics(
        ProcessesToUpdate::All,
        false,
        ProcessRefreshKind::nothing()
            .with_cmd(UpdateKind::Always)
            .with_cwd(UpdateKind::Always)
            .with_user(UpdateKind::OnlyIfNotSet),
    );

    let current_uid = current_user_uid(&mut sys);

    sys.processes()
        .values()
        .filter(|p| {
            // Must be owned by the current user.
            let uid_ok = p
                .user_id()
                .map(|u| current_uid.as_ref().map(|cu| u == cu).unwrap_or(false))
                .unwrap_or(false);
            if !uid_ok {
                return false;
            }
            // Command must include "dolt" and "sql-server".
            let args: Vec<String> = p
                .cmd()
                .iter()
                .map(|a| a.to_string_lossy().to_string())
                .collect();
            let is_dolt = args.iter().any(|a| a.to_lowercase().contains("dolt"));
            let is_server = args.iter().any(|a| a == "sql-server");
            if !is_dolt || !is_server {
                return false;
            }
            // Match this project's data dir either by argv (some setups pass
            // `--data-dir`) or by cwd (our spawn uses `.current_dir(...)` only,
            // which leaves no trace in argv — that's why orphan detection
            // missed self-spawned sidecars and let stale locks block startup).
            if args.iter().any(|a| a.contains(&canonical_str)) {
                return true;
            }
            p.cwd()
                .and_then(|c| c.canonicalize().ok())
                .map(|cwd| cwd.to_string_lossy() == canonical_str)
                .unwrap_or(false)
        })
        .map(|p| {
            let args: Vec<String> = p
                .cmd()
                .iter()
                .map(|a| a.to_string_lossy().into_owned())
                .collect();
            let port = args.windows(2).find_map(|w| {
                if w[0] == "-P" {
                    w[1].parse::<u16>().ok()
                } else {
                    None
                }
            });
            DoltCandidate {
                pid: p.pid(),
                port,
                data_dir: canonical.clone(),
                start_time: p.start_time(),
            }
        })
        .collect()
}

// ── Task 3.2 ─────────────────────────────────────────────────────────────────

/// Load `.beads/embeddeddolt/.supervisor.pid`. Returns `None` on missing/corrupt
/// file and logs a warning.
pub fn read_supervisor_pid(project_path: &str) -> Option<SupervisorRecord> {
    let path = std::path::Path::new(project_path).join(".beads/embeddeddolt/.supervisor.pid");
    let content = std::fs::read_to_string(&path).ok()?;
    match serde_json::from_str::<SupervisorRecord>(&content) {
        Ok(r) => Some(r),
        Err(e) => {
            eprintln!(
                "[recovery] corrupt .supervisor.pid at {}: {e}",
                path.display()
            );
            None
        }
    }
}

// ── Task 3.3 ─────────────────────────────────────────────────────────────────

/// Classify running candidates as orphans — excluding the recorded supervisor.
/// PID + start-time comparison guards against PID recycling.
pub fn classify(
    candidates: Vec<DoltCandidate>,
    supervisor: Option<&SupervisorRecord>,
) -> Vec<DoltCandidate> {
    candidates
        .into_iter()
        .filter(|c| {
            let Some(sup) = supervisor else { return true };
            let pid_matches = c.pid.as_u32() == sup.pid;
            if !pid_matches {
                return true;
            }
            // Same PID — check if it started *after* our supervisor (recycled).
            let sup_epoch = parse_rfc3339_epoch(&sup.started_at).unwrap_or(0);
            c.start_time > sup_epoch
        })
        .collect()
}

// ── Internal helpers ─────────────────────────────────────────────────────────

fn current_user_uid(sys: &mut sysinfo::System) -> Option<sysinfo::Uid> {
    let cur = sysinfo::get_current_pid().ok()?;
    sys.refresh_processes_specifics(
        ProcessesToUpdate::Some(&[cur]),
        false,
        ProcessRefreshKind::nothing().with_user(UpdateKind::OnlyIfNotSet),
    );
    sys.process(cur)?.user_id().cloned()
}

/// Minimal RFC3339 UTC timestamp parser → Unix epoch seconds.
/// Handles the subset we write: "YYYY-MM-DDTHH:MM:SSZ".
fn parse_rfc3339_epoch(s: &str) -> Option<u64> {
    // "2026-05-11T14:33:11Z"
    let s = s.trim_end_matches('Z');
    let (date, time) = s.split_once('T')?;
    let mut dp = date.splitn(3, '-');
    let y: u64 = dp.next()?.parse().ok()?;
    let mo: u64 = dp.next()?.parse().ok()?;
    let d: u64 = dp.next()?.parse().ok()?;
    let mut tp = time.splitn(3, ':');
    let h: u64 = tp.next()?.parse().ok()?;
    let m: u64 = tp.next()?.parse().ok()?;
    let sec: u64 = tp.next()?.parse().ok()?;
    // Days from 1970-01-01 to the given date.
    let days = days_from_epoch(y, mo, d)?;
    Some(days * 86400 + h * 3600 + m * 60 + sec)
}

fn days_from_epoch(y: u64, mo: u64, d: u64) -> Option<u64> {
    if y < 1970 || !(1..=12).contains(&mo) || d < 1 {
        return None;
    }
    let mut total = 0u64;
    for yr in 1970..y {
        total += if is_leap(yr) { 366 } else { 365 };
    }
    let mdays = month_days(y, mo)?;
    if d > mdays {
        return None;
    }
    for mth in 1..mo {
        total += month_days(y, mth)?;
    }
    total += d - 1;
    Some(total)
}

fn is_leap(y: u64) -> bool {
    (y.is_multiple_of(4) && !y.is_multiple_of(100)) || y.is_multiple_of(400)
}

fn month_days(y: u64, mo: u64) -> Option<u64> {
    Some(match mo {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if is_leap(y) {
                29
            } else {
                28
            }
        }
        _ => return None,
    })
}

// ── Tests (task 3.4) ──────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn make(pid: u32, start_time: u64) -> DoltCandidate {
        DoltCandidate {
            pid: Pid::from(pid as usize),
            port: None,
            data_dir: PathBuf::from("/fake"),
            start_time,
        }
    }

    fn sup(pid: u32, started_epoch: u64) -> SupervisorRecord {
        // epoch 1000 → "1970-01-01T00:16:40Z"
        SupervisorRecord {
            pid,
            port: 49226,
            started_at: epoch_to_rfc3339(started_epoch),
        }
    }

    fn epoch_to_rfc3339(secs: u64) -> String {
        let s = secs % 60;
        let m = (secs / 60) % 60;
        let h = (secs / 3600) % 24;
        format!("1970-01-01T{h:02}:{m:02}:{s:02}Z")
    }

    #[test]
    fn no_supervisor_all_orphans() {
        let cs = vec![make(100, 1000), make(200, 2000)];
        assert_eq!(classify(cs, None).len(), 2);
    }

    #[test]
    fn matching_supervisor_not_orphan() {
        let s = sup(100, 1000);
        let cs = vec![make(100, 1000)];
        assert_eq!(
            classify(cs, Some(&s)).len(),
            0,
            "matching supervisor should not be orphan"
        );
    }

    #[test]
    fn recycled_pid_is_orphan() {
        let s = sup(100, 1000);
        let cs = vec![make(100, 5000)]; // started later → recycled
        assert_eq!(classify(cs, Some(&s)).len(), 1);
    }

    #[test]
    fn different_pid_is_orphan() {
        let s = sup(100, 1000);
        let cs = vec![make(999, 1000)];
        assert_eq!(classify(cs, Some(&s)).len(), 1);
    }

    #[test]
    fn parse_known_timestamp() {
        // 2026-05-11T00:00:00Z → 1778457600
        assert_eq!(
            parse_rfc3339_epoch("2026-05-11T00:00:00Z"),
            Some(1778457600)
        );
    }
}
