//! Workspace-owned Beads transport. Never retries a dispatched mutation.
#[path = "api/policy.rs"]
mod policy;

use super::runner::find_bd;
use policy::{commit_policy_requires_cli, supported_version};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use specta::Type;
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, OnceLock, Weak};
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::{Mutex, RwLock};

pub const HISTORY_COVERAGE: &str = "Recent activity may exclude events from before live updates were enabled or outside retained history.";

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Type, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Transport {
    Http,
    Cli,
}
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Type, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum LiveUpdateMode {
    Streaming,
    Polling,
    Disabled,
    Reconnecting,
}
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ProjectBackendStatus {
    pub project_path: String,
    pub read_transport: Transport,
    pub write_transport: Transport,
    pub live_update_mode: LiveUpdateMode,
    pub journal_enabled: bool,
    pub historical_coverage: String,
    pub reason: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct JournalRecord {
    pub seq: i64,
    pub ts: String,
    pub op: String,
    #[serde(default)]
    pub issue_id: String,
    #[serde(default)]
    pub actor: Option<String>,
    #[serde(default)]
    pub issue: Option<Value>,
    #[serde(default)]
    pub dep: Option<Value>,
    #[serde(default)]
    pub comment: Option<Value>,
}
#[derive(Debug, Clone, Deserialize)]
pub struct EventsPage {
    pub records: Vec<JournalRecord>,
    pub head: i64,
}
#[derive(Debug, Clone, thiserror::Error)]
pub enum FeedError {
    #[error("Live updates are disabled for this project")]
    Disabled,
    #[error("Journal history was truncated (floor {floor}, head {head})")]
    Truncated { floor: i64, head: i64 },
    #[error("Journal connection limit reached")]
    Saturated,
    #[error("{0}")]
    Other(String),
}

struct HttpSession {
    base: String,
    child: Child,
    capabilities: HashSet<String>,
}
struct Inner {
    binary: PathBuf,
    beads_dir: PathBuf,
    context: Value,
    actor: String,
    client: reqwest::Client,
    token: Option<String>,
    cli_gate: Arc<Mutex<()>>,
    session: Mutex<Option<HttpSession>>,
    lifecycle: Mutex<()>,
    enable_gate: Mutex<()>,
    closed: AtomicBool,
    status: RwLock<ProjectBackendStatus>,
}
#[derive(Clone)]
pub struct BeadsDataSource {
    pub project_path: String,
    inner: Arc<Inner>,
}

fn workspace_gate(path: &Path) -> Arc<Mutex<()>> {
    static GATES: OnceLock<std::sync::Mutex<HashMap<PathBuf, Weak<Mutex<()>>>>> = OnceLock::new();
    let mut gates = GATES
        .get_or_init(Default::default)
        .lock()
        .expect("workspace gate poisoned");
    if let Some(gate) = gates.get(path).and_then(Weak::upgrade) {
        return gate;
    }
    let gate = Arc::new(Mutex::new(()));
    gates.insert(path.to_owned(), Arc::downgrade(&gate));
    gate
}

async fn native(binary: &Path, project: &str, args: &[&str]) -> Result<String, String> {
    let child = Command::new(binary)
        .current_dir(project)
        .args(["-C", project])
        .args(args)
        .env("BD_NON_INTERACTIVE", "1")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| format!("Cannot start bd: {e}"))?;
    let output = tokio::time::timeout(Duration::from_secs(30), child.wait_with_output())
        .await
        .map_err(|_| "bd command timed out; its outcome may be uncertain".to_string())?
        .map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err(format!(
            "bd command failed: {}\n{}",
            String::from_utf8_lossy(&output.stderr).trim(),
            String::from_utf8_lossy(&output.stdout).trim()
        ));
    }
    String::from_utf8(output.stdout).map_err(|e| format!("bd returned invalid UTF-8: {e}"))
}
fn parse_json(text: &str) -> Result<Value, String> {
    serde_json::from_str(text).map_err(|e| format!("Invalid Beads JSON: {e}"))
}
fn rows(value: Value) -> Result<Vec<Value>, String> {
    if let Some(array) = value.as_array() {
        return Ok(array.clone());
    }
    for key in ["items", "issues", "edges", "dependencies", "results"] {
        if let Some(array) = value.get(key).and_then(Value::as_array) {
            return Ok(array.clone());
        }
    }
    Err("Beads response did not contain a row collection".into())
}
fn field<'a>(value: &'a Value, key: &str) -> &'a str {
    value.get(key).and_then(Value::as_str).unwrap_or("")
}

impl BeadsDataSource {
    pub async fn connect(
        project_path: &str,
        bd_override: &str,
        actor: &str,
    ) -> Result<Self, String> {
        tokio::time::timeout(
            Duration::from_secs(30),
            Self::connect_impl(project_path, bd_override, actor),
        )
        .await
        .map_err(|_| "Beads connection did not become ready within 30 seconds".to_string())?
    }
    async fn connect_impl(
        project_path: &str,
        bd_override: &str,
        actor: &str,
    ) -> Result<Self, String> {
        let path = std::fs::canonicalize(project_path)
            .map_err(|e| format!("Invalid project directory: {e}"))?;
        let project_path = path.to_string_lossy().into_owned();
        let binary = find_bd(bd_override).ok_or("bd CLI not found — install Beads 1.3 or newer")?;
        let version = native(&binary, &project_path, &["version"]).await?;
        if !supported_version(&version) {
            return Err(format!(
                "BeadSpec requires Beads 1.3 or newer; found {}",
                version.trim()
            ));
        }
        let context = parse_json(&native(&binary, &project_path, &["context", "--json"]).await?)?;
        let beads_dir = std::fs::canonicalize(field(&context, "beads_dir"))
            .map_err(|e| format!("Cannot resolve Beads workspace: {e}"))?;
        let mode = field(&context, "dolt_mode");
        let http = mode != "embedded";
        let client = reqwest::Client::builder()
            .no_proxy()
            .redirect(reqwest::redirect::Policy::none())
            .connect_timeout(Duration::from_secs(5))
            .build()
            .map_err(|e| e.to_string())?;
        let token = match std::env::var_os("BEADS_SERVE_TOKEN_FILE") {
            Some(path) => Some(
                std::fs::read_to_string(path)
                    .map_err(|_| "Cannot read Beads authentication token file")?
                    .trim()
                    .to_owned(),
            ),
            None => None,
        };
        let source = Self {
            project_path: project_path.clone(),
            inner: Arc::new(Inner {
                binary,
                beads_dir: beads_dir.clone(),
                context,
                actor: actor.into(),
                client,
                token,
                cli_gate: workspace_gate(&beads_dir),
                session: Mutex::new(None),
                lifecycle: Mutex::new(()),
                enable_gate: Mutex::new(()),
                closed: AtomicBool::new(false),
                status: RwLock::new(ProjectBackendStatus {
                    project_path,
                    read_transport: if http {
                        Transport::Http
                    } else {
                        Transport::Cli
                    },
                    write_transport: Transport::Cli,
                    live_update_mode: LiveUpdateMode::Disabled,
                    journal_enabled: false,
                    historical_coverage: HISTORY_COVERAGE.into(),
                    reason: if http {
                        None
                    } else {
                        Some("Embedded projects use native Beads commands".into())
                    },
                }),
            }),
        };
        if http {
            source.start_server().await?;
        }
        source.refresh_policy().await;
        let journal = source.config_value("events-journal", None).await;
        // Journal configuration is YAML-owned; probe events for HTTP rather than infer capability.
        if http {
            match source.events_page(i64::MAX, 1).await {
                Ok(_) => {
                    let mut status = source.inner.status.write().await;
                    status.journal_enabled = true;
                    status.live_update_mode = LiveUpdateMode::Reconnecting;
                }
                Err(FeedError::Disabled) => {}
                Err(error) => {
                    source.inner.status.write().await.reason = Some(error.to_string());
                }
            }
        } else if journal.as_deref() == Some("true") {
            let mut status = source.inner.status.write().await;
            status.journal_enabled = true;
            status.live_update_mode = LiveUpdateMode::Polling;
        }
        Ok(source)
    }

    pub fn is_http(&self) -> bool {
        field(&self.inner.context, "dolt_mode") != "embedded"
    }
    pub fn actor(&self) -> &str {
        &self.inner.actor
    }
    pub async fn status(&self) -> ProjectBackendStatus {
        self.inner.status.read().await.clone()
    }
    pub async fn set_sync_mode(&self, mode: LiveUpdateMode, reason: Option<String>) {
        let mut status = self.inner.status.write().await;
        status.live_update_mode = mode;
        if reason.is_some() || status.write_transport != Transport::Cli {
            status.reason = reason;
        }
    }
    pub async fn set_journal_enabled(&self, enabled: bool) {
        self.inner.status.write().await.journal_enabled = enabled;
    }
    pub async fn refresh_journal_status(&self) -> Result<bool, String> {
        let enabled = if self.is_http() {
            match self.events_page(i64::MAX, 1).await {
                Ok(_) => true,
                Err(FeedError::Disabled) => false,
                Err(error) => return Err(error.to_string()),
            }
        } else {
            self.config_value("events-journal", None).await.as_deref() == Some("true")
        };
        self.set_journal_enabled(enabled).await;
        Ok(enabled)
    }
    pub async fn has_capability(&self, capability: &str) -> bool {
        self.inner
            .session
            .lock()
            .await
            .as_ref()
            .map(|s| s.capabilities.contains(capability))
            .unwrap_or(false)
    }
    pub async fn run_cli(&self, args: &[&str]) -> Result<String, String> {
        if self.inner.closed.load(Ordering::Acquire) {
            return Err("Project is disconnected".into());
        }
        let _guard = if self.is_http() {
            None
        } else {
            Some(self.inner.cli_gate.lock().await)
        };
        let mut actor_args = vec!["--actor", self.actor()];
        actor_args.extend_from_slice(args);
        native(&self.inner.binary, &self.project_path, &actor_args).await
    }

    async fn config_value(&self, key: &str, known: Option<&Value>) -> Option<String> {
        if let Some(value) = known
            .and_then(Value::as_array)
            .and_then(|entries| entries.iter().find(|entry| field(entry, "key") == key))
            .and_then(|entry| entry.get("value"))
        {
            return Some(
                value
                    .as_str()
                    .map(str::to_owned)
                    .unwrap_or_else(|| value.to_string()),
            );
        }
        let text = self.run_cli(&["config", "get", key, "--json"]).await.ok()?;
        let value = parse_json(&text).ok()?;
        let value = value.get("value").unwrap_or(&value);
        Some(
            value
                .as_str()
                .map(str::to_owned)
                .unwrap_or_else(|| value.to_string()),
        )
    }
    async fn refresh_policy(&self) -> bool {
        if !self.is_http() {
            return true;
        }
        let config = self
            .run_cli(&["config", "show", "--json"])
            .await
            .ok()
            .and_then(|text| parse_json(&text).ok());
        let commit = self.config_value("dolt.auto-commit", config.as_ref()).await;
        let export = self.config_value("export.auto", config.as_ref()).await;
        let push = self.config_value("dolt.auto-push", config.as_ref()).await;
        let backup = self.config_value("backup.enabled", None).await;
        let local_only = self.config_value("dolt.local-only", config.as_ref()).await;
        let mode = field(&self.inner.context, "dolt_mode");
        let policy = match (commit, export, push, backup, local_only) {
            (Some(commit), Some(export), Some(push), Some(backup), Some(local_only)) => {
                commit_policy_requires_cli(mode, &commit)
                    || (mode != "proxied"
                        && (export == "true"
                            || backup == "true"
                            || (push == "true" && local_only != "true")))
            }
            _ => true,
        };
        let mut status = self.inner.status.write().await;
        status.write_transport = if policy {
            Transport::Cli
        } else {
            Transport::Http
        };
        if policy {
            status.reason = Some(
                "Native writes preserve workspace hooks and command-side maintenance policies"
                    .into(),
            );
        }
        policy
    }
    async fn relevant_hook(&self, args: &[&str]) -> bool {
        let hook = match args.first().copied().unwrap_or("") {
            "create" => "on_create",
            "close" => "on_close",
            "delete" | "config" => return false,
            _ => "on_update",
        };
        if self.config_value("no-hooks", None).await.as_deref() == Some("true") {
            return false;
        }
        let names = if args.first() == Some(&"create")
            && args.iter().any(|arg| matches!(*arg, "--deps" | "--parent"))
        {
            vec![hook, "on_update"]
        } else {
            vec![hook]
        };
        names.into_iter().any(|hook| {
            let path = self.inner.beads_dir.join("hooks").join(hook);
            match std::fs::metadata(path) {
                Ok(metadata) if metadata.is_file() => {
                    #[cfg(unix)]
                    {
                        use std::os::unix::fs::PermissionsExt;
                        metadata.permissions().mode() & 0o111 != 0
                    }
                    #[cfg(not(unix))]
                    {
                        true
                    }
                }
                _ => false,
            }
        })
    }

    fn stamped(&self, request: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
        let request = match &self.inner.token {
            Some(token) => request.bearer_auth(token),
            None => request,
        };
        let id = field(&self.inner.context, "project_id");
        if id.is_empty() {
            request
        } else {
            request.header("Bd-Project-Id", id)
        }
    }
    async fn base(&self) -> Result<String, String> {
        if self.inner.closed.load(Ordering::Acquire) {
            return Err("Project is disconnected".into());
        }
        {
            let mut session = self.inner.session.lock().await;
            if let Some(server) = session.as_mut() {
                if server
                    .child
                    .try_wait()
                    .map_err(|e| e.to_string())?
                    .is_some()
                {
                    session.take();
                }
            }
            if let Some(server) = session.as_ref() {
                return Ok(server.base.clone());
            }
        }
        self.set_sync_mode(
            LiveUpdateMode::Reconnecting,
            Some("Restarting the owned Beads HTTP server".into()),
        )
        .await;
        self.start_server().await?;
        self.inner
            .session
            .lock()
            .await
            .as_ref()
            .map(|s| s.base.clone())
            .ok_or("Beads HTTP server is not running".into())
    }
    async fn request(
        &self,
        method: &str,
        path: &str,
        query: &[(&str, String)],
        body: Option<&Value>,
    ) -> Result<reqwest::Response, String> {
        let base = self.base().await?;
        let method = reqwest::Method::from_bytes(method.as_bytes()).map_err(|e| e.to_string())?;
        let mut request = self
            .stamped(
                self.inner
                    .client
                    .request(method, format!("{base}/v0/beads{path}"))
                    .query(query),
            )
            .timeout(Duration::from_secs(30));
        if let Some(body) = body {
            request = request.json(body);
        }
        request
            .send()
            .await
            .map_err(|e| format!("Beads request failed; mutation outcome may be uncertain: {e}"))
    }
    async fn json_response(response: reqwest::Response) -> Result<Value, String> {
        let status = response.status();
        let text = response.text().await.map_err(|e| e.to_string())?;
        let value = parse_json(&text)?;
        if status.is_success() {
            Ok(value)
        } else {
            Err(problem_message(status.as_u16(), &value))
        }
    }
    async fn get_json(&self, path: &str, query: &[(&str, String)]) -> Result<Value, String> {
        Self::json_response(self.request("GET", path, query, None).await?).await
    }

    pub async fn list_issues(&self) -> Result<Vec<Value>, String> {
        if !self.is_http() || !self.has_capability("issues.list").await {
            return rows(parse_json(
                &self
                    .run_cli(&[
                        "list",
                        "--json",
                        "--all",
                        "--limit",
                        "0",
                        "--include-templates",
                        "--include-gates",
                        "--include-infra",
                    ])
                    .await?,
            )?);
        }
        let mut result = Vec::new();
        let mut cursor = String::new();
        loop {
            let mut query = vec![
                ("all", "true".into()),
                ("include_templates", "true".into()),
                ("include_gates", "true".into()),
                ("include_infra", "true".into()),
                ("include_ephemeral", "true".into()),
                ("limit", "0".into()),
            ];
            if !cursor.is_empty() {
                query.push(("cursor", cursor.clone()));
            }
            let page = self.get_json("/issues", &query).await?;
            result.extend(rows(page.clone())?);
            if !page
                .get("has_more")
                .and_then(Value::as_bool)
                .unwrap_or(false)
            {
                return Ok(result);
            }
            let next = field(&page, "next_cursor");
            if next.is_empty() || next == cursor {
                return Err("Beads returned an invalid paging cursor".into());
            }
            cursor = next.into();
        }
    }
    pub async fn get_issue(&self, id: &str) -> Result<Value, String> {
        if !self.is_http() || !self.has_capability("issues.get").await {
            let value = parse_json(
                &self
                    .run_cli(&[
                        "show",
                        id,
                        "--json",
                        "--include-comments",
                        "--include-dependents",
                    ])
                    .await?,
            )?;
            return if let Some(array) = value.as_array() {
                array.first().cloned().ok_or("Issue not found".into())
            } else {
                Ok(value)
            };
        }
        let value = self
            .get_json(
                &format!("/issues/{}", encode_segment(id)),
                &[
                    ("include_comments", "true".into()),
                    ("include_dependents", "true".into()),
                ],
            )
            .await?;
        Ok(value.get("issue").cloned().unwrap_or(value))
    }
    pub async fn dependencies(&self, ids: &[String]) -> Result<Vec<Value>, String> {
        let mut result = Vec::new();
        if self.is_http() && self.has_capability("dependencies.list").await {
            for chunk in ids.chunks(100) {
                let query: Vec<_> = chunk.iter().map(|id| ("issue_id", id.clone())).collect();
                result.extend(rows(self.get_json("/dependencies", &query).await?)?);
            }
        } else {
            for chunk in ids.chunks(100) {
                let mut args = vec!["dep", "list"];
                args.extend(chunk.iter().map(String::as_str));
                // Beads 1.3's single-ID form projects related issue rows and omits
                // missing/external targets. Two anchors select its raw edge batch form.
                if chunk.len() == 1 {
                    args.push(chunk[0].as_str());
                }
                args.push("--json");
                result.extend(rows(parse_json(&self.run_cli(&args).await?)?)?);
            }
        }
        let mut seen = HashSet::new();
        result.retain(|edge| {
            seen.insert((
                field(edge, "issue_id").to_owned(),
                field(edge, "depends_on_id").to_owned(),
                field(edge, "type").to_owned(),
            ))
        });
        Ok(result)
    }
    pub async fn ready(&self, epic: Option<&str>) -> Result<Vec<Value>, String> {
        if self.is_http() && self.has_capability("ready.list").await {
            let mut query = vec![("limit", "0".into())];
            if let Some(epic) = epic {
                query.push(("parent", epic.into()));
            }
            return rows(self.get_json("/ready", &query).await?);
        }
        let mut args = vec!["ready", "--json", "--limit", "0"];
        if let Some(epic) = epic {
            args.extend(["--parent", epic]);
        }
        rows(parse_json(&self.run_cli(&args).await?)?)
    }
    pub async fn write(
        &self,
        args: &[&str],
        capability: &str,
        method: &str,
        path: &str,
        mut body: Value,
    ) -> Result<String, String> {
        if !self.is_http()
            || !self.has_capability(capability).await
            || self.refresh_policy().await
            || self.relevant_hook(args).await
        {
            self.inner.status.write().await.write_transport = Transport::Cli;
            return self.run_cli(args).await;
        }
        if let Some(object) = body.as_object_mut() {
            if capability == "issues.addComment" {
                object.entry("author").or_insert(json!(self.actor()));
            } else {
                object.entry("actor").or_insert(json!(self.actor()));
            }
        }
        // No retry/fallback past this dispatch boundary: a lost response may have committed.
        let response = self.request(method, path, &[], Some(&body)).await?;
        let status = response.status();
        let value: Value = response.json().await.map_err(|error| {
            format!(
                "Beads mutation response could not be decoded; refresh before retrying: {error}"
            )
        })?;
        if !status.is_success() {
            // A policy refusal committed nothing. Read the current raw graph for the
            // existing blocker UI; this is a read only follow-up, never a write retry.
            if capability == "issues.close"
                && field(&value, "code") == "not_closable"
                && value.get("open_children").is_none()
            {
                if let Some(id) = args.get(1) {
                    if let Ok(edges) = self.dependencies(&[(*id).to_owned()]).await {
                        let mut blockers = Vec::new();
                        for edge in edges {
                            if field(&edge, "type") != "blocks" {
                                continue;
                            }
                            let target = field(&edge, "depends_on_id");
                            if let Ok(issue) = self.get_issue(target).await {
                                if field(&issue, "status") != "closed" {
                                    blockers.push(target.to_owned());
                                }
                            }
                        }
                        if !blockers.is_empty() {
                            return Err(format!(
                                "blocked by open issues [{}]",
                                blockers.join(", ")
                            ));
                        }
                    }
                }
            }
            return Err(problem_message(status.as_u16(), &value));
        }
        if capability == "issues.create" {
            let id = field(value.get("issue").unwrap_or(&value), "id");
            if id.is_empty() {
                return Err(
                    "Beads created an issue but returned no ID; refresh before retrying".into(),
                );
            }
            return Ok(format!("Created issue: {id}"));
        }
        Ok(value.to_string())
    }

    pub async fn events_page(&self, since: i64, limit: u32) -> Result<EventsPage, FeedError> {
        let response = self
            .request(
                "GET",
                "/events",
                &[("since", since.to_string()), ("limit", limit.to_string())],
                None,
            )
            .await
            .map_err(FeedError::Other)?;
        let status = response.status().as_u16();
        let value: Value = response
            .json()
            .await
            .map_err(|e| FeedError::Other(e.to_string()))?;
        if status >= 400 {
            return Err(feed_problem(status, &value));
        }
        serde_json::from_value(value).map_err(|e| FeedError::Other(e.to_string()))
    }
    pub async fn open_event_stream(&self, since: i64) -> Result<reqwest::Response, FeedError> {
        let base = self.base().await.map_err(FeedError::Other)?;
        // Bound the handshake only: a healthy SSE response body is intentionally long lived.
        let send = self
            .stamped(
                self.inner
                    .client
                    .get(format!("{base}/v0/beads/events:watch"))
                    .query(&[("since", since.to_string())]),
            )
            .send();
        let response = tokio::time::timeout(Duration::from_secs(10), send)
            .await
            .map_err(|_| FeedError::Other("Journal stream handshake timed out".into()))?
            .map_err(|error| FeedError::Other(error.to_string()))?;
        if response.status().is_success() {
            return Ok(response);
        }
        let status = response.status().as_u16();
        let value: Value = tokio::time::timeout(Duration::from_secs(10), response.json())
            .await
            .map_err(|_| FeedError::Other("Journal error response timed out".into()))?
            .map_err(|error| FeedError::Other(error.to_string()))?;
        Err(feed_problem(status, &value))
    }

    async fn start_server(&self) -> Result<(), String> {
        let _lifecycle = self.inner.lifecycle.lock().await;
        self.start_server_locked().await
    }
    async fn start_server_locked(&self) -> Result<(), String> {
        if self.inner.closed.load(Ordering::Acquire) {
            return Err("Project is disconnected".into());
        }
        if self.inner.session.lock().await.is_some() {
            return Ok(());
        }
        tokio::time::timeout(Duration::from_secs(30), async {
            let mut child = Command::new(&self.inner.binary)
                .current_dir(&self.project_path)
                .args(["-C", &self.project_path, "serve", "--addr", "127.0.0.1:0"])
                .env("BD_NON_INTERACTIVE", "1")
                .stdin(Stdio::null())
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .kill_on_drop(true)
                .spawn()
                .map_err(|e| format!("Cannot start Beads HTTP server: {e}"))?;
            let stderr = child.stderr.take().expect("stderr piped");
            let diagnostics = Arc::new(Mutex::new(String::new()));
            let diagnostic_copy = diagnostics.clone();
            tokio::spawn(async move {
                let mut lines = BufReader::new(stderr).lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    let mut output = diagnostic_copy.lock().await;
                    if output.len() < 8192 {
                        output.push_str(&line);
                        output.push('\n');
                    }
                }
            });
            let mut lines = BufReader::new(child.stdout.take().expect("stdout piped")).lines();
            let base = loop {
                match lines.next_line().await.map_err(|e| e.to_string())? {
                    Some(line) => {
                        if let Some(base) = line.strip_prefix("bd serve: listening on ") {
                            let url = reqwest::Url::parse(base)
                                .map_err(|_| "Invalid Beads server address")?;
                            if url.scheme() != "http"
                                || url.host_str() != Some("127.0.0.1")
                                || url.port().is_none()
                            {
                                return Err(
                                    "Beads server did not bind the requested loopback address"
                                        .into(),
                                );
                            }
                            break base.trim_end_matches('/').to_string();
                        }
                    }
                    None => {
                        let _ = child.wait().await;
                        return Err(format!(
                            "Beads server exited during startup: {}",
                            diagnostics.lock().await
                        ));
                    }
                }
            };
            tokio::spawn(async move { while let Ok(Some(_)) = lines.next_line().await {} });
            loop {
                if child.try_wait().map_err(|e| e.to_string())?.is_some() {
                    return Err(format!("Beads server exited: {}", diagnostics.lock().await));
                }
                let request = self
                    .stamped(self.inner.client.get(format!("{base}/v0/beads/context")))
                    .timeout(Duration::from_secs(2));
                let last_error = match request.send().await {
                    Ok(response) => match Self::json_response(response).await {
                        Ok(context) => {
                            verify_context(&self.inner.context, &context)?;
                            let readiness = self
                                .stamped(
                                    self.inner
                                        .client
                                        .get(format!("{base}/v0/beads/ready?limit=1")),
                                )
                                .timeout(Duration::from_secs(2))
                                .send()
                                .await;
                            if matches!(&readiness, Ok(response) if response.status().is_success())
                            {
                                let capabilities = context
                                    .get("capabilities")
                                    .and_then(Value::as_array)
                                    .ok_or("Beads context omitted capabilities")?
                                    .iter()
                                    .filter_map(Value::as_str)
                                    .map(str::to_owned)
                                    .collect();
                                if self.inner.closed.load(Ordering::Acquire) {
                                    return Err("Project is disconnected".into());
                                }
                                *self.inner.session.lock().await = Some(HttpSession {
                                    base,
                                    child,
                                    capabilities,
                                });
                                return Ok(());
                            }
                            "Beads data readiness check failed".to_string()
                        }
                        Err(error) => error,
                    },
                    Err(error) => error.to_string(),
                };
                tokio::time::sleep(Duration::from_millis(100)).await;
                if !last_error.is_empty() {
                    self.inner.status.write().await.reason = Some(last_error.clone());
                }
            }
        })
        .await
        .map_err(|_| "Beads HTTP server did not become ready within 30 seconds".to_string())?
    }
    pub async fn stop(&self) {
        self.inner.closed.store(true, Ordering::Release);
        let _lifecycle = self.inner.lifecycle.lock().await;
        self.stop_server_locked().await;
    }
    async fn stop_server_locked(&self) {
        if let Some(mut session) = self.inner.session.lock().await.take() {
            let _ = session.child.kill().await;
            let _ = session.child.wait().await;
        }
    }
    pub async fn enable_journal(&self) -> Result<ProjectBackendStatus, String> {
        let _enable = self.inner.enable_gate.lock().await;
        self.run_cli(&["config", "set", "events-journal", "true"])
            .await?;
        let lifecycle = self.inner.lifecycle.lock().await;
        if self.inner.closed.load(Ordering::Acquire) {
            return Err("Project is disconnected".into());
        }
        if self.is_http() {
            self.stop_server_locked().await;
            if let Err(error) = self.start_server_locked().await {
                self.set_sync_mode(LiveUpdateMode::Reconnecting, Some(error.clone()))
                    .await;
                return Err(error);
            }
        }
        drop(lifecycle);
        if !self.refresh_journal_status().await? {
            return Err(
                "Live updates remain disabled; check environment overrides for events-journal"
                    .into(),
            );
        }
        let mut status = self.inner.status.write().await;
        status.live_update_mode = if self.is_http() {
            LiveUpdateMode::Reconnecting
        } else {
            LiveUpdateMode::Polling
        };
        Ok(status.clone())
    }
}

pub(crate) fn encode_segment(segment: &str) -> String {
    let mut url = reqwest::Url::parse("http://127.0.0.1/").expect("valid URL");
    url.path_segments_mut()
        .expect("hierarchical URL")
        .push(segment);
    url.path().trim_start_matches('/').to_string()
}
fn verify_context(expected: &Value, received: &Value) -> Result<(), String> {
    if field(received, "api_version") != "v0" || !supported_version(field(received, "bd_version")) {
        return Err("Unsupported Beads HTTP API version".into());
    }
    for key in ["project_id", "database", "backend", "dolt_mode"] {
        if field(expected, key) != field(received, key) {
            return Err(format!("Beads server workspace identity mismatch ({key})"));
        }
    }
    if let Some(path) = received.get("beads_dir").and_then(Value::as_str) {
        if std::fs::canonicalize(path).ok()
            != std::fs::canonicalize(field(expected, "beads_dir")).ok()
        {
            return Err("Beads server workspace directory mismatch".into());
        }
    }
    Ok(())
}
fn problem_message(status: u16, problem: &Value) -> String {
    let mut blockers = Vec::new();
    for key in [
        "blockers",
        "blocking_ids",
        "blocking_issue_ids",
        "open_blockers",
        "open_children",
    ] {
        if let Some(ids) = problem.get(key).and_then(Value::as_array) {
            blockers.extend(
                ids.iter()
                    .filter_map(|id| id.as_str().or_else(|| id.get("id").and_then(Value::as_str)))
                    .map(str::to_owned),
            );
        }
    }
    if !blockers.is_empty() {
        return format!("blocked by open issues [{}]", blockers.join(", "));
    }
    format!(
        "Beads HTTP {status}: {}",
        problem
            .get("detail")
            .or_else(|| problem.get("reason"))
            .or_else(|| problem.get("title"))
            .and_then(Value::as_str)
            .unwrap_or("request refused")
    )
}
fn feed_problem(status: u16, problem: &Value) -> FeedError {
    if status == 409
        && (field(problem, "code") == "events_journal_disabled"
            || field(problem, "reason") == "events_journal_disabled")
    {
        return FeedError::Disabled;
    }
    if status == 410 {
        return FeedError::Truncated {
            floor: problem.get("floor").and_then(Value::as_i64).unwrap_or(0),
            head: problem.get("head").and_then(Value::as_i64).unwrap_or(0),
        };
    }
    if status == 503 {
        return FeedError::Saturated;
    }
    FeedError::Other(problem_message(status, problem))
}

#[cfg(test)]
#[path = "api/tests.rs"]
mod transport_tests;

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(unix)]
    #[tokio::test]
    async fn task_detail_reads_only_its_own_edges_and_preserves_both_directions() {
        use std::os::unix::fs::PermissionsExt;
        let directory = tempfile::tempdir().unwrap();
        let binary = directory.path().join("bd");
        std::fs::write(&binary, r#"#!/bin/sh
shift 4
printf '%s\n' "$*" >> calls
case "$*" in
  'show B-task --json --include-comments --include-dependents')
    printf '%s\n' '[{"id":"B-task","title":"Task","dependents":[{"id":"B-child","dependency_type":"blocks"},{"id":"B-child","dependency_type":"related"},{"id":"B-closed","status":"closed","dependency_type":"parent-child"}]}]' ;;
  'dep list B-task B-task --json')
    printf '%s\n' '[{"issue_id":"B-task","depends_on_id":"other:missing","type":"related"},{"issue_id":"B-task","depends_on_id":"B-epic","type":"parent-child"}]' ;;
  *) printf 'Unexpected project-wide or unscoped read: %s\n' "$*" >&2; exit 1 ;;
esac
"#).unwrap();
        std::fs::set_permissions(&binary, std::fs::Permissions::from_mode(0o755)).unwrap();
        let project_path = directory.path().to_string_lossy().into_owned();
        let source = BeadsDataSource {
            project_path: project_path.clone(),
            inner: Arc::new(Inner {
                binary,
                beads_dir: directory.path().to_owned(),
                context: json!({"dolt_mode":"embedded"}),
                actor: "test".into(),
                client: reqwest::Client::builder().no_proxy().build().unwrap(),
                token: None,
                cli_gate: workspace_gate(directory.path()),
                session: Mutex::new(None),
                lifecycle: Mutex::new(()),
                enable_gate: Mutex::new(()),
                closed: AtomicBool::new(false),
                status: RwLock::new(ProjectBackendStatus {
                    project_path,
                    read_transport: Transport::Cli,
                    write_transport: Transport::Cli,
                    live_update_mode: LiveUpdateMode::Disabled,
                    journal_enabled: false,
                    historical_coverage: HISTORY_COVERAGE.into(),
                    reason: None,
                }),
            }),
        };
        let detail = crate::commands::read::load_task_detail(&source, "B-task")
            .await
            .unwrap();
        assert_eq!(detail.dependencies, ["other:missing", "B-epic"]);
        assert_eq!(detail.dependents, ["B-child", "B-closed"]);
        assert_eq!(
            std::fs::read_to_string(directory.path().join("calls"))
                .unwrap()
                .lines()
                .count(),
            2
        );
    }
    #[test]
    fn redirected_embedded_workspaces_share_one_cli_gate() {
        let directory = tempfile::tempdir().unwrap();
        let first = workspace_gate(directory.path());
        let second = workspace_gate(directory.path());
        assert!(Arc::ptr_eq(&first, &second));
        let other = tempfile::tempdir().unwrap();
        assert!(!Arc::ptr_eq(&first, &workspace_gate(other.path())));
    }
    #[test]
    fn rejects_different_workspace() {
        let expected =
            json!({"project_id":"one","database":"db","backend":"dolt","dolt_mode":"server"});
        let received = json!({"api_version":"v0","bd_version":"1.3.0","project_id":"two","database":"db","backend":"dolt","dolt_mode":"server"});
        assert!(verify_context(&expected, &received)
            .unwrap_err()
            .contains("project_id"));
    }
    #[test]
    fn accepts_opaque_project_identity_without_host_paths() {
        let expected =
            json!({"project_id":"uuid","database":"db","backend":"dolt","dolt_mode":"server"});
        let received = json!({"api_version":"v0","bd_version":"1.3.0","project_id":"uuid","database":"db","backend":"dolt","dolt_mode":"server"});
        assert!(verify_context(&expected, &received).is_ok());
    }
    #[test]
    fn recognizes_feed_recovery_errors() {
        assert!(matches!(
            feed_problem(409, &json!({"code":"events_journal_disabled"})),
            FeedError::Disabled
        ));
        assert!(matches!(
            feed_problem(410, &json!({"floor":12,"head":40})),
            FeedError::Truncated {
                floor: 12,
                head: 40
            }
        ));
        assert!(matches!(
            feed_problem(503, &json!({})),
            FeedError::Saturated
        ));
    }
    #[test]
    fn preserves_blocker_error_contract() {
        assert_eq!(
            problem_message(409, &json!({"blockers":["B-1","B-2"]})),
            "blocked by open issues [B-1, B-2]"
        );
    }
    #[test]
    fn encodes_issue_id_as_one_path_segment() {
        assert_eq!(encode_segment("a/b?x"), "a%2Fb%3Fx");
    }
}
