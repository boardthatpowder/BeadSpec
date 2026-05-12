use std::path::PathBuf;
use std::process::Stdio;
use std::time::Duration;
use tokio::process::Command;

#[derive(Debug, thiserror::Error)]
pub enum BdError {
    #[error("bd CLI not found on PATH — install it to enable editing")]
    NotFound,
    #[error("bd command failed (exit {code}): {stderr}")]
    CommandFailed { code: i32, stderr: String },
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("bd command timed out{}", if stderr.is_empty() { String::new() } else { format!(": {stderr}") })]
    Timeout { stderr: String },
}

// Make BdError serializable for Tauri IPC
impl serde::Serialize for BdError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub struct BdRunner {
    bd_path: PathBuf,
    pub project_path: String,
}

impl BdRunner {
    /// Locate `bd`, consulting `settings_bd_path` override first, then a known fallback,
    /// then PATH. Prefer this over `new` in Tauri commands that have access to AppSettings.
    pub fn new_with_override(project_path: &str, settings_bd_path: &str) -> Result<Self, BdError> {
        let bd_path = find_bd(settings_bd_path).ok_or(BdError::NotFound)?;
        Ok(Self {
            bd_path,
            project_path: project_path.to_string(),
        })
    }

    /// Locate `bd` on PATH only. Kept for callers without access to AppSettings.
    pub fn new(project_path: &str) -> Result<Self, BdError> {
        Self::new_with_override(project_path, "")
    }

    /// Run a bd command with the given args. Returns stdout on success.
    ///
    /// Write operations (create, update, close, respond, dismiss) use a 30-second
    /// timeout; read operations default to 10 seconds. This method conservatively
    /// uses 30 seconds to cover both categories.
    pub async fn run(&self, args: &[&str]) -> Result<String, BdError> {
        // Classify by first arg: writes get 30 s, reads get 10 s.
        let timeout = classify_bd_timeout(args);

        let bd_str = self.bd_path.to_string_lossy();
        let cwd = std::path::Path::new(&self.project_path);

        // Prepend BD_NON_INTERACTIVE via a wrapper: we pass the binary path as the
        // command and relay all args.  spawn_managed does not expose env-var injection
        // directly, so we shell out via the path but set the env on the Command inside
        // spawn_managed by building the child ourselves here.
        use std::process::Stdio as SStdio;
        let mut child = Command::new(bd_str.as_ref())
            .args(args)
            .env("BD_NON_INTERACTIVE", "1")
            .current_dir(cwd)
            .stdin(SStdio::null())
            .stdout(SStdio::piped())
            .stderr(SStdio::piped())
            .kill_on_drop(true)
            .spawn()
            .map_err(BdError::Io)?;

        let timeout_ms = timeout.as_millis() as u64;
        use tokio::io::AsyncReadExt;
        let mut stdout_pipe = child.stdout.take().expect("stdout piped");
        // stderr_pipe is kept outside the collect future so it remains accessible
        // if the command times out — we drain it to surface the real error message.
        let mut stderr_pipe = child.stderr.take().expect("stderr piped");

        let collect_stdout = async {
            let mut out = Vec::new();
            stdout_pipe.read_to_end(&mut out).await?;
            Ok::<Vec<u8>, std::io::Error>(out)
        };

        let wait_and_collect = async {
            let (out_res, status_res) = tokio::join!(collect_stdout, child.wait());
            let status = status_res?;
            let stdout = out_res?;
            Ok::<(Vec<u8>, std::process::ExitStatus), std::io::Error>((stdout, status))
        };

        match tokio::time::timeout(timeout, wait_and_collect).await {
            Ok(Ok((stdout, status))) => {
                let mut err = Vec::new();
                let _ =
                    tokio::time::timeout(Duration::from_secs(2), stderr_pipe.read_to_end(&mut err))
                        .await;
                if status.success() {
                    Ok(String::from_utf8_lossy(&stdout).into_owned())
                } else {
                    Err(BdError::CommandFailed {
                        code: status.code().unwrap_or(-1),
                        stderr: String::from_utf8_lossy(&err).into_owned(),
                    })
                }
            }
            Ok(Err(io_err)) => Err(BdError::Io(io_err)),
            Err(_elapsed) => {
                let _ = child.kill().await;
                // Drain whatever bd wrote to stderr before being killed — this
                // typically contains the real error (e.g. "failed to acquire Dolt lock").
                let mut stderr_bytes = Vec::new();
                let _ = tokio::time::timeout(
                    Duration::from_millis(500),
                    stderr_pipe.read_to_end(&mut stderr_bytes),
                )
                .await;
                let stderr_str = String::from_utf8_lossy(&stderr_bytes).trim().to_string();
                let _ = tokio::time::timeout(Duration::from_secs(2), child.wait()).await;
                eprintln!("warn: BdRunner::run timed out after {timeout_ms}ms for args: {args:?}");
                if !stderr_str.is_empty() {
                    eprintln!("  bd stderr: {stderr_str}");
                }
                Err(BdError::Timeout { stderr: stderr_str })
            }
        }
    }
}

/// Classify a bd sub-command's expected duration: write ops get 30 s, reads 10 s.
///
/// Write operations (create, update, close, respond, dismiss, pour, push) can
/// trigger Dolt commits and network I/O; they need more headroom.
fn classify_bd_timeout(args: &[&str]) -> Duration {
    let write_subcommands = [
        "create",
        "update",
        "close",
        "respond",
        "dismiss",
        "pour",
        "push",
        "dolt-push",
    ];
    let first = args.first().copied().unwrap_or("");
    let second = args.get(1).copied().unwrap_or("");
    // dolt server lifecycle commands need startup headroom (first-time init can be slow)
    if first == "dolt" && matches!(second, "start" | "push" | "pull" | "commit") {
        return Duration::from_secs(30);
    }
    if write_subcommands.contains(&first) || write_subcommands.contains(&second) {
        Duration::from_secs(30)
    } else {
        Duration::from_secs(10)
    }
}

/// Locate `bd` — check settings override first, then PATH, then common install locations.
/// Pass an empty string for `settings_path` to skip the override check.
pub fn find_bd(settings_path: &str) -> Option<PathBuf> {
    if !settings_path.is_empty() {
        let p = PathBuf::from(settings_path);
        if p.is_file() {
            return Some(p);
        }
    }
    let bin = if cfg!(windows) { "bd.exe" } else { "bd" };
    if let Some(found) = std::env::var_os("PATH").and_then(|path_var| {
        std::env::split_paths(&path_var).find_map(|dir| {
            let candidate = dir.join(bin);
            if candidate.is_file() {
                Some(candidate)
            } else {
                None
            }
        })
    }) {
        return Some(found);
    }
    // Common install locations per OS, checked after PATH misses
    let candidates: &[&str] = if cfg!(target_os = "macos") {
        &["/opt/homebrew/bin/bd", "/usr/local/bin/bd"]
    } else if cfg!(target_os = "linux") {
        &["~/.local/bin/bd", "/usr/local/bin/bd"]
    } else {
        &[]
    };
    for raw in candidates {
        let path = if let Some(suffix) = raw.strip_prefix("~/") {
            if let Some(home) = dirs_home() {
                home.join(suffix)
            } else {
                continue;
            }
        } else {
            PathBuf::from(raw)
        };
        if path.is_file() {
            return Some(path);
        }
    }
    if cfg!(windows) {
        for suffix in &[r"AppData\Local\Programs\bd\bd.exe", r"scoop\shims\bd.exe"] {
            if let Some(home) = dirs_home() {
                let p = home.join(suffix);
                if p.is_file() {
                    return Some(p);
                }
            }
        }
    }
    None
}

fn dirs_home() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
}

/// Check if bd is locatable (override-aware via empty settings path → fallback + PATH).
pub fn bd_available() -> bool {
    find_bd("").is_some()
}

// ── Unified bd invocation ────────────────────────────────────────────────────

/// Server-mode env block applied to every bd invocation from the supervisor.
/// Forces bd to act as a pure MySQL client against our managed Dolt sidecar —
/// no port-file probing, no PID-liveness fallback, no auto-start. See
/// `docs/DOLT.md` in the beads repo for the BEADS_DOLT_SERVER_* contract.
fn bd_env(port: u16) -> [(String, String); 5] {
    [
        ("BEADS_DOLT_SERVER_MODE".to_string(), "1".to_string()),
        (
            "BEADS_DOLT_SERVER_HOST".to_string(),
            "127.0.0.1".to_string(),
        ),
        ("BEADS_DOLT_SERVER_PORT".to_string(), port.to_string()),
        ("BEADS_DOLT_SERVER_USER".to_string(), "root".to_string()),
        ("BD_NON_INTERACTIVE".to_string(), "1".to_string()),
    ]
}

/// Invoke `bd` against the project's running Dolt sidecar, with one-shot self-heal.
///
/// - Reads the live port from `DoltServerRegistry`. Returns an error if no sidecar is
///   registered for this project (caller should connect the project first).
/// - On the first attempt: spawns bd with the server-mode env block, cwd = project root,
///   stdin closed.
/// - If bd reports a MySQL connection error (sidecar died mid-session), invalidates the
///   registry entry, respawns the sidecar via `spawn_or_get`, and retries the command once.
/// - Returns stdout on success, or a formatted error string on failure.
pub async fn invoke_bd_in_project(
    bd_path: &std::path::Path,
    args: &[&str],
    project_path: &str,
    server_registry: &crate::db::dolt_server::DoltServerRegistry,
    dolt_path_override: &str,
    timeout: Duration,
) -> Result<String, String> {
    let port = server_registry
        .get_port(project_path)
        .await
        .ok_or_else(|| {
            format!("project_not_connected: '{project_path}' — call connect_project first")
        })?;

    let cwd = std::path::Path::new(project_path);
    let result = run_bd_once(bd_path, args, cwd, port, timeout).await;

    // Self-heal: if bd reports a MySQL connection failure, the sidecar likely died.
    // Respawn it from the embedded data dir and retry the command once.
    if let Err(ref e) = result {
        if is_dolt_connection_error(e) {
            eprintln!("[bd] sidecar appears dead ({e}) — respawning and retrying");
            server_registry.invalidate(project_path).await;
            let embeddeddolt_dir = cwd.join(".beads/embeddeddolt");
            let new_port = server_registry
                .spawn_or_get(project_path, &embeddeddolt_dir, dolt_path_override)
                .await
                .map_err(|e| format!("self-heal respawn failed: {e}"))?;
            return run_bd_once(bd_path, args, cwd, new_port, timeout).await;
        }
    }
    result
}

async fn run_bd_once(
    bd_path: &std::path::Path,
    args: &[&str],
    cwd: &std::path::Path,
    port: u16,
    timeout: Duration,
) -> Result<String, String> {
    let bd_str = bd_path.to_string_lossy().into_owned();
    let env = bd_env(port);
    let env_refs: Vec<(&str, &str)> = env.iter().map(|(k, v)| (k.as_str(), v.as_str())).collect();
    let out = spawn_managed(&bd_str, args, cwd, timeout, &env_refs)
        .await
        .map_err(|e| e.to_string())?;
    let exit_code = out.exit_code.unwrap_or(-1);
    if exit_code == 0 {
        Ok(String::from_utf8_lossy(&out.stdout).into_owned())
    } else {
        let stderr = String::from_utf8_lossy(&out.stderr).into_owned();
        Err(format!("bd exited {exit_code}: {stderr}"))
    }
}

fn is_dolt_connection_error(msg: &str) -> bool {
    let m = msg.to_lowercase();
    m.contains("connection refused")
        || m.contains("can't connect")
        || m.contains("connect: connection")
        || m.contains("dial tcp")
        || m.contains("broken pipe")
        || m.contains("eof")
}

// ── spawn_managed ─────────────────────────────────────────────────────────────

/// Maximum combined stdout + stderr size before output is truncated (1 MiB).
const MAX_OUTPUT_BYTES: usize = 1_048_576;

/// Output captured from a managed subprocess.
pub struct ManagedOutput {
    pub stdout: Vec<u8>,
    pub stderr: Vec<u8>,
    pub exit_code: Option<i32>,
    pub truncated: bool,
}

/// Errors that can occur when spawning a managed subprocess.
#[derive(Debug, thiserror::Error)]
pub enum SpawnError {
    #[error("Process timed out after {timeout_ms}ms: {cmd}{}", if stderr.is_empty() { String::new() } else { format!(" — {stderr}") })]
    Timeout {
        cmd: String,
        timeout_ms: u64,
        stderr: String,
    },
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

/// Spawn an external command with a hard timeout, explicit kill-on-timeout, and
/// a bounded output cap (1 MiB combined stdout + stderr).
///
/// # Behaviour
/// - The child is created with `kill_on_drop(true)` so it is always reaped even
///   if the future is cancelled.
/// - If `timeout` elapses before the child exits, `child.kill()` is called
///   explicitly followed by a 2-second inner wait.  `SpawnError::Timeout` is
///   then returned.
/// - Combined output is capped at `MAX_OUTPUT_BYTES`.  When the cap is exceeded
///   the data is truncated and `ManagedOutput::truncated` is set to `true`.
pub async fn spawn_managed(
    cmd: &str,
    args: &[&str],
    cwd: &std::path::Path,
    timeout: std::time::Duration,
    env: &[(&str, &str)],
) -> Result<ManagedOutput, SpawnError> {
    use tokio::io::AsyncReadExt;

    let mut builder = Command::new(cmd);
    builder
        .args(args)
        .current_dir(cwd)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    for (k, v) in env {
        builder.env(k, v);
    }
    let mut child = builder.spawn()?;

    let timeout_ms = timeout.as_millis() as u64;

    // Extract pipes before waiting so we retain a handle to the child for killing.
    let mut stdout_pipe = child.stdout.take().expect("stdout is piped");
    let mut stderr_pipe = child.stderr.take().expect("stderr is piped");

    // Read stdout and stderr concurrently while also waiting for the process.
    let collect_output = async {
        let mut stdout_buf = Vec::new();
        let mut stderr_buf = Vec::new();
        let (r1, r2) = tokio::join!(
            stdout_pipe.read_to_end(&mut stdout_buf),
            stderr_pipe.read_to_end(&mut stderr_buf),
        );
        r1?;
        r2?;
        Ok::<(Vec<u8>, Vec<u8>), std::io::Error>((stdout_buf, stderr_buf))
    };

    // Race the output collection + wait against the timeout.
    let wait_and_collect = async {
        let (out_result, status) = tokio::join!(collect_output, child.wait());
        let status = status?;
        let (stdout, stderr) = out_result?;
        Ok::<(Vec<u8>, Vec<u8>, std::process::ExitStatus), std::io::Error>((stdout, stderr, status))
    };

    match tokio::time::timeout(timeout, wait_and_collect).await {
        Ok(Ok((mut stdout, mut stderr, status))) => {
            let total = stdout.len() + stderr.len();
            let truncated = total > MAX_OUTPUT_BYTES;
            if truncated {
                eprintln!("warn: spawn_managed: output truncated for command {cmd}");
                // Trim stdout first, then stderr to fill remaining budget.
                if stdout.len() > MAX_OUTPUT_BYTES {
                    stdout.truncate(MAX_OUTPUT_BYTES);
                    stderr.clear();
                } else {
                    let stderr_cap = MAX_OUTPUT_BYTES - stdout.len();
                    stderr.truncate(stderr_cap);
                }
            }
            Ok(ManagedOutput {
                stdout,
                stderr,
                exit_code: status.code(),
                truncated,
            })
        }
        Ok(Err(io_err)) => Err(SpawnError::Io(io_err)),
        Err(_elapsed) => {
            let _ = child.kill().await;
            // Drain whatever the process wrote to stderr before being killed.
            let mut stderr_bytes = Vec::new();
            let _ = tokio::time::timeout(
                std::time::Duration::from_millis(500),
                stderr_pipe.read_to_end(&mut stderr_bytes),
            )
            .await;
            let _ = tokio::time::timeout(std::time::Duration::from_secs(2), child.wait()).await;
            let stderr = String::from_utf8_lossy(&stderr_bytes).trim().to_string();
            if !stderr.is_empty() {
                eprintln!("warn: spawn_managed timeout for {cmd}: {stderr}");
            }
            Err(SpawnError::Timeout {
                cmd: cmd.to_string(),
                timeout_ms,
                stderr,
            })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    /// A long-running command that should be killed by the timeout.
    /// Uses `sh -c` to ensure portability on macOS/Linux.
    #[cfg(not(target_os = "windows"))]
    fn long_running_cmd() -> (&'static str, Vec<&'static str>) {
        ("sh", vec!["-c", "sleep 100"])
    }

    #[cfg(target_os = "windows")]
    fn long_running_cmd() -> (&'static str, Vec<&'static str>) {
        // On Windows, use a ping loop as a long-running command substitute
        ("cmd", vec!["/c", "ping -t 127.0.0.1"])
    }

    // Windows process-group killing is unreliable: child.kill() on cmd.exe does
    // not guarantee the subprocess tree (e.g. ping.exe) exits, so child.wait()
    // can block indefinitely. Skip this test on Windows.
    #[cfg(not(target_os = "windows"))]
    #[tokio::test]
    async fn spawn_managed_times_out_and_kills_child() {
        let (cmd, args_vec) = long_running_cmd();
        let args: Vec<&str> = args_vec.iter().map(|s| *s).collect();
        let start = std::time::Instant::now();
        let tmp = std::env::temp_dir();

        let result = spawn_managed(cmd, &args, &tmp, Duration::from_millis(100), &[]).await;

        let elapsed = start.elapsed();
        assert!(
            matches!(result, Err(SpawnError::Timeout { .. })),
            "expected SpawnError::Timeout, got: {:?}",
            result.err()
        );
        // Should complete well within 200ms of the 100ms timeout (plus 2s kill wait,
        // but kill should be near-instant for sleep).  We allow up to 3 seconds total
        // to avoid flakiness on slow CI, while still catching obvious hangs.
        assert!(
            elapsed < Duration::from_secs(3),
            "timed out but took too long to return ({elapsed:?})"
        );
    }

    #[tokio::test]
    async fn spawn_managed_returns_output_for_normal_command() {
        let tmp = std::env::temp_dir();
        #[cfg(not(target_os = "windows"))]
        let (cmd, args): (&str, &[&str]) = ("sh", &["-c", "echo hello"]);
        #[cfg(target_os = "windows")]
        let (cmd, args): (&str, &[&str]) = ("cmd", &["/c", "echo hello"]);

        let result = spawn_managed(cmd, args, &tmp, Duration::from_secs(5), &[]).await;

        let out = result.expect("command should succeed");
        assert!(
            String::from_utf8_lossy(&out.stdout).contains("hello"),
            "stdout did not contain 'hello': {:?}",
            String::from_utf8_lossy(&out.stdout)
        );
        assert!(!out.truncated, "output should not be truncated");
    }
}
