//! One-shot `PATH` repair for GUI launches.
//!
//! macOS / Linux GUI apps launched from Finder / Dock / Spotlight inherit a
//! minimal `PATH` (e.g. `/usr/bin:/bin:/usr/sbin:/sbin`) that omits the user's
//! shell-rc additions — `~/.bd/bin`, `/opt/homebrew/bin`, `~/.local/bin`, etc.
//! That breaks every subsequent spawn that relies on tools the user installed
//! into those locations (`bd`, `dolt`, `ruflo`, `openspec`, `gitnexus`, …).
//!
//! `repair_path` runs once at app startup: it asks the user's interactive
//! login shell for its `PATH`, merges it into the inherited `PATH`, and
//! prepends a curated list of fallback install dirs. Subsequent
//! `Command::spawn` calls inherit the result for free.
//!
//! Windows is a no-op — there is no shell-rc divergence in the same way.

use std::collections::HashSet;
use std::path::PathBuf;
use std::process::Command;
use std::time::Duration;

/// Repair the process `PATH` so spawned tools resolve like they would from a
/// normal interactive shell. Safe to call once at startup; subsequent calls
/// are idempotent.
pub fn repair_path() {
    let original = std::env::var("PATH").unwrap_or_default();
    let mut dirs: Vec<PathBuf> = Vec::new();

    // 1. Pull the user's interactive shell PATH if we can (unix only).
    if let Some(shell_path) = shell_path() {
        for d in std::env::split_paths(&shell_path) {
            dirs.push(d);
        }
    }

    // 2. Keep the inherited PATH after the shell PATH so anything Tauri set
    //    (test sandboxes, packaged installs) still wins on equal keys via
    //    the dedupe below — but is reachable as a fallback.
    for d in std::env::split_paths(&original) {
        dirs.push(d);
    }

    // 3. Prepend curated fallback dirs that may not appear in either above
    //    (e.g. freshly-installed bd before the user opened a new shell).
    let mut prefix: Vec<PathBuf> = Vec::new();
    for raw in fallback_dirs() {
        prefix.push(expand_tilde(raw));
    }
    let mut combined = prefix;
    combined.append(&mut dirs);

    // 4. Dedupe while preserving order; drop entries that don't exist.
    let mut seen: HashSet<PathBuf> = HashSet::new();
    let kept: Vec<PathBuf> = combined
        .into_iter()
        .filter(|p| !p.as_os_str().is_empty() && p.is_dir() && seen.insert(p.clone()))
        .collect();

    if kept.is_empty() {
        return;
    }
    let joined = std::env::join_paths(kept.iter()).unwrap_or_default();
    std::env::set_var("PATH", &joined);
    eprintln!("[env] repaired PATH = {}", joined.to_string_lossy());
}

/// Spawn the user's interactive login shell and capture its `PATH`. Returns
/// `None` on Windows, on shell-spawn failure, or on timeout.
fn shell_path() -> Option<String> {
    if cfg!(windows) {
        return None;
    }
    let shell = std::env::var("SHELL").ok().filter(|s| !s.is_empty())?;
    let mut child = Command::new(&shell)
        .arg("-ilc")
        .arg("printf %s \"$PATH\"")
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .spawn()
        .ok()?;
    let start = std::time::Instant::now();
    let timeout = Duration::from_secs(2);
    loop {
        match child.try_wait() {
            Ok(Some(status)) if status.success() => {
                use std::io::Read;
                let mut out = String::new();
                if let Some(mut pipe) = child.stdout.take() {
                    let _ = pipe.read_to_string(&mut out);
                }
                let trimmed = out.trim();
                return if trimmed.is_empty() {
                    None
                } else {
                    Some(trimmed.to_string())
                };
            }
            Ok(Some(_)) => return None,
            Ok(None) => {
                if start.elapsed() > timeout {
                    let _ = child.kill();
                    return None;
                }
                std::thread::sleep(Duration::from_millis(25));
            }
            Err(_) => return None,
        }
    }
}

/// OS-keyed list of well-known user-install dirs to prepend, even if absent
/// from both the inherited and shell `PATH`. Mirrors `find_bd`'s fallback list
/// in `src-tauri/src/bd/runner.rs`.
fn fallback_dirs() -> Vec<&'static str> {
    if cfg!(target_os = "macos") {
        vec!["~/.bd/bin", "/opt/homebrew/bin", "/usr/local/bin"]
    } else if cfg!(target_os = "linux") {
        vec!["~/.bd/bin", "~/.local/bin", "/usr/local/bin"]
    } else {
        vec![]
    }
}

fn expand_tilde(raw: &str) -> PathBuf {
    if let Some(suffix) = raw.strip_prefix("~/") {
        if let Some(home) = std::env::var_os("HOME").or_else(|| std::env::var_os("USERPROFILE")) {
            return PathBuf::from(home).join(suffix);
        }
    }
    PathBuf::from(raw)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn expand_tilde_resolves_home() {
        std::env::set_var("HOME", "/tmp/homefixture");
        let p = expand_tilde("~/.bd/bin");
        assert_eq!(p, PathBuf::from("/tmp/homefixture/.bd/bin"));
    }

    #[test]
    fn expand_tilde_passes_through_absolute() {
        let p = expand_tilde("/opt/homebrew/bin");
        assert_eq!(p, PathBuf::from("/opt/homebrew/bin"));
    }

    #[test]
    fn repair_path_is_idempotent_and_nonempty() {
        repair_path();
        let first = std::env::var("PATH").unwrap_or_default();
        repair_path();
        let second = std::env::var("PATH").unwrap_or_default();
        assert!(!first.is_empty());
        assert_eq!(first, second, "second call must not drift");
    }
}
