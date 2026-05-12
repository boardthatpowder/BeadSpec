use std::collections::HashMap;
use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tokio::net::TcpStream;
use tokio::process::{Child, Command};
use tokio::sync::RwLock;
use tokio::time::{sleep, timeout};

use crate::db::recovery::discover_db_name;

struct SpawnedServer {
    port: u16,
    child: Child,
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
    ) -> Result<u16, String> {
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
        let dolt_bin = find_dolt(override_opt).ok_or("dolt binary not found on PATH")?;

        // Discover the Beads DB name once — needed for the post-spawn health check.
        let db_name = discover_db_name(embeddeddolt_dir)
            .ok_or("Cannot determine Beads DB name from embeddeddolt dir")?;

        // Task 7.4: retry up to 3 times to handle port-race scenarios.
        const MAX_ATTEMPTS: u32 = 3;
        let mut last_error = String::new();

        for attempt in 0..MAX_ATTEMPTS {
            let port = free_port().ok_or("No free port available")?;

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
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null())
                .spawn();

            let child = match child_result {
                Ok(c) => c,
                Err(e) => {
                    return Err(format!("Failed to spawn dolt sql-server: {e}"));
                }
            };

            // Wait for the TCP port to accept connections (up to 10 seconds).
            match wait_for_port_async(port, Duration::from_secs(10)).await {
                Ok(()) => {}
                Err(e) => {
                    last_error = format!("dolt sql-server did not start in time: {e}");
                    eprintln!(
                        "[dolt_server] Sidecar spawn attempt {attempt}: port {port} never accepted connections — {e}"
                    );
                    continue;
                }
            }

            // Task 7.3: verify SQL readiness against the actual Beads DB before
            // writing .supervisor.pid.  A 3-second timeout guards the whole check;
            // a quick connection-refused (< 1 second) is treated as a port race.
            match verify_beads_db_ready(port, &db_name).await {
                Ok(()) => {
                    // SQL is healthy — register and return.
                    let mut servers = self.servers.write().await;
                    servers.insert(project_path.to_string(), SpawnedServer { port, child });
                    return Ok(port);
                }
                Err(VerifyError::PortRace { stolen_port }) => {
                    last_error = format!(
                        "Port {stolen_port} was stolen between selection and sidecar bind"
                    );
                    eprintln!(
                        "[warn] Port {} stolen between selection and sidecar bind (attempt {}), retrying",
                        stolen_port,
                        attempt
                    );
                    // Loop to retry with a fresh free port.
                    continue;
                }
                Err(VerifyError::SlowStart { port: p, detail }) => {
                    // Sidecar started on the right port but is slow to respond — give
                    // it more time by waiting an additional 5 seconds and re-checking.
                    eprintln!(
                        "[warn] Sidecar on port {p} is slow to accept SQL connections ({detail}), waiting 5s"
                    );
                    sleep(Duration::from_secs(5)).await;
                    match verify_beads_db_ready(p, &db_name).await {
                        Ok(()) => {
                            let mut servers = self.servers.write().await;
                            servers.insert(project_path.to_string(), SpawnedServer { port: p, child });
                            return Ok(p);
                        }
                        Err(e) => {
                            last_error = format!("Sidecar SQL verify failed after extended wait: {e:?}");
                            eprintln!("[warn] Sidecar on port {p} still not ready after extended wait, attempt {attempt}");
                            continue;
                        }
                    }
                }
            }
        }

        Err(format!(
            "Failed to spawn dolt sidecar after {MAX_ATTEMPTS} attempts: {last_error}"
        ))
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
    let tcp_result = timeout(
        Duration::from_secs(1),
        TcpStream::connect(&addr),
    )
    .await;

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

    // Issue `SELECT 1` against the actual Beads DB within a 3-second window.
    let url = format!("mysql://root:@127.0.0.1:{port}/{db_name}");
    let sql_result = timeout(Duration::from_secs(3), async {
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
            if candidate.is_file() { Some(candidate) } else { None }
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
            for suffix in &[r"AppData\Local\Programs\dolt\bin\dolt.exe", r"scoop\apps\dolt\current\dolt.exe"] {
                let p = h.join(suffix);
                if p.is_file() {
                    return Some(p);
                }
            }
        }
    }
    None
}
