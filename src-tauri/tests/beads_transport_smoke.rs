//! Opt-in checks against disposable Beads 1.3 workspaces, never the user's projects.
use beadspec_lib::bd::api::{BeadsDataSource, Transport};
use serde_json::json;
#[tokio::test]
#[ignore = "requires BEADSPEC_TEST_BD and disposable BEADSPEC_TEST_PROJECT"]
async fn real_beads_transport_round_trip() {
    let binary = std::env::var("BEADSPEC_TEST_BD").expect("isolated bd binary");
    let project = std::env::var("BEADSPEC_TEST_PROJECT").expect("disposable project");
    assert!(
        project.starts_with("/private/tmp/"),
        "only disposable fixtures"
    );
    let source = BeadsDataSource::connect(&project, &binary, "beadspec-smoke")
        .await
        .unwrap();
    let expected = if std::env::var("BEADSPEC_TEST_HTTP").as_deref() == Ok("1") {
        Transport::Http
    } else {
        Transport::Cli
    };
    assert_eq!(source.status().await.read_transport, expected);
    let output = source
        .write(
            &["create", "--title=transport smoke", "--type=task"],
            "issues.create",
            "POST",
            "/issues",
            json!({"actor":"beadspec-smoke","title":"transport smoke","issue_type":"task"}),
        )
        .await
        .unwrap();
    let rows = source.list_issues().await.unwrap();
    let issue = rows
        .iter()
        .find(|row| row["title"] == "transport smoke")
        .unwrap();
    let id = issue["id"].as_str().unwrap();
    assert!(output.contains(id), "create keeps the frontend ID contract");
    let detail = source.get_issue(id).await.unwrap();
    assert_eq!(detail["title"], "transport smoke");
    let path = format!("/issues/{id}");
    source
        .write(
            &["update", id, "--notes=first\nsecond"],
            "issues.update",
            "PATCH",
            &path,
            json!({"actor":"beadspec-smoke","patch":{"notes":"first\nsecond"}}),
        )
        .await
        .unwrap();
    assert_eq!(
        source.get_issue(id).await.unwrap()["notes"],
        "first\nsecond"
    );
    let edges = source.dependencies(&[id.to_string()]).await.unwrap();
    assert!(edges.is_empty());
    let title = format!("blocking {}", id);
    let native_title = format!("--title={title}");
    source
        .write(
            &["create", &native_title, "--type=task"],
            "issues.create",
            "POST",
            "/issues",
            json!({"actor":"beadspec-smoke","title":title,"issue_type":"task"}),
        )
        .await
        .unwrap();
    let blocker = source
        .list_issues()
        .await
        .unwrap()
        .into_iter()
        .find(|row| row["title"] == title)
        .unwrap()["id"]
        .as_str()
        .unwrap()
        .to_string();
    source.write(&["dep","add",id,&blocker],"dependencies.add","POST","/dependencies:add",json!({"actor":"beadspec-smoke","edges":[{"issue_id":id,"depends_on_id":blocker,"type":"blocks"}]})).await.unwrap();
    assert!(source
        .dependencies(&[id.to_string()])
        .await
        .unwrap()
        .iter()
        .any(|edge| edge["depends_on_id"] == blocker));
    let error = source
        .write(
            &["close", id],
            "issues.close",
            "POST",
            &format!("{path}:close"),
            json!({"actor":"beadspec-smoke"}),
        )
        .await
        .unwrap_err();
    assert!(
        error.contains(&blocker),
        "close error retains blocker identity: {error}"
    );
    source
        .write(
            &["dep", "remove", id, &blocker],
            "dependencies.remove",
            "POST",
            "/dependencies:remove",
            json!({"actor":"beadspec-smoke","issue_id":id,"depends_on_id":blocker}),
        )
        .await
        .unwrap();
    source
        .write(
            &["comment", id, "--", "comment smoke"],
            "issues.addComment",
            "POST",
            &format!("{path}/comments"),
            json!({"author":"beadspec-smoke","text":"comment smoke"}),
        )
        .await
        .unwrap();
    source.enable_journal().await.unwrap();
    assert!(source.status().await.journal_enabled);
    if source.is_http() {
        let page = source.events_page(i64::MAX, 1).await.unwrap();
        assert!(page.records.is_empty());
        assert!(page.head >= 0);
    }
    for removed in [id, &blocker] {
        source
            .write(
                &["delete", removed, "--force"],
                "issues.delete",
                "POST",
                "/issues:delete",
                json!({"actor":"beadspec-smoke","ids":[removed],"force":true}),
            )
            .await
            .unwrap();
        assert!(!source
            .list_issues()
            .await
            .unwrap()
            .iter()
            .any(|issue| issue["id"] == removed));
    }
    source.stop().await;
}
