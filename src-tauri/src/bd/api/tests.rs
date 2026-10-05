use super::*;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

#[cfg(unix)]
async fn mock_source(
    body: Value,
    status_code: u16,
) -> (
    BeadsDataSource,
    tempfile::TempDir,
    tokio::task::JoinHandle<String>,
) {
    use std::os::unix::fs::PermissionsExt;
    let dir = tempfile::tempdir().unwrap();
    let binary = dir.path().join("bd");
    std::fs::write(&binary, r#"#!/bin/sh
case "$6" in
show) echo '[{"key":"dolt.auto-commit","value":"on"},{"key":"export.auto","value":"false"},{"key":"dolt.auto-push","value":"false"},{"key":"dolt.local-only","value":"false"}]' ;;
get) echo '{"value":"false"}' ;;
*) echo unexpected-command >&2; exit 1 ;;
esac
"#).unwrap();
    std::fs::set_permissions(&binary, std::fs::Permissions::from_mode(0o700)).unwrap();
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let base = format!("http://{}", listener.local_addr().unwrap());
    let task = tokio::spawn(async move {
        let (mut stream, _) = listener.accept().await.unwrap();
        let mut request = vec![0; 16384];
        let n = stream.read(&mut request).await.unwrap();
        let body = body.to_string();
        let response=format!("HTTP/1.1 {status_code} Test\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",body.len());
        stream.write_all(response.as_bytes()).await.unwrap();
        String::from_utf8_lossy(&request[..n]).to_string()
    });
    let project_path = dir.path().to_string_lossy().into_owned();
    let source = BeadsDataSource {
        project_path: project_path.clone(),
        inner: Arc::new(Inner {
            binary,
            beads_dir: dir.path().to_owned(),
            context: json!({"dolt_mode":"server","project_id":"upstream-uuid"}),
            actor: "tester".into(),
            client: reqwest::Client::builder()
                .no_proxy()
                .redirect(reqwest::redirect::Policy::none())
                .build()
                .unwrap(),
            token: None,
            cli_gate: Arc::new(Mutex::new(())),
            session: Mutex::new(Some(HttpSession {
                base,
                child: Command::new("sleep")
                    .arg("60")
                    .kill_on_drop(true)
                    .spawn()
                    .unwrap(),
                capabilities: ["issues.create", "issues.list"]
                    .into_iter()
                    .map(str::to_owned)
                    .collect(),
            })),
            lifecycle: Mutex::new(()),
            enable_gate: Mutex::new(()),
            closed: AtomicBool::new(false),
            status: RwLock::new(ProjectBackendStatus {
                project_path,
                read_transport: Transport::Http,
                write_transport: Transport::Http,
                live_update_mode: LiveUpdateMode::Disabled,
                journal_enabled: false,
                historical_coverage: HISTORY_COVERAGE.into(),
                reason: None,
            }),
        }),
    };
    (source, dir, task)
}
#[cfg(unix)]
#[tokio::test]
async fn create_preserves_capture_id_and_stamps_upstream_identity() {
    let (source, _dir, request) = mock_source(json!({"issue":{"id":"T-42"}}), 200).await;
    assert_eq!(
        source
            .write(
                &["create", "Title"],
                "issues.create",
                "POST",
                "/issues",
                json!({"title":"Title"})
            )
            .await
            .unwrap(),
        "Created issue: T-42"
    );
    let request = request.await.unwrap().to_lowercase();
    assert!(request.contains("bd-project-id: upstream-uuid"));
    assert!(request.contains("post /v0/beads/issues"));
    source.stop().await;
}
#[cfg(unix)]
#[tokio::test]
async fn refused_write_never_falls_back_or_retries() {
    let (source, _dir, request) = mock_source(json!({"code":"busy","detail":"busy"}), 503).await;
    let error = source
        .write(
            &["create", "Title"],
            "issues.create",
            "POST",
            "/issues",
            json!({"title":"Title"}),
        )
        .await
        .unwrap_err();
    assert!(error.contains("503"));
    assert!(request.await.unwrap().starts_with("POST"));
    source.stop().await;
}
#[cfg(unix)]
#[tokio::test]
async fn full_read_includes_hidden_issue_classes() {
    let (source, _dir, request) = mock_source(
        json!({"items":[{"id":"T-1","status":"closed"}],"has_more":false}),
        200,
    )
    .await;
    assert_eq!(source.list_issues().await.unwrap()[0]["status"], "closed");
    let request = request.await.unwrap();
    for parameter in [
        "all=true",
        "include_templates=true",
        "include_gates=true",
        "include_infra=true",
        "include_ephemeral=true",
        "limit=0",
    ] {
        assert!(request.contains(parameter), "{request}");
    }
    source.stop().await;
}

#[cfg(unix)]
#[tokio::test]
async fn disconnected_clones_do_not_restart_children() {
    let (source, _dir, request) = mock_source(json!({}), 200).await;
    let clone = source.clone();
    source.stop().await;
    assert!(clone
        .list_issues()
        .await
        .unwrap_err()
        .contains("disconnected"));
    request.abort();
}

#[cfg(unix)]
#[tokio::test]
async fn disconnect_during_journal_enable_remains_permanent() {
    let (source, dir, request) = mock_source(json!({}), 200).await;
    let binary = dir.path().join("bd");
    std::fs::write(
        &binary,
        r#"#!/bin/sh
case "$6" in
set) touch enable-started; sleep 0.2; echo '{"value":true}' ;;
*) echo unexpected-command >&2; exit 1 ;;
esac
"#,
    )
    .unwrap();
    let enabling = source.clone();
    let enable = tokio::spawn(async move { enabling.enable_journal().await });
    tokio::time::timeout(Duration::from_secs(2), async {
        while !dir.path().join("enable-started").exists() {
            tokio::time::sleep(Duration::from_millis(5)).await;
        }
    })
    .await
    .unwrap();
    source.stop().await;
    assert!(enable.await.unwrap().is_err());
    assert!(
        source.inner.closed.load(Ordering::Acquire),
        "journal enable resurrected a disconnected source"
    );
    assert!(source
        .list_issues()
        .await
        .unwrap_err()
        .contains("disconnected"));
    request.abort();
}

/// Opt-in fixture prepared outside the user's workspace. No installed binary is modified.
#[tokio::test]
#[ignore = "requires isolated real Beads 1.3 project and BEADSPEC_TEST_BD/BEADSPEC_TEST_PROJECT"]
async fn real_beads_transport_round_trip() {
    let binary = std::env::var("BEADSPEC_TEST_BD").expect("isolated binary path");
    let project = std::env::var("BEADSPEC_TEST_PROJECT").expect("isolated project path");
    assert!(Path::new(&project).starts_with(std::env::temp_dir()));
    let source = BeadsDataSource::connect(&project, &binary, "beadspec-test")
        .await
        .unwrap();
    if source.is_http() {
        assert_eq!(
            source.status().await.write_transport,
            Transport::Http,
            "default server policy should permit HTTP writes"
        );
    }
    let output = source
        .write(
            &["create", "Transport round trip", "--json"],
            "issues.create",
            "POST",
            "/issues",
            json!({"title":"Transport round trip","issue_type":"task"}),
        )
        .await
        .unwrap();
    let issues = source.list_issues().await.unwrap();
    let issue = issues
        .iter()
        .find(|issue| {
            field(issue, "title") == "Transport round trip" && output.contains(field(issue, "id"))
        })
        .expect("created issue visible");
    assert!(output.contains(field(issue, "id")));
    assert_eq!(
        field(
            &source.get_issue(field(issue, "id")).await.unwrap(),
            "title"
        ),
        "Transport round trip"
    );
    assert!(source
        .ready(Some(field(issue, "id")))
        .await
        .unwrap()
        .is_empty());
    source.stop().await;
}

#[cfg(unix)]
async fn stalled_journal_response(error_headers: bool) {
    let (source, _directory, original_request) = mock_source(json!({}), 200).await;
    original_request.abort();
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    source.inner.session.lock().await.as_mut().unwrap().base =
        format!("http://{}", listener.local_addr().unwrap());
    let server = tokio::spawn(async move {
        let (mut stream, _) = listener.accept().await.unwrap();
        let mut request = [0; 1024];
        let _ = stream.read(&mut request).await.unwrap();
        if error_headers {
            stream
                .write_all(b"HTTP/1.1 503 Busy\r\nContent-Length: 100\r\n\r\n")
                .await
                .unwrap();
        }
        tokio::time::sleep(Duration::from_secs(60)).await;
    });
    let result = tokio::time::timeout(Duration::from_secs(12), source.open_event_stream(0)).await;
    let error = result
        .expect("stalled journal request never yielded to reconciliation")
        .unwrap_err()
        .to_string();
    assert!(
        error.contains(if error_headers {
            "error response timed out"
        } else {
            "handshake timed out"
        }),
        "{error}"
    );
    server.abort();
    source.stop().await;
}
#[cfg(unix)]
#[tokio::test]
async fn journal_header_wait_is_bounded() {
    stalled_journal_response(false).await;
}
#[cfg(unix)]
#[tokio::test]
async fn journal_error_body_wait_is_bounded() {
    stalled_journal_response(true).await;
}

#[cfg(unix)]
#[tokio::test]
async fn native_single_anchor_keeps_raw_external_edges() {
    let (mut source, dir, request) = mock_source(json!({}), 200).await;
    Arc::get_mut(&mut source.inner).unwrap().context["dolt_mode"] = json!("embedded");
    std::fs::write(dir.path().join("bd"),r#"#!/bin/sh
if [ "$8" = "--json" ]; then
  echo '[{"id":"neighbor","title":"Related issue projection"}]'
else
  echo '[{"issue_id":"T-1","depends_on_id":"external:missing","type":"blocks"},{"issue_id":"T-1","depends_on_id":"external:missing","type":"blocks"}]'
fi
"#).unwrap();
    let edges = source.dependencies(&["T-1".into()]).await.unwrap();
    assert_eq!(
        edges.len(),
        1,
        "duplicated batch anchor returned duplicate edges"
    );
    assert_eq!(edges[0]["issue_id"], "T-1");
    assert_eq!(edges[0]["depends_on_id"], "external:missing");
    source.stop().await;
    request.abort();
}
