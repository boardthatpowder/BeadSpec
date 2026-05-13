use std::collections::{HashMap, VecDeque};
use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::net::TcpStream;
use tokio::process::{Child, Command};
use tokio::sync::RwLock;
use tokio::time::{sleep, timeout};

use crate::db::recovery::discover_db_name;
use crate::recovery_log::{append, LogEntry, LogEvent};

/// Bounded ring buffer of recent dolt stderr lines.
/// 200 lines is enough to capture the typical startup banner + any panic backtrace.
const STDERR_TAIL_CAPACITY: usize = 200;

pub type StderrTail = Arc<Mutex<VecDeque<String>>>;

/// Structured failure returned by `spawn_or_get` when retries are exhausted.
/// Implements `Display` so existing callers using `format!("...{e}")` keep working,
/// while `connect_project` can pattern-match to extract the stderr tail.
#[derive(Debug, Clone)]
pub struct SpawnFailure {
    pub attempts: u32,
    pub last_error: String,
    pub stderr_tail: String,
}

impl std::fmt::Display for SpawnFailure {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "Failed to spawn dolt sidecar after {} attempts: {}",
            self.attempts, self.last_error
        )?;
        if !self.stderr_tail.is_empty() {
            write!(
                f,
                "\n--- dolt stderr (last lines) ---\n{}",
                self.stderr_tail
            )?;
        }
        Ok(())
    }
}

impl std::error::Error for SpawnFailure {}

struct SpawnedServer {
    port: u16,
    child: Child,
    #[allow(dead_code)] // kept alive so the stderr-drain task keeps writing
    stderr_tail: StderrTail,
}

fn new_stderr_tail() -> StderrTail {
    Arc::new(Mutex::new(VecDeque::with_capacity(STDERR_TAIL_CAPACITY)))
}

fn snapshot_tail(tail: &StderrTail) -> String {
    let guard = tail.lock().unwrap();
    guard.iter().cloned().collect::<Vec<_>>().join("\n")
}

/// Drain `dolt sql-server`'s stdout or stderr in the background, pushing each
/// line into the shared bounded ring buffer and appending it to `recovery.log`.
/// Dolt writes most diagnostics (`INFO[0000] Server ready…`, `Starting server…`,
/// warnings) to STDOUT, so both streams must be captured. Stops when the child
/// closes the stream.
fn spawn_log_drainer<R>(project_path: String, stream: R, tail: StderrTail)
where
    R: tokio::io::AsyncRead + Unpin + Send + 'static,
{
    tokio::spawn(async move {
        let mut reader = BufReader::new(stream).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            {
                let mut buf = tail.lock().unwrap();
                if buf.len() == STDERR_TAIL_CAPACITY {
                    buf.pop_front();
                }
                buf.push_back(line.clone());
            }
            let _ = append(&LogEntry::new(&project_path, LogEvent::DoltStderr, line));
        }
    });
}

#[derive(Default)]
pub struct DoltServerRegistry {
    servers: RwLock<HashMap<String, SpawnedServer>>,
}

impl DoltServerRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    /// Ensure a `dolt sql-server` is running for `project_path` with its data
    /// at `embeddeddolt_dir`. Returns the port the server is listening on.
    /// Sidecars are kept alive for the full app session — call `stop_all` on exit.
    /// Pass `dolt_path_override` from `AppSettings.binary_paths.dolt` (empty string = auto-detect).
    ///
    /// Tasks 7.3 + 7.4: after spawning, verifies SQL readiness against the actual
    /// Beads DB (not information_schema) with a 3-second timeout, and retries up to
    /// 3 times on port-race failures (TCP connect refused within 1 second).
    pub async fn spawn_or_get(
        &self,
        project_path: &str,
        embeddeddolt_dir: &Path,
        dolt_path_override: &str,
    ) -> Result<u16, SpawnFailure> {
        {
            let servers = self.servers.read().await;
            if let Some(s) = servers.get(project_path) {
                return Ok(s.port);
            }
        }

        let override_opt = if dolt_path_override.is_empty() {
            None
        } else {
            Some(dolt_path_override)
        };
        let dolt_bin = find_dolt(override_opt).ok_or_else(|| SpawnFailure {
            attempts: 0,
            last_error: "dolt binary not found on PATH".to_string(),
            stderr_tail: String::new(),
        })?;

        // Discover the Beads DB name once — needed for the post-spawn health check.
        let db_name = discover_db_name(embeddeddolt_dir).ok_or_else(|| SpawnFailure {
            attempts: 0,
            last_error: "Cannot determine Beads DB name from embeddeddolt dir".to_string(),
            stderr_tail: String::new(),
        })?;

        // Retry up to 3 times to handle port-race scenarios. Reuse one stderr tail
        // across attempts so the final SpawnFailure carries diagnostics from every try.
        const MAX_ATTEMPTS: u32 = 3;
        let mut last_error = String::new();
        let stderr_tail = new_stderr_tail();

        // When `config.yaml` exists in the data dir, dolt reads it and binds the
        // configured listener port — overriding any -P flag we pass. The recovery
        // probe already treats this as the source of truth, so spawn must too.
        let configured_port = crate::db::recovery::read_configured_port(embeddeddolt_dir);

        for attempt in 0..MAX_ATTEMPTS {
            let port = match configured_port.or_else(free_port) {
                Some(p) => p,
                None => {
                    last_error = "No free port available".to_string();
                    continue;
                }
            };

            let child_result = Command::new(&dolt_bin)
                .args([
                    "sql-server",
                    "-H",
                    "127.0.0.1",
                    "-P",
                    &port.to_string(),
                    "--loglevel=warning",
                ])
                .current_dir(embeddeddolt_dir)
                .stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::piped())
                .spawn();

            let mut child = match child_result {
                Ok(c) => c,
                Err(e) => {
                    last_error = format!("Failed to spawn dolt sql-server: {e}");
                    continue;
                }
            };

            if let Some(stderr) = child.stderr.take() {
                spawn_log_drainer(project_path.to_string(), stderr, stderr_tail.clone());
            }
            if let Some(stdout) = child.stdout.take() {
                spawn_log_drainer(project_path.to_string(), stdout, stderr_tail.clone());
            }

            // Wait for the TCP port to accept connections (up to 30 seconds — dolt
            // cold-starts on large databases can take 10-20s on first launch).
            match wait_for_port_async(port, Duration::from_secs(30)).await {
                Ok(()) => {}
                Err(e) => {
                    last_error = format!("dolt sql-server did not start in time: {e}");
                    eprintln!(
                        "[dolt_server] Sidecar spawn attempt {attempt}: port {port} never accepted connections — {e}"
                    );
                    child.kill().await.ok();
                    continue;
                }
            }

            // Verify SQL readiness against the actual Beads DB. Use a 15-second
            // timeout — dolt may be slow to initialise schema on first open.
            // On any failure, kill the child before retrying so it releases the
            // noms LOCK and doesn't block the next spawn attempt.
            match verify_beads_db_ready(port, &db_name).await {
                Ok(()) => {
                    // SQL is healthy — write PID file so bd can verify the server is
                    // alive without trying to auto-start a competing Dolt process.
                    let beads_dir = embeddeddolt_dir.parent().unwrap_or(embeddeddolt_dir);
                    if let Some(pid) = child.id() {
                        let _ = std::fs::write(beads_dir.join("dolt-server.pid"), pid.to_string());
                    }
                    let mut servers = self.servers.write().await;
                    servers.insert(
                        project_path.to_string(),
                        SpawnedServer {
                            port,
                            child,
                            stderr_tail: stderr_tail.clone(),
                        },
                    );
                    return Ok(port);
                }
                Err(VerifyError::PortRace { stolen_port }) => {
                    last_error =
                        format!("Port {stolen_port} was stolen between selection and sidecar bind");
                    eprintln!(
                        "[warn] Port {} stolen between selection and sidecar bind (attempt {}), retrying",
                        stolen_port,
                        attempt
                    );
                    child.kill().await.ok();
                    continue;
                }
                Err(VerifyError::SlowStart { port: p, detail }) => {
                    // Sidecar is slow to respond — give it 10 more seconds then re-check.
                    eprintln!(
                        "[warn] Sidecar on port {p} is slow to accept SQL connections ({detail}), waiting 10s"
                    );
                    sleep(Duration::from_secs(10)).await;
                    match verify_beads_db_ready(p, &db_name).await {
                        Ok(()) => {
                            let mut servers = self.servers.write().await;
                            servers.insert(
                                project_path.to_string(),
                                SpawnedServer {
                                    port: p,
                                    child,
                                    stderr_tail: stderr_tail.clone(),
                                },
                            );
                            return Ok(p);
                        }
                        Err(e) => {
                            last_error =
                                format!("Sidecar SQL verify failed after extended wait: {e:?}");
                            eprintln!("[warn] Sidecar on port {p} still not ready after extended wait, attempt {attempt}");
                            child.kill().await.ok();
                            continue;
                        }
                    }
                }
            }
        }

        let tail = snapshot_tail(&stderr_tail);
        let _ = append(&LogEntry::new(
            project_path,
            LogEvent::SpawnFailed,
            last_error.clone(),
        ));
        Err(SpawnFailure {
            attempts: MAX_ATTEMPTS,
            last_error,
            stderr_tail: tail,
        })
    }

    /// Return the port of an already-running sidecar, or None if not registered.
    pub async fn get_port(&self, project_path: &str) -> Option<u16> {
        self.servers.read().await.get(project_path).map(|s| s.port)
    }

    /// Drop the registry entry for `project_path` (does not kill the child).
    /// Use before a self-heal respawn — the next spawn_or_get will create a fresh sidecar.
    pub async fn invalidate(&self, project_path: &str) {
        if let Some(mut s) = self.servers.write().await.remove(project_path) {
            // Best-effort kill of the now-stale child so we don't leak it.
            let _ = s.child.kill().await;
        }
    }

    pub async fn stop_all(&self) {
        let mut servers = self.servers.write().await;
        for (_, mut s) in servers.drain() {
            s.child.kill().await.ok();
        }
    }
}

// ── Task 7.3: Beads DB readiness probe ───────────────────────────────────────

/// Outcome of [`verify_beads_db_ready`].
#[derive(Debug)]
enum VerifyError {
    /// TCP connect was refused within 1 second — the port was stolen before the
    /// sidecar could bind it.
    PortRace { stolen_port: u16 },
    /// TCP connected successfully but the MySQL handshake or `SELECT 1` timed
    /// out — the sidecar is just slow to initialise.
    SlowStart { port: u16, detail: String },
}

impl std::fmt::Display for VerifyError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            VerifyError::PortRace { stolen_port } => {
                write!(f, "port {stolen_port} stolen (connection refused)")
            }
            VerifyError::SlowStart { port, detail } => {
                write!(f, "port {port} slow start: {detail}")
            }
        }
    }
}

/// Verify that the dolt sidecar is ready to serve SQL queries against the
/// actual Beads database (`db_name`), not `information_schema`.
///
/// Heuristic (task 7.4 requirement):
/// - If the TCP connection is refused within 1 second → `PortRace` (port stolen).
/// - If TCP succeeds but `SELECT 1` times out within 3 seconds total → `SlowStart`
///   (sidecar is initialising, give it more time).
async fn verify_beads_db_ready(port: u16, db_name: &str) -> Result<(), VerifyError> {
    let addr = format!("127.0.0.1:{port}");

    // Check TCP reachability quickly (1-second window).
    // If connection is refused this fast, another process stole the port.
    let tcp_result = timeout(Duration::from_secs(1), TcpStream::connect(&addr)).await;

    match tcp_result {
        // Connection refused within 1 second → port race.
        Ok(Err(_)) | Err(_) => {
            // Distinguish: Err(_) is a timeout (port bound but not listening?),
            // Ok(Err(_)) is an immediate OS-level rejection (port stolen).
            // In both cases within 1s we treat as port-race and retry.
            return Err(VerifyError::PortRace { stolen_port: port });
        }
        Ok(Ok(_)) => {
            // TCP connected — drop the stream and let sqlx open a proper connection.
        }
    }

    // Issue `SELECT 1` against the actual Beads DB within a 15-second window.
    let url = format!("mysql://root:@127.0.0.1:{port}/{db_name}");
    let sql_result = timeout(Duration::from_secs(15), async {
        let pool = sqlx::MySqlPool::connect(&url).await?;
        let r = sqlx::query("SELECT 1").execute(&pool).await;
        pool.close().await;
        r
    })
    .await;

    match sql_result {
        Ok(Ok(_)) => Ok(()),
        Ok(Err(e)) => Err(VerifyError::SlowStart {
            port,
            detail: format!("SQL error: {e}"),
        }),
        Err(_elapsed) => Err(VerifyError::SlowStart {
            port,
            detail: "SELECT 1 timed out after 3s".to_string(),
        }),
    }
}

fn free_port() -> Option<u16> {
    TcpListener::bind("127.0.0.1:0")
        .ok()
        .and_then(|l| l.local_addr().ok())
        .map(|a| a.port())
}

async fn wait_for_port_async(port: u16, max_wait: Duration) -> Result<(), String> {
    let addr = format!("127.0.0.1:{port}");
    let result = timeout(max_wait, async {
        loop {
            if TcpStream::connect(&addr).await.is_ok() {
                return;
            }
            sleep(Duration::from_millis(200)).await;
        }
    })
    .await;
    result.map_err(|_| format!("timed out waiting for port {port}"))
}

/// Locate `dolt` — check settings override first, then PATH, then common install locations.
/// `dolt` is provisioned by `bd`; users don't install it directly. The sibling-to-bd
/// check covers cases where bd and dolt live in the same bin directory.
/// Pass `Some(path)` from `AppSettings.binary_paths.dolt` when available.
pub fn find_dolt(settings_override: Option<&str>) -> Option<PathBuf> {
    if let Some(p) = settings_override {
        if !p.is_empty() {
            let candidate = PathBuf::from(p);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }
    let bin = if cfg!(windows) { "dolt.exe" } else { "dolt" };
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
    // Sibling-to-bd: if bd is found, dolt may live in the same directory
    if let Some(bd_path) = crate::bd::runner::find_bd("") {
        if let Some(parent) = bd_path.parent() {
            let sibling = parent.join(bin);
            if sibling.is_file() {
                return Some(sibling);
            }
        }
    }
    // Common install locations per OS
    let home = std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(std::path::PathBuf::from);
    let static_candidates: &[&str] = if cfg!(target_os = "macos") {
        &["/opt/homebrew/bin/dolt", "/usr/local/bin/dolt"]
    } else if cfg!(target_os = "linux") {
        &["/usr/local/bin/dolt"]
    } else {
        &[]
    };
    for raw in static_candidates {
        let p = std::path::PathBuf::from(raw);
        if p.is_file() {
            return Some(p);
        }
    }
    if cfg!(target_os = "linux") {
        if let Some(ref h) = home {
            let p = h.join(".local/bin/dolt");
            if p.is_file() {
                return Some(p);
            }
        }
    }
    if cfg!(windows) {
        if let Some(h) = home {
            for suffix in &[
                r"AppData\Local\Programs\dolt\bin\dolt.exe",
                r"scoop\apps\dolt\current\dolt.exe",
            ] {
                let p = h.join(suffix);
                if p.is_file() {
                    return Some(p);
                }
            }
        }
    }
    None
}
